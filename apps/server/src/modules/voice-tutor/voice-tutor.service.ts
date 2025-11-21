import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import FormData from "form-data";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import { access, mkdir, readFile, writeFile } from "fs/promises";
import { basename, extname, join } from "path";
import { Readable } from "stream";
import { envConfig } from "../../common/config/env.config";
import { LanguageCode } from "../../common/enums/language-code.enum";
import { ConversationService } from "../conversation/conversation.service";

const DEFAULT_STORAGE_ROOT = join(process.cwd(), "tmp", "voice-uploads");
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

interface LanguageHint {
  languageCode: string;
  transcriptionPrompt: string;
  ttsVoice: string;
}

export interface VoiceUploadFile {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
}

export interface VoiceUploadResult {
  operationId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
}

@Injectable()
export class VoiceTutorService {
  private readonly logger = new Logger(VoiceTutorService.name);
  private readonly storageRoot = DEFAULT_STORAGE_ROOT;

  constructor(private readonly conversationService: ConversationService) {
    this.validateOpenAiSetup();
  }

  private validateOpenAiSetup(): void {
    const { apiKey, apiUrl, transcribeModel, ttsModel } = envConfig.openai;
    if (!apiKey) {
      this.logger.warn("Yunwu OpenAI API key missing; STT/TTS disabled.");
      return;
    }
    this.logger.log(
      `Yunwu OpenAI ready | base=${apiUrl ?? "default"} | stt=${transcribeModel} | tts=${ttsModel}`,
    );
  }

  async handleUpload(
    conversationId: string,
    file: VoiceUploadFile,
  ): Promise<VoiceUploadResult> {
    if (!file?.buffer?.length) {
      throw new BadRequestException("文件内容为空");
    }
    if (file.buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException("音频文件过大");
    }

    const session = await this.conversationService.getSession(conversationId);
    const languageHint = this.resolveLanguageHint(session.targetLanguage);

    const operationId = `voice-op-${Date.now()}-${randomUUID()}`;
    const extension = this.resolveExtension(file);
    const directory = join(this.storageRoot, conversationId);
    const fileName = `${operationId}${extension}`;
    const filePath = join(directory, fileName);

    await mkdir(directory, { recursive: true });
    await writeFile(filePath, file.buffer);

    this.logger.debug(
      `Stored voice upload for ${conversationId} -> ${filePath} (${file.mimetype})`,
    );

    const result: VoiceUploadResult = {
      operationId,
      filePath,
      fileName,
      mimeType: file.mimetype,
    };

    void this.processVoiceUpload(conversationId, result, languageHint).catch(
      (error) => {
        this.logger.error(
          `Failed to process voice upload ${operationId}`,
          error instanceof Error ? error.stack : String(error),
        );
      },
    );

    return result;
  }

  private resolveExtension(file: VoiceUploadFile): string {
    if (file.originalname) {
      const originalExt = extname(file.originalname);
      if (originalExt) {
        return originalExt.toLowerCase();
      }
    }
    if (file.mimetype === "audio/webm" || file.mimetype === "video/webm") {
      return ".webm";
    }
    if (file.mimetype === "audio/wav") {
      return ".wav";
    }
    if (
      file.mimetype === "audio/m4a" ||
      file.mimetype === "audio/mp4" ||
      file.mimetype === "video/mp4"
    ) {
      return ".m4a";
    }
    if (file.mimetype === "audio/mpeg") {
      return ".mp3";
    }
    return ".bin";
  }

