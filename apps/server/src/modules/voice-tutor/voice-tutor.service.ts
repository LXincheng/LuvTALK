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
  resolveChatModelRoute,
  resolveDashscopeGenerationEndpoint,
} from "../../common/config/model-provider.config";
import {
  FLASH_ONLY_TTS_VOICES,
  OFFICIAL_TTS_VOICE_CATALOG,
  resolveLanguageVoiceSettings,
} from "../../common/config/voice.config";
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
  ".ogg",
  ".wav",
  ".m4a",
  ".mp4",
  ".bin",
]);

interface LanguageHint {
  languageCode: string;
  ttsLanguageType: string;
  defaultVoice: string;
  options: string[];
}

type TtsSpeed = "slow" | "normal" | "fast";

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
  conversationKey?: string;
}

export interface VoiceCatalogItem {
  defaultVoice: string;
  options: string[];
}

@Injectable()
export class VoiceTutorService {
  private readonly logger = new Logger(VoiceTutorService.name);
  private readonly storageRoot = DEFAULT_STORAGE_ROOT;
  private static readonly NETWORK_TIMEOUT_MS = 12_000;
  private static readonly AUDIO_DOWNLOAD_TIMEOUT_MS = 10_000;
  private static readonly SYNTH_RETRY_COUNT = 2;

  constructor(
    private readonly conversationService: ConversationService,
    private readonly voiceOperationCache: VoiceOperationCacheService,
  ) {
    this.validateVoiceSetup();
  }

  private validateVoiceSetup(): void {
    const { apiKey, apiUrl, audioApiUrl } = envConfig.openai;
    const transcribeModel = envConfig.modelRouting.sttModel;
    const ttsModel = envConfig.modelRouting.ttsModel;
    if (!apiKey) {
      this.logger.warn("Primary provider API key missing; STT/TTS disabled.");
      return;
    }
    this.logger.log(
      `Voice provider ready | sttBase=${apiUrl || "unset"} | ttsBase=${audioApiUrl || "unset"} | stt=${transcribeModel || "unset"} | tts=${ttsModel || "unset"}`,
    );
  }

