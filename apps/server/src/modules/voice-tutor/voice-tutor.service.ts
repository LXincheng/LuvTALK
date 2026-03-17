import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { exec } from "child_process";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import { access, mkdir, readFile, unlink, writeFile } from "fs/promises";
import { basename, extname, join } from "path";
import { Readable } from "stream";
import { envConfig } from "../../common/config/env.config";
import {
  VoiceOperationCacheService,
  VoiceOperationSnapshot,
} from "../../common/cache/voice-operation-cache.service";
import { LanguageCode } from "../../common/enums/language-code.enum";
import { ConversationService } from "../conversation/conversation.service";
import { buildProsodyReadyTtsInput } from "./tts-prosody";

const DEFAULT_STORAGE_ROOT = join(process.cwd(), "tmp", "voice-uploads");
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const CONVERTIBLE_AUDIO_EXTENSIONS = new Set([
  ".webm",
  ".wav",
  ".m4a",
  ".mp4",
  ".bin",
]);

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

  constructor(
    private readonly conversationService: ConversationService,
    private readonly voiceOperationCache: VoiceOperationCacheService,
  ) {
    this.validateOpenAiSetup();
  }

  private validateOpenAiSetup(): void {
    const { apiKey, apiUrl, audioApiUrl } = envConfig.openai;
    const transcribeModel = envConfig.modelRouting.sttModel;
    const ttsModel = envConfig.modelRouting.ttsModel;
    if (!apiKey) {
      this.logger.warn("Primary provider API key missing; STT/TTS disabled.");
      return;
    }
    this.logger.log(
      `Primary provider ready | base=${apiUrl || "unset"} | audio=${audioApiUrl || "unset"} | stt=${transcribeModel || "unset"} | tts=${ttsModel || "unset"}`,
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

    await this.updateOperationStatus(conversationId, result, {
      status: "received",
    });

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
    const startedAt = Date.now();
    let activeUpload = upload;
    await this.updateOperationStatus(conversationId, activeUpload, {
      status: "transcribing",
    });
    try {
      let transcript = await this.transcribeWithOpenAi(
        activeUpload,
        languageHint,
      );
      const transcribeElapsedMs = Date.now() - startedAt;
      this.logger.debug(
        `Voice ${activeUpload.operationId} transcription stage took ${transcribeElapsedMs}ms`,
      );
      if (!transcript && this.shouldAttemptMp3Fallback(activeUpload)) {
        const converted = await this.ensureMp3(activeUpload);
        if (converted.filePath !== activeUpload.filePath) {
          activeUpload = converted;
          await this.updateOperationStatus(conversationId, activeUpload, {
            status: "transcribing",
          });
          transcript = await this.transcribeWithOpenAi(
            activeUpload,
            languageHint,
          );
          this.logger.debug(
            `Voice ${activeUpload.operationId} retried transcription after mp3 conversion`,
          );
        }
      }
      if (!transcript) {
        await this.updateOperationStatus(conversationId, activeUpload, {
          status: "failed",
          error: "TRANSCRIPTION_FAILED",
        });
        await this.respondWithFallbackMessage(
          conversationId,
          activeUpload,
          languageHint,
          "TRANSCRIPTION_FAILED",
        );
        return;
      }
      await this.updateOperationStatus(conversationId, activeUpload, {
        status: "responding",
        transcript,
      });
      await this.forwardTranscript(conversationId, activeUpload, transcript);
      await this.updateOperationStatus(conversationId, activeUpload, {
        status: "completed",
        transcript,
      });
      this.logger.debug(
        `Voice ${activeUpload.operationId} finished in ${Date.now() - startedAt}ms`,
      );
    } catch (error) {
      this.logger.error(
        `Voice upload processing failed for ${activeUpload.operationId}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.updateOperationStatus(conversationId, activeUpload, {
        status: "failed",
        error: "PROCESSING_ERROR",
      });
      try {
        await this.respondWithFallbackMessage(
          conversationId,
          activeUpload,
          languageHint,
          "PROCESSING_ERROR",
        );
      } catch (fallbackError) {
        this.logger.error(
          `Fallback handling failed for ${activeUpload.operationId}`,
          fallbackError instanceof Error
            ? fallbackError.stack
            : String(fallbackError),
        );
      }
    }
  }

  /**
   * Convert webm/wav/m4a to mp3 via ffmpeg so the transcription API
   * can reliably parse audio duration.
   */
  private async ensureMp3(
    upload: VoiceUploadResult,
  ): Promise<VoiceUploadResult> {
    const ext = extname(upload.filePath).toLowerCase();
    if (ext === ".mp3" || !CONVERTIBLE_AUDIO_EXTENSIONS.has(ext)) return upload;

    const mp3Path = upload.filePath.replace(/\.[^.]+$/, ".mp3");
    const mp3FileName = upload.fileName.replace(/\.[^.]+$/, ".mp3");

    try {
      const ffmpegPath = ffmpegInstaller.path;
      await new Promise<void>((resolve, reject) => {
        exec(
          `"${ffmpegPath}" -i "${upload.filePath}" -y -vn -ar 16000 -ac 1 -b:a 64k "${mp3Path}"`,
          { timeout: 30_000 },
          (err) => (err ? reject(err) : resolve()),
        );
      });
      // Remove original file
      await unlink(upload.filePath).catch(() => {});
      this.logger.debug(`Converted ${ext} -> mp3: ${mp3FileName}`);
      return {
        ...upload,
        filePath: mp3Path,
        fileName: mp3FileName,
        mimeType: "audio/mpeg",
      };
    } catch (error) {
      this.logger.warn(
        `ffmpeg conversion failed, sending original ${ext}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return upload;
    }
  }

  private async forwardTranscript(
    conversationId: string,
    upload: VoiceUploadResult,
    transcript: string,
  ): Promise<void> {
    await this.conversationService.processMessage(
      conversationId,
      { message: transcript },
      {
        userMessageMeta: {
          audioUrl: this.buildAudioReference(conversationId, upload.fileName),
        },
      },
    );
  }

  private async respondWithFallbackMessage(
    conversationId: string,
    upload: VoiceUploadResult,
    languageHint: LanguageHint,
    errorCode?: string,
  ): Promise<void> {
    const fallbackText = this.buildFallbackUserText(languageHint);
    await this.conversationService.processMessage(
      conversationId,
      { message: fallbackText },
      {
        userMessageMeta: {
          audioUrl: this.buildAudioReference(conversationId, upload.fileName),
        },
      },
    );
    await this.updateOperationStatus(conversationId, upload, {
      status: "completed",
      error: errorCode,
    });
  }

  private buildAudioReference(
    conversationId: string,
    fileName: string,
  ): string {
    return `/api/conversation/${conversationId}/voice/${fileName}`;
  }

  async getVoiceOperationStatus(
    conversationId: string,
    operationId: string,
  ): Promise<VoiceOperationSnapshot | undefined> {
    const snapshot = await this.voiceOperationCache.getSnapshot(operationId);
    if (!snapshot || snapshot.conversationId !== conversationId) {
      return undefined;
    }
    return snapshot;
  }

  private async updateOperationStatus(
    conversationId: string,
    upload: VoiceUploadResult,
    patch: Partial<VoiceOperationSnapshot>,
  ): Promise<void> {
    await this.voiceOperationCache.mergeSnapshot(
      conversationId,
      upload.operationId,
      {
        audioUrl: this.buildAudioReference(conversationId, upload.fileName),
        ...patch,
      },
    );
  }

  private async transcribeWithOpenAi(
    upload: VoiceUploadResult,
    languageHint: LanguageHint,
  ): Promise<string | undefined> {
    const { apiKey, audioApiUrl } = envConfig.openai;
    const transcribeModel = envConfig.modelRouting.sttModel;
    if (!apiKey || !transcribeModel || !audioApiUrl) {
      this.logger.warn("Primary provider STT 配置缺失，无法执行语音识别");
      return undefined;
    }
    try {
      const buffer = await readFile(upload.filePath);
      const fileBlob = new Blob([buffer], {
        type: upload.mimeType || "application/octet-stream",
      });
      const formData = new FormData();
      formData.append("file", fileBlob, upload.fileName);
      formData.append("model", transcribeModel);
      formData.append("language", languageHint.languageCode);
      formData.append("prompt", languageHint.transcriptionPrompt);
      formData.append("response_format", "json");
      const response = await fetch(
        `${audioApiUrl.replace(/\/$/, "")}/transcriptions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Primary provider transcription failed (${response.status}): ${errorText}`,
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
        `Primary provider transcription exception for ${upload.operationId}`,
        error instanceof Error ? error.stack : String(error),
      );
      return undefined;
    }
  }

  private shouldAttemptMp3Fallback(upload: VoiceUploadResult): boolean {
    const ext = extname(upload.filePath).toLowerCase();
    return ext !== ".mp3" && CONVERTIBLE_AUDIO_EXTENSIONS.has(ext);
  }

  async synthesizeSpeech(
    conversationId: string,
    text: string,
    voice?: string,
  ): Promise<{ audioUrl: string; fileName: string } | undefined> {
    const { apiKey, audioApiUrl } = envConfig.openai;
    const ttsModel = envConfig.modelRouting.ttsModel;
    if (!apiKey || !ttsModel || !audioApiUrl) {
      this.logger.warn("Primary provider TTS 配置缺失，无法执行语音合成");
      return undefined;
    }
    const session = await this.conversationService.getSession(conversationId);
    const languageHint = this.resolveLanguageHint(session.targetLanguage);
    const resolvedVoice = voice ?? languageHint.ttsVoice;
    const directory = join(this.storageRoot, conversationId);
    const speechInput = buildProsodyReadyTtsInput(
      text,
      session.targetLanguage,
      session.scenarioId,
    );

    // Reuse existing synthesized audio from the same session/text/voice to avoid duplicate API calls.
    const reusable = await this.findReusableTtsAudio(
      session,
      conversationId,
      text,
      resolvedVoice,
    );
    if (reusable) {
      this.logger.debug(
        `Reused synthesized speech for ${conversationId} -> ${reusable.fileName}`,
      );
      return reusable;
    }
    try {
      const response = await fetch(`${audioApiUrl.replace(/\/$/, "")}/speech`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ttsModel,
          input: speechInput,
          voice: resolvedVoice,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Primary provider speech synthesis failed (${response.status}): ${errorText}`,
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
      const audioUrl = this.buildAudioReference(conversationId, fileName);

      // Write back TTS audioUrl to the matching AI message meta for persistence
      try {
        const currentSession =
          await this.conversationService.getSession(conversationId);
        const targetMessage = [...currentSession.messages]
          .reverse()
          .find((m) => m.sender === "ai" && m.text === text);
        if (targetMessage && !targetMessage.meta?.audioUrl) {
          targetMessage.meta = {
            ...targetMessage.meta,
            audioUrl,
            ttsVoice: resolvedVoice,
          };
          await this.conversationService.persistSessionPublic(currentSession);
        }
      } catch (writebackError) {
        this.logger.warn(
          `TTS audioUrl writeback failed: ${
            writebackError instanceof Error
              ? writebackError.message
              : String(writebackError)
          }`,
        );
      }

      return { fileName, audioUrl };
    } catch (error) {
      this.logger.error(
        `Primary provider speech synthesis exception for conversation ${conversationId}`,
        error instanceof Error ? error.stack : String(error),
      );
      return undefined;
    }
  }

  private async findReusableTtsAudio(
    session: Awaited<ReturnType<ConversationService["getSession"]>>,
    conversationId: string,
    text: string,
    voice: string,
  ): Promise<{ audioUrl: string; fileName: string } | undefined> {
    const target = text.trim();
    if (!target) {
      return undefined;
    }
    const candidate = [...session.messages].reverse().find((message) => {
      if (message.sender !== "ai") {
        return false;
      }
      if (message.text.trim() !== target) {
        return false;
      }
      if (!message.meta?.audioUrl) {
        return false;
      }
      // Backward compatible: old records may not have ttsVoice.
      if (!message.meta.ttsVoice) {
        return true;
      }
      return message.meta.ttsVoice === voice;
    });
    if (!candidate?.meta?.audioUrl) {
      return undefined;
    }
    const fileName = basename(candidate.meta.audioUrl);
    try {
      await access(join(this.storageRoot, conversationId, fileName));
    } catch {
      return undefined;
    }
    return {
      audioUrl: candidate.meta.audioUrl,
      fileName,
    };
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
          ttsVoice: "shimmer",
        };
      case LanguageCode.Cantonese:
        return {
          languageCode: "zh",
          transcriptionPrompt:
            "说话人使用粤语（Cantonese Chinese），请按粤语发音转写。",
          ttsVoice: "shimmer",
        };
      case LanguageCode.English:
      default:
        return {
          languageCode: "en",
          transcriptionPrompt: "Speaker is using English.",
          ttsVoice: "shimmer",
        };
    }
  }

  private buildFallbackUserText(languageHint: LanguageHint): string {
    if (languageHint.languageCode === "zh") {
      return "（系统提示：上一条语音暂时无法转写，请导师继续当前情境，对我进行鼓励并提示可以改用文字或重新录音。）";
    }
    return "(System note: my latest voice clip could not be transcribed. Please stay in character, reply in the practice language, and encourage me to retry or switch to text.)";
  }
}