  private async processVoiceUpload(
    conversationId: string,
    upload: VoiceUploadResult,
    languageHint: LanguageHint,
  ): Promise<void> {
    try {
      const transcript = await this.transcribeWithOpenAi(upload, languageHint);
      if (!transcript) {
        this.logger.warn(
          `Skipping voice response for ${upload.operationId}, transcription unavailable`,
        );
        return;
      }
      await this.conversationService.processMessage(
        conversationId,
        { message: transcript },
        {
          userMessageMeta: {
            audioUrl: this.buildAudioReference(conversationId, upload.fileName),
          },
        },
      );
    } catch (error) {
      this.logger.error(
        `Voice upload processing failed for ${upload.operationId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private buildAudioReference(
    conversationId: string,
    fileName: string,
  ): string {
    return `/api/conversation/${conversationId}/voice/${fileName}`;
  }

  private async transcribeWithOpenAi(
    upload: VoiceUploadResult,
    languageHint: LanguageHint,
  ): Promise<string | undefined> {
    const { apiKey, apiUrl, transcribeModel } = envConfig.openai;
    if (!apiKey || !transcribeModel || !apiUrl) {
      this.logger.warn("Yunwu OpenAI 配置缺失，无法执行语音识别");
      return undefined;
    }
    try {
      const buffer = await readFile(upload.filePath);
      const formData = new FormData();
      formData.append("file", buffer, {
        filename: upload.fileName,
        contentType: upload.mimeType || "application/octet-stream",
      });
      formData.append("model", transcribeModel);
      formData.append("language", languageHint.languageCode);
      formData.append("prompt", languageHint.transcriptionPrompt);
      const response = await fetch(
        `${apiUrl.replace(/\/$/, "")}/audio/transcriptions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            ...formData.getHeaders(),
          },
          body: formData as unknown as BodyInit,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Yunwu transcription failed (${response.status}): ${errorText}`,
        );
        return undefined;
      }

      const raw = await response.text();
      try {
        const payload = JSON.parse(raw) as { text?: string };
        return payload.text?.trim();
      } catch (error) {
        this.logger.error(
          `Failed to parse transcription response for ${upload.operationId}: ${raw}`,
          error instanceof Error ? error.stack : String(error),
        );
        return undefined;
      }
    } catch (error) {
      this.logger.error(
        `Yunwu transcription exception for ${upload.operationId}`,
        error instanceof Error ? error.stack : String(error),
      );
      return undefined;
    }
  }

  async synthesizeSpeech(
    conversationId: string,
    text: string,
    voice?: string,
  ): Promise<{ audioUrl: string; fileName: string } | undefined> {
    const { apiKey, apiUrl, ttsModel } = envConfig.openai;
    if (!apiKey || !ttsModel || !apiUrl) {
      this.logger.warn("Yunwu OpenAI 配置缺失，无法执行语音合成");
      return undefined;
    }
    const session = await this.conversationService.getSession(conversationId);
    const languageHint = this.resolveLanguageHint(session.targetLanguage);
    const directory = join(this.storageRoot, conversationId);
    try {
      const response = await fetch(
        `${apiUrl.replace(/\/$/, "")}/audio/speech`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: ttsModel,
            input: text,
            voice: voice ?? languageHint.ttsVoice,
          }),
        },
      );
      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Yunwu speech synthesis failed (${response.status}): ${errorText}`,
        );
        return undefined;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      await mkdir(directory, { recursive: true });
      const fileName = `tts-${Date.now()}-${randomUUID()}.mp3`;
      await writeFile(join(directory, fileName), buffer);
      this.logger.debug(
        `Stored synthesized speech for ${conversationId} -> ${fileName}`,
      );
      return {
        fileName,
        audioUrl: this.buildAudioReference(conversationId, fileName),
      };
    } catch (error) {
      this.logger.error(
        `Yunwu speech synthesis exception for conversation ${conversationId}`,
        error instanceof Error ? error.stack : String(error),
      );
      return undefined;
    }
  }

  async openAudioStream(
    conversationId: string,
    fileName: string,
  ): Promise<{ stream: Readable; mimeType: string }> {
    const safeFileName = basename(fileName);
    const filePath = join(this.storageRoot, conversationId, safeFileName);
    try {
      await access(filePath);
    } catch {
      throw new BadRequestException("音频文件不存在");
    }
    const stream = createReadStream(filePath);
    const mimeType = this.detectMimeType(safeFileName);
    return { stream, mimeType };
  }

  private detectMimeType(fileName: string): string {
    const ext = extname(fileName).toLowerCase();
    if (ext === ".mp3") {
      return "audio/mpeg";
    }
    if (ext === ".wav") {
      return "audio/wav";
    }
    if (ext === ".webm") {
      return "audio/webm";
    }
    if (ext === ".m4a" || ext === ".mp4") {
      return "audio/mp4";
    }
    return "application/octet-stream";
  }

  private resolveLanguageHint(language?: LanguageCode | string): LanguageHint {
    switch (language) {
      case LanguageCode.Mandarin:
        return {
          languageCode: "zh",
          transcriptionPrompt: "说话人使用普通话（Mandarin Chinese）。",
          ttsVoice: "alloy",
        };
      case LanguageCode.Cantonese:
        return {
          languageCode: "zh",
          transcriptionPrompt:
            "说话人使用粤语（Cantonese Chinese），请按粤语发音转写。",
          ttsVoice: "fable",
        };
      case LanguageCode.English:
      default:
        return {
          languageCode: "en",
          transcriptionPrompt: "Speaker is using English.",
          ttsVoice: "alloy",
        };
    }
  }
}