  async handleUpload(
    conversationId: string,
    file: VoiceUploadFile,
    userId?: string,
    conversationKey?: string,
  ): Promise<VoiceUploadResult> {
    if (!file?.buffer?.length) {
      throw new BadRequestException("文件内容为空");
    }
    if (file.buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException("音频文件过大");
    }

    const session = await this.conversationService.getAccessibleSession(
      conversationId,
      {
        userId,
        conversationKey,
        bindUserIfAuthenticated: true,
      },
    );
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
      conversationKey: session.accessKey,
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
    if (file.mimetype === "audio/ogg") {
      return ".ogg";
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
      let transcript = await this.transcribeWithQwenAsr(
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
          transcript = await this.transcribeWithQwenAsr(
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
      await this.ensureLatestTutorReplySpeech(
        conversationId,
        languageHint,
        activeUpload.conversationKey,
      );
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
      undefined,
      upload.conversationKey,
    );
  }

  private async ensureLatestTutorReplySpeech(
    conversationId: string,
    languageHint: LanguageHint,
    conversationKey?: string,
  ): Promise<void> {
    try {
      const session = await this.conversationService.getAccessibleSession(
        conversationId,
        {
          conversationKey,
          allowBootstrapMissingAccessKey: true,
        },
      );
      const latestAiMessage = [...session.messages]
        .reverse()
        .find((message) => message.sender === "ai");
      if (!latestAiMessage?.text?.trim()) {
        return;
      }
      if (latestAiMessage.meta?.audioUrl) {
        return;
      }
      await this.synthesizeSpeech(
        conversationId,
        latestAiMessage.text,
        languageHint.defaultVoice,
        "normal",
        undefined,
        conversationKey,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to eagerly synthesize tutor reply for ${conversationId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
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
      undefined,
      upload.conversationKey,
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
    userId?: string,
    conversationKey?: string,
  ): Promise<VoiceOperationSnapshot | undefined> {
    await this.conversationService.getAccessibleSession(conversationId, {
      userId,
      conversationKey,
      allowBootstrapMissingAccessKey: true,
    });
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

  private async transcribeWithQwenAsr(
    upload: VoiceUploadResult,
    languageHint: LanguageHint,
  ): Promise<string | undefined> {
    const route = resolveChatModelRoute(envConfig.modelRouting.sttModel);
    if (!route) {
      this.logger.warn("Primary provider STT 配置缺失，无法执行语音识别");
      return undefined;
    }
    try {
      const buffer = await readFile(upload.filePath);
      const base64 = buffer.toString("base64");
      const response = await this.fetchWithTimeout(
        route.endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${route.apiKey}`,
          },
          body: JSON.stringify({
            model: route.model,
            stream: false,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "input_audio",
                    input_audio: {
                      data: `data:${upload.mimeType || "audio/mpeg"};base64,${base64}`,
                    },
                  },
                ],
              },
            ],
            asr_options: {
              enable_itn: true,
            },
          }),
        },
        VoiceTutorService.NETWORK_TIMEOUT_MS,
        `transcription request ${upload.operationId}`,
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Primary provider transcription failed (${response.status}): ${errorText}`,
        );
        return undefined;
      }

      const payload = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?:
              | string
              | Array<
                  | { type?: string; text?: string }
                  | { type?: string; input_text?: string }
                >;
          };
        }>;
      };
      return this.extractMessageText(payload.choices?.[0]?.message?.content);
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
    speed: TtsSpeed = "normal",
    userId?: string,
    conversationKey?: string,
  ): Promise<{ audioUrl: string; fileName: string } | undefined> {
    const { apiKey, audioApiUrl } = envConfig.openai;
    const configuredTtsModel = envConfig.modelRouting.ttsModel;
    if (!apiKey || !configuredTtsModel || !audioApiUrl) {
      this.logger.warn("Primary provider TTS 配置缺失，无法执行语音合成");
      return undefined;
    }
    const session = await this.conversationService.getAccessibleSession(
      conversationId,
      {
        userId,
        conversationKey,
        bindUserIfAuthenticated: true,
      },
    );
    const languageHint = this.resolveLanguageHint(session.targetLanguage);
    const resolvedVoice = this.resolveRequestedVoice(voice, languageHint);
    const resolvedTtsModel = this.resolveTtsModel(
      configuredTtsModel,
      resolvedVoice,
    );
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
      speed,
    );
    if (reusable) {
      this.logger.debug(
        `Reused synthesized speech for ${conversationId} -> ${reusable.fileName}`,
      );
      return reusable;
    }
    try {
      const response = await this.fetchWithRetry(
        () =>
          this.fetchWithTimeout(
            resolveDashscopeGenerationEndpoint(audioApiUrl),
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: resolvedTtsModel,
                input: {
                  text: speechInput,
                  voice: resolvedVoice,
                  language_type: languageHint.ttsLanguageType,
                },
                parameters: this.buildTtsParameters(
                  resolvedTtsModel,
                  resolvedVoice,
                  speed,
                  session.targetLanguage,
                ),
              }),
            },
            VoiceTutorService.NETWORK_TIMEOUT_MS,
            `speech synthesis request for ${conversationId}`,
          ),
        VoiceTutorService.SYNTH_RETRY_COUNT,
      );
      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Primary provider speech synthesis failed (${response.status}): ${errorText}`,
        );
        return undefined;
      }
      const payload = (await response.json()) as {
        output?: { audio?: { url?: string } };
      };
      const remoteAudioUrl = payload.output?.audio?.url?.trim();
      if (!remoteAudioUrl) {
        this.logger.error(
          "Primary provider speech synthesis returned empty audio url",
        );
        return undefined;
      }
      const audioResponse = await this.fetchWithRetry(
        () =>
          this.fetchWithTimeout(
            remoteAudioUrl,
            undefined,
            VoiceTutorService.AUDIO_DOWNLOAD_TIMEOUT_MS,
            `speech audio download for ${conversationId}`,
          ),
        VoiceTutorService.SYNTH_RETRY_COUNT,
      );
      if (!audioResponse.ok) {
        const errorText = await audioResponse.text();
        this.logger.error(
          `Primary provider speech audio download failed (${audioResponse.status}): ${errorText}`,
        );
        return undefined;
      }
      const buffer = Buffer.from(await audioResponse.arrayBuffer());
      await mkdir(directory, { recursive: true });
      const fileName = `tts-${Date.now()}-${randomUUID()}.wav`;
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
            ttsSpeed: speed,
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
    speed: TtsSpeed,
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
        return speed === "normal";
      }
      if (message.meta.ttsVoice !== voice) {
        return false;
      }
      if (!message.meta.ttsSpeed) {
        return speed === "normal";
      }
      return message.meta.ttsSpeed === speed;
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
    userId?: string,
    conversationKey?: string,
  ): Promise<{ stream: Readable; mimeType: string }> {
    await this.conversationService.getAccessibleSession(conversationId, {
      userId,
      conversationKey,
      allowBootstrapMissingAccessKey: true,
    });
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
    if (ext === ".ogg") {
      return "audio/ogg";
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
    return resolveLanguageVoiceSettings(language);
  }

  getVoiceCatalog(): Record<LanguageCode, VoiceCatalogItem> {
    return {
      [LanguageCode.Mandarin]: {
        defaultVoice:
          OFFICIAL_TTS_VOICE_CATALOG[LanguageCode.Mandarin].defaultVoice,
        options: OFFICIAL_TTS_VOICE_CATALOG[LanguageCode.Mandarin].options,
      },
      [LanguageCode.Cantonese]: {
        defaultVoice:
          OFFICIAL_TTS_VOICE_CATALOG[LanguageCode.Cantonese].defaultVoice,
        options: OFFICIAL_TTS_VOICE_CATALOG[LanguageCode.Cantonese].options,
      },
      [LanguageCode.English]: {
        defaultVoice:
          OFFICIAL_TTS_VOICE_CATALOG[LanguageCode.English].defaultVoice,
        options: OFFICIAL_TTS_VOICE_CATALOG[LanguageCode.English].options,
      },
    };
  }

  private resolveRequestedVoice(
    voice: string | undefined,
    languageHint: LanguageHint,
  ): string {
    const normalized = voice?.trim();
    if (normalized && languageHint.options.includes(normalized)) {
      return normalized;
    }
    return languageHint.defaultVoice;
  }

  private resolveTtsModel(configuredModel: string, voice: string): string {
    if (FLASH_ONLY_TTS_VOICES.has(voice)) {
      if (/^qwen3-tts-flash(?:-|$)/i.test(configuredModel)) {
        return configuredModel;
      }
      return "qwen3-tts-flash";
    }
    return configuredModel;
  }

  private buildTtsParameters(
    model: string,
    voice: string,
    speed: TtsSpeed,
    targetLanguage: LanguageCode,
  ): Record<string, unknown> {
    const parameters: Record<string, unknown> = {
      format: "wav",
    };
    if (!/instruct/i.test(model)) {
      return parameters;
    }
    const speedInstruction =
      speed === "slow"
        ? "Keep the delivery relaxed, but do not drag. Stay clear and flowing."
        : speed === "fast"
          ? "Speak briskly and smoothly, while staying natural and easy to follow."
          : "Keep a lively conversational pace with clean phrasing.";
    const languageInstruction =
      targetLanguage === LanguageCode.Cantonese
        ? "Use a natural Cantonese speaking style with smooth everyday rhythm."
        : targetLanguage === LanguageCode.Mandarin
          ? "Use natural Mandarin with a warm tutor tone."
          : "Use natural English with a friendly tutor tone.";
    parameters.instructions = `${languageInstruction} ${speedInstruction}`;
    parameters.output_audio = {
      speech_rate: speed === "slow" ? 1 : speed === "fast" ? 1.16 : 1.08,
    };
    if (voice) {
      parameters.voice = voice;
    }
    return parameters;
  }

  private extractMessageText(
    content:
      | string
      | Array<
          | { type?: string; text?: string }
          | { type?: string; input_text?: string }
        >
      | undefined,
  ): string | undefined {
    if (typeof content === "string") {
      const normalized = content.trim();
      return normalized || undefined;
    }
    if (!Array.isArray(content)) {
      return undefined;
    }
    const normalized = content
      .map((item) => {
        if (typeof item !== "object" || item === null) {
          return "";
        }
        if ("text" in item && typeof item.text === "string") {
          return item.text;
        }
        if ("input_text" in item && typeof item.input_text === "string") {
          return item.input_text;
        }
        return "";
      })
      .join("\n")
      .trim();
    return normalized || undefined;
  }

  private async fetchWithTimeout(
    input: string,
    init?: RequestInit,
    timeoutMs = VoiceTutorService.NETWORK_TIMEOUT_MS,
    context = "network request",
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`${context} timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchWithRetry(
    request: () => Promise<Response>,
    attempts: number,
  ): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await request();
      } catch (error) {
        lastError = error;
        if (attempt >= attempts) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
    throw lastError;
  }

  private buildFallbackUserText(languageHint: LanguageHint): string {
    if (
      languageHint.languageCode === "zh" ||
      languageHint.languageCode === "yue"
    ) {
      return "（系统提示：上一条语音暂时无法转写，请导师继续当前情境，对我进行鼓励并提示可以改用文字或重新录音。）";
    }
    return "(System note: my latest voice clip could not be transcribed. Please stay in character, reply in the practice language, and encourage me to retry or switch to text.)";
  }
}
