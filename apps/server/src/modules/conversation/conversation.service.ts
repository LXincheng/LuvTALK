import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import { access, mkdir, readFile, rm, writeFile } from "fs/promises";
import { basename, extname, join } from "path";
import { Observable, Subject } from "rxjs";
import { envConfig } from "../../common/config/env.config";
import {
  applyThinkingToggle,
  isDeepSeekModel,
  isQwenModel,
  resolveChatModelRoute,
  supportsJsonObjectResponse,
  supportsThinkingToggle,
} from "../../common/config/model-provider.config";
import {
  buildConversationSystemPrompt,
  TutorInteractionMode,
} from "../../common/config/prompt.config";
import {
  buildVisionLearnerPrompt,
  buildVisionTutorPromptAddition,
} from "../../common/config/prompts/conversation-vision";
import {
  buildDefaultTeachingTips,
  buildDynamicScenarioGuidance,
  buildScenarioHintMessage,
  ensureScenarioTeachingReply,
} from "../../common/config/prompts/conversation.guidance";
import { LanguageCode } from "../../common/enums/language-code.enum";
import {
  ConversationCoachNote,
  ConversationMessage,
  ConversationSession,
} from "../../common/types/conversation.types";
import {
  AiResponse,
  AiResponseSchema,
  KeyTerm,
} from "../../common/types/ai-response.schema";
import { PrismaService } from "../../core/prisma/prisma.service";
import { SessionCacheService } from "../../common/cache/session-cache.service";
import { AchievementService } from "../achievement/achievement.service";
import { TranslationService } from "../translation/translation.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { StartConversationDto } from "./dto/start-conversation.dto";
import { normalizeAiResponsePayload } from "./ai-response-normalizer";
import {
  buildSessionSummary,
  SessionSummaryPayload,
} from "./conversation-summary.types";
import {
  buildWelcomeCopy,
  buildFallbackReplyCopy,
  FALLBACK_SCORE_REASON,
  FALLBACK_PLAIN_REPLY_SCORE_REASON,
  resolveFallbackAssociativePhrases,
  resolveLanguageLabel,
  resolveScenarioTitle,
  resolveSpeakerName,
} from "./conversation.copy";
import {
  CONVERSATION_DEFAULTS,
  CONVERSATION_LOG_COPY,
} from "./conversation.constants";
import { ensureVoiceTipSet } from "./voice-tip-templater";
import { buildConversationMemoryPack } from "./conversation-memory-pack";

const buildAvatarDataUrl = (svg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const TUTOR_AVATAR = buildAvatarDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="tutorBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#6366f1"/>
        <stop offset="100%" stop-color="#8b5cf6"/>
      </linearGradient>
      <linearGradient id="tutorSkin" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fde68a"/>
        <stop offset="100%" stop-color="#facc15"/>
      </linearGradient>
      <linearGradient id="tutorCloak" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#c7d2fe"/>
        <stop offset="100%" stop-color="#818cf8"/>
      </linearGradient>
    </defs>
    <rect width="96" height="96" rx="28" fill="url(#tutorBg)"/>
    <circle cx="48" cy="44" r="23" fill="url(#tutorSkin)"/>
    <path d="M26 40c3-12 40-12 44 0v8c0 7-6 13-13 13H39c-7 0-13-6-13-13z" fill="#1f2358" opacity="0.9"/>
    <circle cx="38" cy="48" r="3" fill="#111827"/>
    <circle cx="58" cy="48" r="3" fill="#111827"/>
    <path d="M37 58c4 4 18 4 22 0" fill="none" stroke="#111827" stroke-width="3" stroke-linecap="round"/>
    <path d="M18 82h60c-8-16-20-24-30-24s-22 8-30 24z" fill="url(#tutorCloak)"/>
  </svg>
`);

const LEARNER_AVATAR = buildAvatarDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="learnerBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f97316"/>
        <stop offset="100%" stop-color="#fb7185"/>
      </linearGradient>
      <linearGradient id="learnerSkin" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fecdd3"/>
        <stop offset="100%" stop-color="#f472b6"/>
      </linearGradient>
      <linearGradient id="learnerCloak" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fde68a"/>
        <stop offset="100%" stop-color="#fbbf24"/>
      </linearGradient>
    </defs>
    <rect width="96" height="96" rx="28" fill="url(#learnerBg)"/>
    <circle cx="48" cy="44" r="22" fill="url(#learnerSkin)"/>
    <path d="M24 38c5-12 44-12 48 0v7c0 7-6 12-13 12H37c-7 0-13-5-13-12z" fill="#be185d" opacity="0.85"/>
    <circle cx="36" cy="48" r="3" fill="#4c0519"/>
    <circle cx="60" cy="48" r="3" fill="#4c0519"/>
    <path d="M36 58c5 4 19 4 24 0" fill="none" stroke="#831843" stroke-width="3" stroke-linecap="round"/>
    <path d="M16 82h64c-9-18-21-26-32-26s-23 8-32 26z" fill="url(#learnerCloak)"/>
  </svg>
`);

interface ProcessMessageOptions {
  userMessageMeta?: ConversationMessage["meta"];
}

interface ProcessImageMessageOptions {
  question?: string;
  mimeType: string;
  buffer: Buffer;
  originalName?: string;
}

interface TutorTurnInput {
  latestMessageText: string;
  userContent:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
  promptAddition?: string;
  requiresVision?: boolean;
}

interface RealtimeTranscriptEntry {
  role: "user" | "ai";
  text: string;
  timestamp?: string;
}

export interface ConversationQuickRepliesPayload {
  conversationId: string;
  options: string[];
}

interface ConversationUiArtifactCacheEntry<T> {
  messageCount: number;
  value: T;
}

interface ConversationFastTipPayload {
  correction?: string;
  cultureNote?: string;
  pronunciationTip?: string;
  rhythmTip?: string;
  grammarTip?: string;
}

interface SessionAccessOptions {
  userId?: string;
  conversationKey?: string;
  allowBootstrapMissingAccessKey?: boolean;
  bindUserIfAuthenticated?: boolean;
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  private readonly sessions = new Map<string, ConversationSession>();
  private readonly sessionStreams = new Map<
    string,
    Subject<ConversationSession>
  >();
  private readonly summaryCopyCache = new Map<
    string,
    ConversationUiArtifactCacheEntry<Pick<SessionSummaryPayload, "headline" | "advice">>
  >();
  private readonly quickReplyCache = new Map<
    string,
    ConversationUiArtifactCacheEntry<string[]>
  >();
  private readonly uiArtifactInflight = new Map<string, Promise<void>>();
  private schemaMissingUserColumn = false;
  private readonly avatars = {
    ai: TUTOR_AVATAR,
    user: LEARNER_AVATAR,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly achievementService: AchievementService,
    private readonly translation: TranslationService,
    private readonly sessionCache: SessionCacheService,
  ) {}

  async startSession(
    dto: StartConversationDto,
    userId?: string,
  ): Promise<ConversationSession> {
    this.prisma.ensurePersistentStorageAvailable();
    const now = new Date().toISOString();
    const scenarioId = dto.scenarioId ?? CONVERSATION_DEFAULTS.scenarioId;
    const nativeLanguage = dto.nativeLanguage ?? LanguageCode.Mandarin;

    // Archive previous active conversation for this user + language
    if (userId && this.prisma.canUseDatabase()) {
      try {
        await this.prisma.conversation.updateMany({
          where: {
            userId,
            targetLanguage: dto.targetLanguage,
            status: "active",
          },
          data: { status: "archived" },
        });
      } catch (error) {
        this.logger.warn(
          `Failed to archive old conversations: ${(error as Error).message}`,
        );
      }
    }

    const welcomeMessage = this.buildSystemWelcome(
      scenarioId,
      dto.targetLanguage,
      nativeLanguage,
      now,
    );

    const session: ConversationSession = {
      id: randomUUID(),
      scenarioId,
      targetLanguage: dto.targetLanguage,
      nativeLanguage,
      accessKey: this.createConversationAccessKey(),
      userId,
      title: this.buildConversationTitle(
        this.describeScenario(scenarioId, nativeLanguage),
        dto.targetLanguage,
        nativeLanguage,
      ),
      status: "active",
      createdAt: now,
      updatedAt: now,
      messages: [welcomeMessage],
    };

    await this.persistSession(session);
    this.broadcastSession(session);
    return session;
  }

  async appendRealtimeTranscript(
    conversationId: string,
    entries: RealtimeTranscriptEntry[],
    userId?: string,
    conversationKey?: string,
  ): Promise<number> {
    const session = await this.getAccessibleSession(conversationId, {
      userId,
      conversationKey,
      bindUserIfAuthenticated: true,
    });

    const normalized = entries
      .map((entry) => ({
        role: entry.role,
        text: entry.text?.trim(),
        timestamp: resolveTimestamp(entry.timestamp),
      }))
      .filter((entry) => entry.text) as Array<{
      role: "user" | "ai";
      text: string;
      timestamp?: string;
    }>;

    if (!normalized.length) {
      return 0;
    }

    const initialUserCount = session.messages.filter(
      (message) => message.sender === "user",
    ).length;

    const appended = normalized.map((entry) =>
      this.buildMessage(
        entry.role,
        entry.text,
        session.targetLanguage,
        session.nativeLanguage,
        {
          ...(entry.timestamp ? { createdAt: entry.timestamp } : {}),
          meta: { source: "realtime" },
        },
      ),
    );

    session.messages.push(...appended);

    if (initialUserCount === 0) {
      const firstUser = appended.find((message) => message.sender === "user");
      if (firstUser) {
        session.title = this.summarizeTitle(
          firstUser.text,
          session.targetLanguage,
          session.nativeLanguage,
          session.scenarioId,
        );
      }
    }

    session.updatedAt = new Date().toISOString();
    await this.persistSession(session);
    this.broadcastSession(session);
    return appended.length;
  }

  async resumeOrCreateSession(
    dto: StartConversationDto,
    userId?: string,
    conversationKey?: string,
  ): Promise<ConversationSession> {
    // 1. Try to resume by userId + language (authenticated users)
    if (userId && this.prisma.canUseDatabase()) {
      try {
        const existing = await this.prisma.conversation.findFirst({
          where: {
            userId,
            targetLanguage: dto.targetLanguage,
            status: "active",
          },
          orderBy: { updatedAt: "desc" },
        });
        if (existing) {
          return this.getAccessibleSession(existing.id, {
            userId,
            conversationKey,
            allowBootstrapMissingAccessKey: true,
            bindUserIfAuthenticated: true,
          });
        }
      } catch (error) {
        this.logger.warn(
          `Failed to query active conversation: ${(error as Error).message}`,
        );
      }
    }

    // 2. Try to resume by conversationId (guest users via localStorage)
    if (dto.conversationId) {
      try {
        const session = await this.getAccessibleSession(dto.conversationId, {
          userId,
          conversationKey,
          allowBootstrapMissingAccessKey: true,
          bindUserIfAuthenticated: true,
        });
        // Only resume if the target language matches the request
        if (session.targetLanguage !== dto.targetLanguage) {
          this.logger.log(
            `Language mismatch (session=${session.targetLanguage}, requested=${dto.targetLanguage}), creating new session.`,
          );
        } else {
          return session;
        }
      } catch {
        // Conversation not found, fall through to create new
        this.logger.log(
          `Conversation ${dto.conversationId} not found, creating new session.`,
        );
      }
    }

    // 3. Create new session
    return this.startSession(dto, userId);
  }

  async archiveConversation(
    conversationId: string,
    userId?: string,
    conversationKey?: string,
  ): Promise<void> {
    const session = await this.getAccessibleSession(conversationId, {
      userId,
      conversationKey,
      bindUserIfAuthenticated: true,
    });
    session.status = "archived";
    await this.persistSession(session);
  }

  async deleteConversation(
    conversationId: string,
    userId?: string,
    conversationKey?: string,
  ): Promise<void> {
    await this.getAccessibleSession(conversationId, {
      userId,
      conversationKey,
      bindUserIfAuthenticated: true,
    });

    if (this.prisma.canUseDatabase()) {
      try {
        await this.prisma.conversation.deleteMany({
          where: { id: conversationId },
        });
      } catch (error) {
        if (this.isDatabaseConnectionError(error)) {
          this.prisma.markDatabaseUnavailable(
            "Database connection lost (P1001/P1002).",
          );
          if (!this.prisma.allowsInMemoryFallback()) {
            this.prisma.ensurePersistentStorageAvailable();
          }
        } else if (this.isMissingUserColumnError(error)) {
          this.logMissingUserColumnWarning();
        } else {
          throw error;
        }
      }
    }

    await this.sessionCache.deleteSession(conversationId);
    this.sessions.delete(conversationId);

    const stream = this.sessionStreams.get(conversationId);
    if (stream) {
      stream.complete();
      this.sessionStreams.delete(conversationId);
    }

    await Promise.all([
      this.removeConversationStorage(
        join(CONVERSATION_IMAGE_STORAGE_ROOT, conversationId),
      ),
      this.removeConversationStorage(
        join(CONVERSATION_VOICE_STORAGE_ROOT, conversationId),
      ),
    ]);
  }

  /** Public wrapper for persisting session (used by VoiceTutorService for TTS URL writeback) */
  async persistSessionPublic(session: ConversationSession): Promise<void> {
    await this.persistSession(session);
  }

  async processMessage(
    conversationId: string,
    dto: SendMessageDto,
    options?: ProcessMessageOptions,
    userId?: string,
    conversationKey?: string,
  ): Promise<ConversationSession> {
    const session = await this.getAccessibleSession(conversationId, {
      userId,
      conversationKey,
      bindUserIfAuthenticated: true,
    });
    const trimmed = dto.message.trim();
    if (!trimmed) {
      return session;
    }

    const userMessage = this.buildMessage(
      "user",
      trimmed,
      session.targetLanguage,
      session.nativeLanguage,
      {
        meta: options?.userMessageMeta,
      },
    );
    session.messages.push(userMessage);
    const interactionMode = this.resolveInteractionMode(
      dto.mode,
      options?.userMessageMeta,
    );
    const fastTipPromise = this.generateFastFeedbackTips({
      session,
      latestMessageText: trimmed,
      interactionMode,
    });

    // Auto-generate title from first user message (replace default scenario title)
    const userMessageCount = session.messages.filter(
      (m) => m.sender === "user",
    ).length;
    if (userMessageCount === 1) {
      // Set a temporary title immediately; refine asynchronously after AI responds
      session.title = this.summarizeTitle(
        trimmed,
        session.targetLanguage,
        session.nativeLanguage,
        session.scenarioId,
      );
    }

    // Early broadcast: user message appears instantly in the UI
    this.broadcastSession(session);
    const rawAiPayload =
      (await this.requestTieredTutorReply(
        session,
        {
          latestMessageText: trimmed,
          userContent: trimmed,
        },
        interactionMode,
      )) ??
      this.composeAiResponse(
        trimmed,
        session.targetLanguage,
        session.scenarioId,
      );
    const aiPayload = this.enrichPayloadForInteractionMode(
      rawAiPayload,
      interactionMode,
      session.targetLanguage,
      session.nativeLanguage ?? LanguageCode.Mandarin,
      session.scenarioId,
      await this.resolveFastTipFallback(fastTipPromise),
    );

    const normalizedKeyTerms = this.normalizeKeyTerms(
      aiPayload.reply,
      aiPayload.keyTerms,
    );

    // Build AI message immediately (without translation) and broadcast early
    // so the user sees the reply ASAP while translation runs in background.
    const aiMessage = this.buildMessage(
      "ai",
      aiPayload.reply,
      session.targetLanguage,
      session.nativeLanguage,
      {
        meta: {
          score: aiPayload.score,
          scoreReason: aiPayload.scoreReason,
          pronunciationTip: aiPayload.pronunciationTip || undefined,
          rhythmTip: aiPayload.rhythmTip || undefined,
          grammarTip: aiPayload.grammarTip || undefined,
          keyTerms: normalizedKeyTerms,
        },
      },
    );
    session.messages.push(aiMessage);
    session.coach = this.buildCoachNote(aiPayload);
    session.updatedAt = new Date().toISOString();

    // Early broadcast: user sees AI reply before translation is ready
    await this.persistSession(session);
    this.broadcastSession(session);
    this.prewarmConversationUiArtifacts(
      session,
      session.nativeLanguage === LanguageCode.English ? "en" : "zh",
    );

    // Run translation in background, then update the message
    this.translateForNativeLanguage(
      aiPayload.reply,
      session.targetLanguage,
      session.nativeLanguage ?? LanguageCode.Mandarin,
    )
      .then(async (translationText) => {
        if (translationText) {
          aiMessage.meta = { ...aiMessage.meta, translation: translationText };
          await this.persistSession(session);
          this.broadcastSession(session);
        }
      })
      .catch((err) => {
        this.logger.warn(
          `Background translation failed: ${(err as Error).message}`,
        );
      });

    this.achievementService.queueUserProgressSync(userId);
    return session;
  }

  async processImageMessage(
    conversationId: string,
    options: ProcessImageMessageOptions,
    userId?: string,
    conversationKey?: string,
  ): Promise<ConversationSession> {
    const session = await this.getAccessibleSession(conversationId, {
      userId,
      conversationKey,
      bindUserIfAuthenticated: true,
    });
    if (!options.buffer?.length) {
      return session;
    }
    if (options.buffer.length > MAX_IMAGE_FILE_SIZE_BYTES) {
      throw new Error("IMAGE_TOO_LARGE");
    }

    const storedImage = await this.storeConversationImage(
      conversationId,
      options.buffer,
      options.mimeType,
      options.originalName,
    );
    const learnerText = options.question?.trim();
    const visibleMessage =
      learnerText ||
      this.buildDefaultImageQuestion(
        session.targetLanguage,
        session.nativeLanguage ?? LanguageCode.Mandarin,
      );

    const userMessage = this.buildMessage(
      "user",
      visibleMessage,
      session.targetLanguage,
      session.nativeLanguage,
      {
        meta: {
          imageUrl: this.buildImageReference(
            conversationId,
            storedImage.fileName,
          ),
          imageMimeType: storedImage.mimeType,
        },
      },
    );
    session.messages.push(userMessage);
    const fastTipPromise = this.generateFastFeedbackTips({
      session,
      latestMessageText: visibleMessage,
      interactionMode: "text",
    });

    const userMessageCount = session.messages.filter(
      (message) => message.sender === "user",
    ).length;
    if (userMessageCount === 1) {
      session.title = this.summarizeTitle(
        visibleMessage,
        session.targetLanguage,
        session.nativeLanguage,
        session.scenarioId,
      );
    }

    this.broadcastSession(session);

    const rawAiPayload =
      (await this.requestTieredTutorReply(
        session,
        {
          latestMessageText: visibleMessage,
          userContent: [
            {
              type: "text",
              text: buildVisionLearnerPrompt({
                targetLanguage: session.targetLanguage,
                nativeLanguage: session.nativeLanguage ?? LanguageCode.Mandarin,
                learnerText,
              }),
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${storedImage.mimeType};base64,${options.buffer.toString("base64")}`,
              },
            },
          ],
          promptAddition: buildVisionTutorPromptAddition({
            targetLanguage: session.targetLanguage,
            nativeLanguage: session.nativeLanguage ?? LanguageCode.Mandarin,
          }),
          requiresVision: true,
        },
        "text",
      )) ??
      this.composeVisionFallbackResponse(
        session.targetLanguage,
        session.nativeLanguage ?? LanguageCode.Mandarin,
        learnerText,
      );

    const aiPayload = this.enrichPayloadForInteractionMode(
      rawAiPayload,
      "text",
      session.targetLanguage,
      session.nativeLanguage ?? LanguageCode.Mandarin,
      session.scenarioId,
      await this.resolveFastTipFallback(fastTipPromise),
    );
    const normalizedKeyTerms = this.normalizeKeyTerms(
      aiPayload.reply,
      aiPayload.keyTerms,
    );
    const aiMessage = this.buildMessage(
      "ai",
      aiPayload.reply,
      session.targetLanguage,
      session.nativeLanguage,
      {
        meta: {
          score: aiPayload.score,
          scoreReason: aiPayload.scoreReason,
          pronunciationTip: aiPayload.pronunciationTip || undefined,
          rhythmTip: aiPayload.rhythmTip || undefined,
          grammarTip: aiPayload.grammarTip || undefined,
          keyTerms: normalizedKeyTerms,
        },
      },
    );
    session.messages.push(aiMessage);
    session.coach = this.buildCoachNote(aiPayload);
    session.updatedAt = new Date().toISOString();

    await this.persistSession(session);
    this.broadcastSession(session);
    this.prewarmConversationUiArtifacts(
      session,
      session.nativeLanguage === LanguageCode.English ? "en" : "zh",
    );

    this.translateForNativeLanguage(
      aiPayload.reply,
      session.targetLanguage,
      session.nativeLanguage ?? LanguageCode.Mandarin,
    )
      .then(async (translationText) => {
        if (translationText) {
          aiMessage.meta = { ...aiMessage.meta, translation: translationText };
          await this.persistSession(session);
          this.broadcastSession(session);
        }
      })
      .catch((error) => {
        this.logger.warn(
          `Background translation failed after image analysis: ${
            (error as Error).message
          }`,
        );
      });

    this.achievementService.queueUserProgressSync(userId);
    return session;
  }

  async generateScenarioHint(
    conversationId: string,
    kind: "hint" | "nudge",
    userId?: string,
    conversationKey?: string,
  ): Promise<{
    kind: "hint" | "nudge";
    message: string;
    translation?: string;
  }> {
    const session = await this.getAccessibleSession(conversationId, {
      userId,
      conversationKey,
      bindUserIfAuthenticated: true,
    });
    const nativeLanguage = session.nativeLanguage ?? LanguageCode.Mandarin;
    const targetLanguage = session.targetLanguage;
    const userTurns = session.messages.filter(
      (message) => message.sender === "user",
    ).length;
    const lastAiMessage = [...session.messages]
      .reverse()
      .find((message) => message.sender === "ai");
    const lastUserMessage = [...session.messages]
      .reverse()
      .find((message) => message.sender === "user");

    if (kind === "nudge") {
      const [primaryPhrase, secondaryPhrase] =
        this.buildScenarioAssociativePhrases(
          targetLanguage,
          session.scenarioId,
        );
      const candidates = buildDynamicScenarioGuidance({
        primaryPhrase,
        secondaryPhrase,
        nativeLanguage,
        lastAiText: lastAiMessage?.text,
        lastUserText: lastUserMessage?.text,
      });
      const candidate =
        candidates[userTurns % candidates.length] ??
        this.buildScenarioAssociativePhrases(
          targetLanguage,
          session.scenarioId,
        )[0];
      const translation =
        targetLanguage === nativeLanguage
          ? undefined
          : await this.translateForNativeLanguage(
              candidate,
              targetLanguage,
              nativeLanguage,
            );
      return {
        kind,
        message: candidate,
        translation,
      };
    }

    const hintMessage = buildScenarioHintMessage({
      scenarioId: session.scenarioId,
      targetLanguage,
      nativeLanguage,
      userTurns,
      lastAiText: lastAiMessage?.text,
      lastUserText: lastUserMessage?.text,
    });

    return {
      kind,
      message: hintMessage,
    };
  }

  async getSession(conversationId: string): Promise<ConversationSession> {
    const cached = this.sessions.get(conversationId);
    if (cached) {
      return cached;
    }

    const cachedSnapshot = await this.sessionCache.getSession(conversationId);
    if (cachedSnapshot) {
      this.sessions.set(cachedSnapshot.id, cachedSnapshot);
      return cachedSnapshot;
    }

    if (this.prisma.canUseDatabase()) {
      let record: {
        id: string;
        scenarioId: string;
        targetLanguage: string;
        nativeLanguage: string | null;
        accessKey: string | null;
        messages: Prisma.JsonValue;
        score: number | null;
        title?: string | null;
        status?: string | null;
        createdAt: Date;
        updatedAt: Date;
        userId?: string | null;
      } | null = null;
      try {
        record = await this.prisma.conversation.findUnique({
          where: { id: conversationId },
        });
      } catch (error) {
        if (this.isMissingUserColumnError(error)) {
          this.logMissingUserColumnWarning();
          record = null;
        } else {
          throw error;
        }
      }
      if (record) {
        const persistedMessages = Array.isArray(record.messages)
          ? (record.messages as unknown as ConversationMessage[])
          : [];
        const rehydrated: ConversationSession = {
          id: record.id,
          scenarioId: record.scenarioId,
          targetLanguage: record.targetLanguage as LanguageCode,
          nativeLanguage:
            (record.nativeLanguage as LanguageCode) ?? LanguageCode.Mandarin,
          accessKey: record.accessKey ?? undefined,
          userId: record.userId ?? undefined,
          title: record.title ?? undefined,
          status: record.status ?? "active",
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
          messages: persistedMessages,
          coach: record.score
            ? {
                correction: "",
                cultureNote: "",
                associativePhrases: [],
                overallScore: record.score,
              }
            : undefined,
        };
        this.sessions.set(rehydrated.id, rehydrated);
        await this.sessionCache.setSession(rehydrated);
        return rehydrated;
      }
    }

    throw new NotFoundException(`Conversation ${conversationId} not found`);
  }

  async getAccessibleSession(
    conversationId: string,
    options: SessionAccessOptions = {},
  ): Promise<ConversationSession> {
    const session = await this.getSession(conversationId);
    return this.authorizeSessionAccess(session, options);
  }

  streamSession(conversationId: string): Observable<ConversationSession> {
    return this.getOrCreateStream(conversationId).asObservable();
  }

  listCachedSessions(): ConversationSession[] {
    return Array.from(this.sessions.values());
  }

  private buildSystemWelcome(
    scenarioId: string,
    targetLanguage: LanguageCode,
    nativeLanguage: LanguageCode,
    timestamp: string,
  ): ConversationMessage {
    const title = this.describeScenario(scenarioId, nativeLanguage);
    const targetLabel = this.describeLanguage(targetLanguage, nativeLanguage);
    const nativeLabel = this.describeLanguage(nativeLanguage, nativeLanguage);
    const welcomeText = buildWelcomeCopy({
      scenarioId,
      title,
      targetLabel,
      nativeLabel,
      nativeLanguage,
    });
    return this.buildMessage(
      "ai",
      welcomeText,
      targetLanguage,
      nativeLanguage,
      {
        createdAt: timestamp,
      },
    );
  }

  /**
   * Generate a concise title from the first user message snippet, prefixed with target language.
   */
  private summarizeTitle(
    text: string,
    targetLanguage?: LanguageCode,
    nativeLanguage?: LanguageCode,
    scenarioId = "daily",
  ): string {
    const snippet = this.extractTitleSnippet(text);
    if (!snippet) {
      return this.buildConversationTitle(
        this.describeScenario(scenarioId, nativeLanguage),
        targetLanguage,
        nativeLanguage,
      );
    }
    const truncated = this.truncateTitleSnippet(
      snippet,
      targetLanguage ? 10 : 15,
      targetLanguage ? 20 : 30,
    );
    return this.buildConversationTitle(
      truncated,
      targetLanguage,
      nativeLanguage,
    );
  }

  private extractTitleSnippet(text: string): string {
    const normalized = text
      .replace(/[\n\r]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) {
      return "";
    }
    const firstSegment =
      normalized
        .split(/[。！？!?；;，,]/)
        .map((segment) => segment.trim())
        .find((segment) => segment.length > 0) ?? normalized;
    return firstSegment
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private truncateTitleSnippet(
    snippet: string,
    cjkLimit: number,
    latinLimit: number,
  ): string {
    if (!snippet) {
      return snippet;
    }
    const cjkRatio =
      (snippet.match(
        /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g,
      )?.length ?? 0) / snippet.length;
    if (cjkRatio > 0.3) {
      return snippet.length > cjkLimit
        ? `${snippet.slice(0, cjkLimit)}…`
        : snippet;
    }
    if (snippet.length <= latinLimit) {
      return snippet;
    }
    const words = snippet.split(/\s+/);
    let result = "";
    for (const word of words) {
      const next = `${result} ${word}`.trim();
      if (next.length > latinLimit - 1) {
        break;
      }
      result = next;
    }
    return result ? `${result}…` : `${snippet.slice(0, latinLimit - 1)}…`;
  }

  private buildConversationTitle(
    title: string,
    targetLanguage?: LanguageCode,
    nativeLanguage?: LanguageCode,
  ): string {
    if (!title) {
      return title;
    }
    if (!targetLanguage) {
      return title;
    }
    const resolvedNative = nativeLanguage ?? LanguageCode.Mandarin;
    const languageLabel = this.describeLanguage(targetLanguage, resolvedNative);
    const separator = resolvedNative === LanguageCode.English ? ": " : "｜";
    if (title.startsWith(`${languageLabel}${separator}`)) {
      return title;
    }
    return `${languageLabel}${separator}${title}`;
  }

  private describeScenario(
    scenarioId: string,
    nativeLanguage?: LanguageCode,
  ): string {
    return resolveScenarioTitle(scenarioId, nativeLanguage);
  }

  private describeLanguage(
    language: LanguageCode,
    nativeLanguage: LanguageCode,
  ): string {
    return resolveLanguageLabel(language, nativeLanguage);
  }

  private async requestChatModelAi(
    session: ConversationSession,
    turn: TutorTurnInput,
    interactionMode: TutorInteractionMode,
    options: {
      model: string;
      timeoutMs: number;
      label: string;
      enableThinking?: boolean;
      preferJson?: boolean;
    },
  ): Promise<AiResponse | null> {
    const route = resolveChatModelRoute(options.model);
    if (!route) {
      if (options.label === "primary") {
        this.logger.warn(CONVERSATION_LOG_COPY.missingPrimaryConfig);
      }
      return null;
    }
    if (turn.requiresVision && isDeepSeekModel(route.model)) {
      return null;
    }

    const history = session.messages
      .slice(-CONVERSATION_DEFAULTS.historyWindow)
      .map((entry) => ({
        role: entry.sender === "ai" ? "assistant" : "user",
        content: entry.text,
      }));

    const prompt = isDeepSeekModel(route.model)
      ? this.buildFallbackProviderPrompt({
          scenarioId: session.scenarioId,
          targetLanguage: session.targetLanguage,
          nativeLanguage: session.nativeLanguage ?? LanguageCode.Mandarin,
          scenarioLabel: this.describeScenario(
            session.scenarioId,
            session.nativeLanguage,
          ),
          interactionMode,
        })
      : buildConversationSystemPrompt({
          scenarioId: session.scenarioId,
          targetLanguage: session.targetLanguage,
          nativeLanguage: session.nativeLanguage ?? LanguageCode.Mandarin,
          scenarioLabel: this.describeScenario(
            session.scenarioId,
            session.nativeLanguage,
          ),
          interactionMode,
        });
    const promptWithMemory = this.appendMemoryPackToPrompt(
      turn.promptAddition?.trim()
        ? `${prompt}\n${turn.promptAddition.trim()}`
        : prompt,
      session,
      interactionMode,
    );
    const useThinking =
      Boolean(options.enableThinking) && supportsThinkingToggle(route.model);
    const useJsonMode =
      Boolean(options.preferJson) &&
      !useThinking &&
      supportsJsonObjectResponse(route.model);

    const payload: Record<string, unknown> = {
      model: route.model,
      temperature: isDeepSeekModel(route.model)
        ? 0.55
        : useThinking
          ? 0.35
          : CONVERSATION_DEFAULTS.openAiTemperature,
      stream: false,
      messages: [
        {
          role: "system",
          content: this.appendModelOutputGuard(promptWithMemory, {
            model: route.model,
            useThinking,
            useJsonMode,
          }),
        },
        ...history,
        { role: "user", content: turn.userContent },
      ],
    };
    applyThinkingToggle(payload, route.model, useThinking);
    if (useJsonMode) {
      payload.response_format = { type: "json_object" };
    }

    this.logger.log(
      `Tutor request (${options.label}) -> ${route.endpoint} | provider=${route.provider} | model=${route.model} | thinking=${useThinking ? "on" : "off"} | json=${useJsonMode ? "on" : "off"} | timeout=${options.timeoutMs}ms`,
    );

    try {
      const content = await this.fetchChatCompletionContentWithTimeout(
        route.endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${route.apiKey}`,
          },
          body: JSON.stringify(payload),
        },
        options.timeoutMs,
      );

      if (!content) {
        return null;
      }

      const parsed = this.parseAiResponseContent(
        content,
        isDeepSeekModel(route.model)
          ? CONVERSATION_LOG_COPY.fallbackReason
          : CONVERSATION_LOG_COPY.primaryFallbackReason,
        session.targetLanguage,
      );

      if (parsed) {
        return isDeepSeekModel(route.model)
          ? this.enrichFallbackTeachingTips(
              parsed,
              session.targetLanguage,
              session.nativeLanguage ?? LanguageCode.Mandarin,
              interactionMode,
              session.scenarioId,
              turn.latestMessageText,
            )
          : parsed;
      }

      return this.buildAiResponseFromPlainText(
        content,
        session.targetLanguage,
        session.nativeLanguage ?? LanguageCode.Mandarin,
        interactionMode,
        session.scenarioId,
        turn.latestMessageText,
      );
    } catch (error) {
      if (this.isAbortError(error)) {
        this.logger.warn(
          `Tutor request ${options.label} timed out after ${options.timeoutMs}ms.`,
        );
        return null;
      }
      this.logger.error(
        `Tutor request ${options.label} failed: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async requestTieredTutorReply(
    session: ConversationSession,
    turn: TutorTurnInput,
    interactionMode: TutorInteractionMode,
  ): Promise<AiResponse | null> {
    const primaryModel = envConfig.modelRouting.primaryModel.trim();
    const secondaryModel = envConfig.modelRouting.secondaryModel.trim();
    const thirdModel = envConfig.modelRouting.thirdModel.trim();
    const attempts: Array<{
      label: string;
      model: string;
      timeoutMs: number;
      enableThinking?: boolean;
      preferJson?: boolean;
    }> = [];

    const enqueueAttempt = (
      label: string,
      model: string,
      timeoutMs: number,
      options?: { enableThinking?: boolean; preferJson?: boolean },
    ) => {
      if (!model) {
        return;
      }
      attempts.push({
        label,
        model,
        timeoutMs,
        enableThinking: options?.enableThinking,
        preferJson: options?.preferJson,
      });
    };

    enqueueAttempt(
      "primary-quality",
      primaryModel,
      envConfig.modelTimeoutMs.primary,
      {
        preferJson: true,
      },
    );
    enqueueAttempt(
      "secondary-fast",
      secondaryModel,
      envConfig.modelTimeoutMs.secondary,
      {
        preferJson: true,
      },
    );
    enqueueAttempt(
      "third-fallback",
      thirdModel,
      envConfig.modelTimeoutMs.third,
      {
        preferJson: true,
      },
    );

    for (const attempt of attempts) {
      const payload = await this.requestChatModelAi(
        session,
        turn,
        interactionMode,
        {
          model: attempt.model,
          timeoutMs: attempt.timeoutMs,
          label: attempt.label,
          enableThinking: attempt.enableThinking,
          preferJson: attempt.preferJson,
        },
      );
      if (payload) {
        return payload;
      }
    }

    return null;
  }

  private parseAiResponseContent(
    content: string,
    fallbackReason: string,
    targetLanguage: LanguageCode,
  ): AiResponse | null {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      this.logger.warn(CONVERSATION_LOG_COPY.fallbackPayloadMissingJson);
      return null;
    }
    try {
      const parsed = JSON.parse(content.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
      const normalized = normalizeAiResponsePayload(parsed, {
        fallbackReason,
        targetLanguage,
      });
      if (!normalized) {
        this.logger.warn(CONVERSATION_LOG_COPY.fallbackPayloadNormalizeFailed);
      }
      return normalized;
    } catch (error) {
      this.logger.warn(
        `Failed to parse AI response JSON: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private appendModelOutputGuard(
    prompt: string,
    options: { model: string; useThinking: boolean; useJsonMode: boolean },
  ): string {
    if (isQwenModel(options.model)) {
      if (options.useThinking) {
        return [
          prompt,
          "",
          "QWEN OUTPUT RULES:",
          "- You may use internal thinking, but the final visible answer must be exactly one valid JSON object.",
          "- Do not output analysis, markdown, code fences, or any text outside the JSON object.",
        ].join("\n");
      }
      if (options.useJsonMode) {
        return [
          prompt,
          "",
          "QWEN JSON OUTPUT RULES:",
          "- Output exactly one valid JSON object that matches the schema above.",
          "- The final answer must be pure JSON and must not contain markdown fences such as ```json.",
        ].join("\n");
      }
    }
    return prompt;
  }

  private buildFallbackProviderPrompt(input: {
    scenarioId: string;
    targetLanguage: LanguageCode;
    nativeLanguage: LanguageCode;
    scenarioLabel: string;
    interactionMode: TutorInteractionMode;
  }): string {
    const basePrompt = buildConversationSystemPrompt(input);
    const nativeLabel = this.describeLanguage(
      input.nativeLanguage,
      input.nativeLanguage,
    );
    const targetLabel = this.describeLanguage(
      input.targetLanguage,
      input.nativeLanguage,
    );
    const modeSpecificRules: string[] =
      input.interactionMode === "voice"
        ? [
            "- voice mode: keep reply to 1-2 short spoken sentences in target language.",
            "- voice mode: include one concise coaching point; avoid textbook style.",
          ]
        : input.interactionMode === "text"
          ? [
              "- text mode: reply must be a natural target-language response only, with no section titles or numbered study steps.",
              "- text mode: put learning guidance in correction / scoreReason / pronunciationTip / rhythmTip / grammarTip, not inside reply.",
            ]
          : input.interactionMode === "review"
            ? [
                "- review mode: include one concise error recap and one replacement expression.",
              ]
            : [
                "- immersive mode: keep response short, natural, and momentum-driven.",
              ];
    return [
      basePrompt,
      "",
      "DEEPSEEK FALLBACK QUALITY GUARD:",
      `- Learner native language: ${nativeLabel}; target language: ${targetLabel}.`,
      `- Scenario key: ${input.scenarioId}.`,
      `- Scenario focus: ${input.scenarioLabel}. Keep teaching tied to this scenario.`,
      "- Return ONLY one valid JSON object.",
      "- Keep reply practical and natural for this exact scenario, not generic.",
      "- reply should include one scenario-fit expression and one forward-moving line.",
      "- Always include at least one concrete correction and at least one pronunciation/grammar tip.",
      "- pronunciationTip, rhythmTip, grammarTip must be short and actionable.",
      "- cultureNote should explain one context-specific usage point in learner native language.",
      "- associativePhrases must be scenario-relevant and reusable in the next turn.",
      ...modeSpecificRules,
      "- Avoid empty strings, avoid markdown, avoid extra commentary outside JSON.",
    ].join("\n");
  }

  private enrichFallbackTeachingTips(
    payload: AiResponse,
    targetLanguage: LanguageCode,
    nativeLanguage: LanguageCode,
    interactionMode: TutorInteractionMode,
    scenarioId: string,
    latestMessage: string,
  ): AiResponse {
    const fallback = buildDefaultTeachingTips({
      targetLanguage,
      nativeLanguage,
      interactionMode,
      scenarioId,
    });
    return {
      ...payload,
      reply: ensureScenarioTeachingReply({
        reply: payload.reply,
        targetLanguage,
        scenarioId,
        latestMessage,
      }),
      correction: payload.correction?.trim() || fallback.correction,
      cultureNote: payload.cultureNote?.trim() || fallback.cultureNote,
      pronunciationTip:
        payload.pronunciationTip?.trim() || fallback.pronunciationTip,
      rhythmTip: payload.rhythmTip?.trim() || fallback.rhythmTip,
      grammarTip: payload.grammarTip?.trim() || fallback.grammarTip,
    };
  }

  private buildAiResponseFromPlainText(
    content: string,
    targetLanguage: LanguageCode,
    nativeLanguage: LanguageCode,
    interactionMode: TutorInteractionMode,
    scenarioId: string,
    latestMessage: string,
  ): AiResponse | null {
    const plain = content.trim();
    if (!plain) {
      return null;
    }
    const fallbackTips = buildDefaultTeachingTips({
      targetLanguage,
      nativeLanguage,
      interactionMode,
      scenarioId,
    });
    return AiResponseSchema.parse({
      reply: ensureScenarioTeachingReply({
        reply: plain,
        targetLanguage,
        scenarioId,
        latestMessage,
      }),
      correction: fallbackTips.correction,
      cultureNote: fallbackTips.cultureNote,
      associativePhrases: this.buildScenarioAssociativePhrases(
        targetLanguage,
        scenarioId,
      ),
      score: CONVERSATION_DEFAULTS.fallbackScore,
      scoreReason:
        nativeLanguage === LanguageCode.English
          ? FALLBACK_SCORE_REASON.en
          : FALLBACK_SCORE_REASON.zh,
      pronunciationTip: fallbackTips.pronunciationTip,
      rhythmTip: fallbackTips.rhythmTip,
      grammarTip: fallbackTips.grammarTip,
      keyTerms: [],
    });
  }

  private buildScenarioAssociativePhrases(
    targetLanguage: LanguageCode,
    scenarioId: string,
  ): [string, string] {
    return resolveFallbackAssociativePhrases(targetLanguage, scenarioId);
  }

  private enrichPayloadForInteractionMode(
    payload: AiResponse,
    interactionMode: TutorInteractionMode,
    targetLanguage: LanguageCode,
    nativeLanguage: LanguageCode,
    scenarioId: string,
    fastTips?: ConversationFastTipPayload,
  ): AiResponse {
    if (interactionMode === "voice") {
      const fallbackTips = buildDefaultTeachingTips({
        targetLanguage,
        nativeLanguage,
        interactionMode: "voice",
        scenarioId,
      });
      const voiceTips = ensureVoiceTipSet(
        {
          pronunciationTip: payload.pronunciationTip ?? fastTips?.pronunciationTip,
          rhythmTip: payload.rhythmTip ?? fastTips?.rhythmTip,
          grammarTip: payload.grammarTip ?? fastTips?.grammarTip,
        },
        {
          pronunciationTip:
            fastTips?.pronunciationTip?.trim() || fallbackTips.pronunciationTip,
          rhythmTip: fastTips?.rhythmTip?.trim() || fallbackTips.rhythmTip,
          grammarTip: fastTips?.grammarTip?.trim() || fallbackTips.grammarTip,
        },
        nativeLanguage,
        {
          scenarioId,
        },
      );
      return {
        ...payload,
        ...voiceTips,
      };
    }

    if (interactionMode !== "text") {
      return payload;
    }
    const fallbackTips = buildDefaultTeachingTips({
      targetLanguage,
      nativeLanguage,
      interactionMode: "text",
      scenarioId,
    });
    return {
      ...payload,
      reply: this.stripTextTeachingScaffold(payload.reply),
      correction:
        payload.correction?.trim() ||
        fastTips?.correction?.trim() ||
        fallbackTips.correction,
      cultureNote:
        payload.cultureNote?.trim() ||
        fastTips?.cultureNote?.trim() ||
        fallbackTips.cultureNote,
      pronunciationTip:
        payload.pronunciationTip?.trim() ||
        fastTips?.pronunciationTip?.trim() ||
        fallbackTips.pronunciationTip,
      rhythmTip:
        payload.rhythmTip?.trim() ||
        fastTips?.rhythmTip?.trim() ||
        fallbackTips.rhythmTip,
      grammarTip:
        payload.grammarTip?.trim() ||
        fastTips?.grammarTip?.trim() ||
        fallbackTips.grammarTip,
    };
  }

  private appendMemoryPackToPrompt(
    basePrompt: string,
    session: ConversationSession,
    interactionMode: TutorInteractionMode,
  ): string {
    const memoryPack = buildConversationMemoryPack({
      session,
      interactionMode,
      scenarioLabel: this.describeScenario(
        session.scenarioId,
        session.nativeLanguage,
      ),
      nativeLanguage: session.nativeLanguage ?? LanguageCode.Mandarin,
    });
    if (!memoryPack.trim()) {
      return basePrompt;
    }
    return `${basePrompt}\n\n${memoryPack}`;
  }

  private stripTextTeachingScaffold(reply: string): string {
    const normalized = reply.trim();
    if (!normalized) {
      return normalized;
    }
    const structuredIndex = normalized.search(
      /(\n|^)\s*(学习建议|Study Steps)[:：]/i,
    );
    const numberedIndex = normalized.search(/(\n|^)\s*1[).]\s+/);
    const cutIndex =
      structuredIndex >= 0 && numberedIndex >= 0
        ? Math.min(structuredIndex, numberedIndex)
        : Math.max(structuredIndex, numberedIndex);
    const cleaned =
      cutIndex >= 0 ? normalized.slice(0, cutIndex).trim() : normalized;
    const compact = cleaned.replace(/\n{3,}/g, "\n\n").trim();
    if (compact) {
      return compact;
    }
    return (
      normalized
        .split(/\n+/)
        .map((line) => line.trim())
        .find(
          (line) =>
            line &&
            !/^(学习建议|Study Steps)[:：]?$/i.test(line) &&
            !/^\d+[).]/.test(line),
        ) ?? normalized
    );
  }

  private async translateForNativeLanguage(
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
  ): Promise<string | undefined> {
    if (sourceLanguage === targetLanguage) {
      return text;
    }
    try {
      const record = await this.translation.translate({
        text,
        sourceLanguage,
        targetLanguage,
      });
      return record.translatedText;
    } catch (error) {
      this.logger.warn(
        `Failed to translate AI reply: ${(error as Error).message}`,
      );
      return undefined;
    }
  }

  private composeAiResponse(
    message: string,
    language: LanguageCode,
    scenarioId: string,
  ): AiResponse {
    const polite = message || "（等待输入）";
    const normalizedLength = polite.replace(/\s+/g, "").length;
    const hasQuestion = /[?？]/.test(polite);
    const detailBonus =
      normalizedLength >= 18 ? 8 : normalizedLength >= 10 ? 4 : 0;
    const questionBonus = hasQuestion ? 4 : 0;
    const score = Math.max(
      48,
      Math.min(
        82,
        50 + detailBonus + questionBonus + Math.round(normalizedLength / 12),
      ),
    );

    const tips = buildDefaultTeachingTips({
      targetLanguage: language,
      nativeLanguage: LanguageCode.Mandarin,
      interactionMode: "text",
      scenarioId,
    });
    return AiResponseSchema.parse({
      reply: ensureScenarioTeachingReply({
        reply: this.buildReply(polite, language, scenarioId),
        targetLanguage: language,
        scenarioId,
        latestMessage: polite,
      }),
      correction: tips.correction,
      cultureNote: tips.cultureNote,
      associativePhrases: this.buildScenarioAssociativePhrases(
        language,
        scenarioId,
      ),
      score,
      scoreReason: FALLBACK_PLAIN_REPLY_SCORE_REASON,
      pronunciationTip: tips.pronunciationTip,
      rhythmTip: tips.rhythmTip,
      grammarTip: tips.grammarTip,
      keyTerms: [],
    });
  }

  private buildReply(
    message: string,
    language: LanguageCode,
    scenarioId: string,
  ): string {
    return buildFallbackReplyCopy(message, language, scenarioId);
  }

  private normalizeKeyTerms(reply: string, keyTerms: KeyTerm[]): KeyTerm[] {
    if (!keyTerms?.length) {
      return [];
    }
    const normalizedReply = reply.toLowerCase();
    const seen = new Set<string>();
    return keyTerms
      .map((term) => {
        const normalizedTerm = term.term.trim();
        const normalizedDefinition = term.definition.trim();
        if (!normalizedTerm || !normalizedDefinition) {
          return null;
        }
        const normalizedExamples = (term.examples ?? [])
          .map((example) => example.trim())
          .filter((example) => example.length > 0);
        const normalizedType = term.type?.trim();
        return {
          term: normalizedTerm,
          definition: normalizedDefinition,
          examples: normalizedExamples,
          ...(normalizedType ? { type: normalizedType } : {}),
        };
      })
      .filter((term): term is KeyTerm => term !== null)
      .filter((term) => this.isTermInReply(reply, normalizedReply, term.term))
      .filter((term) => {
        const key = term.term.toLowerCase();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, 5);
  }

  private isTermInReply(
    reply: string,
    normalizedReply: string,
    term: string,
  ): boolean {
    if (this.isCjk(term)) {
      return reply.includes(term);
    }
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    return regex.test(normalizedReply);
  }

  private isCjk(text: string): boolean {
    return /[\u4e00-\u9fff]/.test(text);
  }

  private async storeConversationImage(
    conversationId: string,
    buffer: Buffer,
    mimeType: string,
    originalName?: string,
  ): Promise<{ fileName: string; mimeType: string }> {
    const directory = join(CONVERSATION_IMAGE_STORAGE_ROOT, conversationId);
    await mkdir(directory, { recursive: true });
    const extension = this.resolveImageExtension(mimeType, originalName);
    const fileName = `img-${Date.now()}-${randomUUID()}${extension}`;
    await writeFile(join(directory, fileName), buffer);
    return {
      fileName,
      mimeType: this.normalizeImageMimeType(mimeType, extension),
    };
  }

  async openImageStream(
    conversationId: string,
    fileName: string,
    userId?: string,
    conversationKey?: string,
  ): Promise<{
    stream: ReturnType<typeof createReadStream>;
    mimeType: string;
  }> {
    await this.getAccessibleSession(conversationId, {
      userId,
      conversationKey,
      allowBootstrapMissingAccessKey: true,
    });
    const safeFileName = basename(fileName);
    const filePath = join(
      CONVERSATION_IMAGE_STORAGE_ROOT,
      conversationId,
      safeFileName,
    );
    await access(filePath);
    return {
      stream: createReadStream(filePath),
      mimeType: this.normalizeImageMimeType(undefined, extname(safeFileName)),
    };
  }

  private buildImageReference(
    conversationId: string,
    fileName: string,
  ): string {
    return `/api/conversation/${conversationId}/image/${fileName}`;
  }

  private async removeConversationStorage(directory: string): Promise<void> {
    try {
      await rm(directory, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(
        `Failed to clean conversation storage ${directory}: ${
          (error as Error).message
        }`,
      );
    }
  }

  private resolveImageExtension(
    mimeType?: string,
    originalName?: string,
  ): string {
    const normalizedMime = mimeType?.trim().toLowerCase();
    if (normalizedMime === "image/png") {
      return ".png";
    }
    if (normalizedMime === "image/webp") {
      return ".webp";
    }
    if (normalizedMime === "image/gif") {
      return ".gif";
    }
    if (originalName) {
      const originalExtension = extname(originalName).toLowerCase();
      if (originalExtension) {
        return originalExtension;
      }
    }
    return ".jpg";
  }

  private normalizeImageMimeType(
    mimeType?: string,
    extension?: string,
  ): string {
    const normalizedMime = mimeType?.trim().toLowerCase();
    if (normalizedMime?.startsWith("image/")) {
      return normalizedMime;
    }
    if (extension === ".png") {
      return "image/png";
    }
    if (extension === ".webp") {
      return "image/webp";
    }
    if (extension === ".gif") {
      return "image/gif";
    }
    return "image/jpeg";
  }

  private buildDefaultImageQuestion(
    targetLanguage: LanguageCode,
    nativeLanguage: LanguageCode,
  ): string {
    if (nativeLanguage === LanguageCode.English) {
      return `What is this in ${resolveLanguageLabel(targetLanguage, nativeLanguage)}? Please teach me how to say and use it.`;
    }
    if (nativeLanguage === LanguageCode.Cantonese) {
      return `呢樣嘢用${resolveLanguageLabel(targetLanguage, nativeLanguage)}點講？可唔可以教我點讀同點用？`;
    }
    return `这个东西用${resolveLanguageLabel(targetLanguage, nativeLanguage)}怎么说？请教我怎么读、怎么用。`;
  }

  private composeVisionFallbackResponse(
    targetLanguage: LanguageCode,
    nativeLanguage: LanguageCode,
    learnerText?: string,
  ): AiResponse {
    const tips = buildDefaultTeachingTips({
      targetLanguage,
      nativeLanguage,
      interactionMode: "text",
      scenarioId: "daily",
    });
    const reply =
      nativeLanguage === LanguageCode.English
        ? "I cannot read the image clearly this time, but you can retry with a sharper photo and simpler background."
        : nativeLanguage === LanguageCode.Cantonese
          ? "今次張圖未夠清晰，不過你可以換一張更清楚、背景更簡單嘅相再試。"
          : "这次图片还不够清晰，不过你可以换一张更清楚、背景更简单的照片再试。";
    return AiResponseSchema.parse({
      reply,
      correction: learnerText?.trim() || tips.correction,
      cultureNote: tips.cultureNote,
      associativePhrases: this.buildScenarioAssociativePhrases(
        targetLanguage,
        "daily",
      ),
      score: 68,
      scoreReason:
        nativeLanguage === LanguageCode.English
          ? FALLBACK_SCORE_REASON.en
          : FALLBACK_SCORE_REASON.zh,
      pronunciationTip: tips.pronunciationTip,
      rhythmTip: tips.rhythmTip,
      grammarTip: tips.grammarTip,
      keyTerms: [],
    });
  }

  private buildMessage(
    sender: "user" | "ai",
    text: string,
    language: LanguageCode,
    nativeLanguage?: LanguageCode,
    extra?: Partial<ConversationMessage>,
  ): ConversationMessage {
    return {
      id: randomUUID(),
      sender,
      text,
      language,
      createdAt: extra?.createdAt ?? new Date().toISOString(),
      senderName: resolveSpeakerName(sender, nativeLanguage),
      avatar: sender === "ai" ? this.avatars.ai : this.avatars.user,
      meta: extra?.meta,
    };
  }

  private buildCoachNote(aiPayload: AiResponse): ConversationCoachNote {
    return {
      correction: aiPayload.correction,
      cultureNote: aiPayload.cultureNote,
      associativePhrases: aiPayload.associativePhrases,
      overallScore: aiPayload.score,
    };
  }

  private resolveInteractionMode(
    requestedMode?: TutorInteractionMode,
    messageMeta?: ConversationMessage["meta"],
  ): TutorInteractionMode {
    if (requestedMode) {
      return requestedMode;
    }
    if (messageMeta?.audioUrl || messageMeta?.source === "realtime") {
      return "voice";
    }
    return "text";
  }

  private createConversationAccessKey(): string {
    return randomUUID().replace(/-/g, "");
  }

  private normalizeConversationAccessKey(
    conversationKey?: string,
  ): string | undefined {
    const normalized = conversationKey?.trim();
    return normalized ? normalized : undefined;
  }

  private ensureConversationAccessKey(session: ConversationSession): boolean {
    if (session.accessKey?.trim()) {
      return false;
    }
    session.accessKey = this.createConversationAccessKey();
    return true;
  }

  private hasMatchingConversationAccessKey(
    session: ConversationSession,
    conversationKey?: string,
  ): boolean {
    const normalized = this.normalizeConversationAccessKey(conversationKey);
    return Boolean(
      normalized &&
        session.accessKey?.trim() &&
        normalized === session.accessKey,
    );
  }

  private async authorizeSessionAccess(
    session: ConversationSession,
    options: SessionAccessOptions,
  ): Promise<ConversationSession> {
    const generatedAccessKey = this.ensureConversationAccessKey(session);
    const hasMatchingKey = this.hasMatchingConversationAccessKey(
      session,
      options.conversationKey,
    );
    const shouldBindUser =
      Boolean(options.bindUserIfAuthenticated) &&
      Boolean(options.userId) &&
      !session.userId;

    if (session.userId) {
      const hasUserAccess =
        Boolean(options.userId) && session.userId === options.userId;
      if (!hasUserAccess && !hasMatchingKey) {
        throw new NotFoundException("Conversation not found");
      }
      if (generatedAccessKey) {
        await this.persistSession(session);
      }
      return session;
    }

    const allowBootstrapAccess =
      Boolean(options.allowBootstrapMissingAccessKey) && generatedAccessKey;
    if (!hasMatchingKey && !allowBootstrapAccess) {
      throw new NotFoundException("Conversation not found");
    }

    if (shouldBindUser) {
      session.userId = options.userId;
    }
    if (generatedAccessKey || shouldBindUser) {
      await this.persistSession(session);
    }
    return session;
  }

  private async persistSession(session: ConversationSession): Promise<void> {
    this.prisma.ensurePersistentStorageAvailable();
    this.sessions.set(session.id, session);
    await this.sessionCache.setSession(session);

    if (this.prisma.canUseDatabase()) {
      try {
        await this.prisma.conversation.upsert(
          this.buildConversationUpsertArgs(session, true),
        );
      } catch (error) {
        if (this.isMissingUserColumnError(error)) {
          this.schemaMissingUserColumn = true;
          this.logMissingUserColumnWarning();
          return;
        }
        if (this.isDatabaseConnectionError(error)) {
          this.prisma.markDatabaseUnavailable(
            "Database connection lost (P1001/P1002).",
          );
          return;
        }
        throw error;
      }
    }
  }

  async listByIds(ids: string[], limit = 10) {
    if (!ids.length) {
      return [];
    }
    if (
      !this.prisma.canUseDatabase() &&
      !this.prisma.allowsInMemoryFallback()
    ) {
      this.prisma.ensurePersistentStorageAvailable();
    }
    const safeIds = ids.slice(0, limit);

    // Try database first
    if (this.prisma.canUseDatabase()) {
      let records: Array<{
        id: string;
        scenarioId: string;
        targetLanguage: string;
        nativeLanguage: string | null;
        updatedAt: Date;
        score: number | null;
        title: string | null;
        status: string | null;
        messages: Prisma.JsonValue;
      }> = [];
      try {
        records = await this.prisma.conversation.findMany({
          where: { id: { in: safeIds } },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            scenarioId: true,
            targetLanguage: true,
            nativeLanguage: true,
            updatedAt: true,
            score: true,
            title: true,
            status: true,
            messages: true,
          },
        });
      } catch (error) {
        if (this.isDatabaseConnectionError(error)) {
          this.prisma.markDatabaseUnavailable(
            "Database connection lost (P1001/P1002).",
          );
          if (!this.prisma.allowsInMemoryFallback()) {
            this.prisma.ensurePersistentStorageAvailable();
          }
        } else {
          this.logger.warn(`listByIds failed: ${(error as Error).message}`);
        }
      }
      if (records.length > 0) {
        return records.map((record) => this.toHistorySummary(record));
      }
    }

    // Fallback: resolve from in-memory cache
    if (!this.prisma.allowsInMemoryFallback()) {
      this.prisma.ensurePersistentStorageAvailable();
    }
    const idSet = new Set(safeIds);
    const cached = Array.from(this.sessions.values())
      .filter((s) => idSet.has(s.id))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .slice(0, limit);
    return cached.map((s) => ({
      id: s.id,
      scenarioId: s.scenarioId,
      targetLanguage: s.targetLanguage,
      nativeLanguage: s.nativeLanguage ?? null,
      updatedAt: s.updatedAt,
      score: s.coach?.overallScore ?? undefined,
      title: s.title ?? undefined,
      status: s.status ?? "active",
      lastMessage: s.messages.at(-1)?.text ?? "",
      messageCount: s.messages.length,
    }));
  }

  async listUserHistory(userId: string, limit = 10) {
    if (
      !this.prisma.canUseDatabase() &&
      !this.prisma.allowsInMemoryFallback()
    ) {
      this.prisma.ensurePersistentStorageAvailable();
    }
    if (!this.prisma.canUseDatabase()) {
      return [];
    }
    let records: Array<{
      id: string;
      scenarioId: string;
      targetLanguage: string;
      nativeLanguage: string | null;
      updatedAt: Date;
      score: number | null;
      title: string | null;
      status: string | null;
      messages: Prisma.JsonValue;
    }> = [];
    try {
      records = await this.prisma.conversation.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          scenarioId: true,
          targetLanguage: true,
          nativeLanguage: true,
          updatedAt: true,
          score: true,
          title: true,
          status: true,
          messages: true,
        },
      });
    } catch (error) {
      if (this.isDatabaseConnectionError(error)) {
        this.prisma.markDatabaseUnavailable(
          "Database connection lost (P1001/P1002).",
        );
        if (!this.prisma.allowsInMemoryFallback()) {
          this.prisma.ensurePersistentStorageAvailable();
        }
        return [];
      }
      if (this.isMissingUserColumnError(error)) {
        this.logMissingUserColumnWarning();
        return [];
      }
      throw error;
    }
    return records.map((record) => this.toHistorySummary(record));
  }

  private toHistorySummary(record: {
    id: string;
    scenarioId: string;
    targetLanguage: string;
    nativeLanguage: string | null;
    updatedAt: Date;
    score: number | null;
    title: string | null;
    status: string | null;
    messages: Prisma.JsonValue;
  }) {
    const messages = Array.isArray(record.messages)
      ? (record.messages as unknown as ConversationMessage[])
      : [];
    return {
      id: record.id,
      scenarioId: record.scenarioId,
      targetLanguage: record.targetLanguage as LanguageCode,
      nativeLanguage: record.nativeLanguage as LanguageCode | null,
      updatedAt: record.updatedAt.toISOString(),
      score: record.score ?? undefined,
      title: record.title ?? undefined,
      status: record.status ?? "active",
      lastMessage: messages.at(-1)?.text ?? "",
      messageCount: messages.length,
    };
  }

  async getConversationHistory(
    conversationId: string,
    userId: string,
  ): Promise<ConversationSession> {
    return this.getAccessibleSession(conversationId, {
      userId,
      allowBootstrapMissingAccessKey: true,
    });
  }

  async getSessionSummary(
    conversationId: string,
    userId?: string,
    conversationKey?: string,
    locale?: string,
  ): Promise<SessionSummaryPayload> {
    const session = await this.getAccessibleSession(conversationId, {
      userId,
      conversationKey,
      allowBootstrapMissingAccessKey: true,
    });
    const baseSummary = buildSessionSummary({
      conversationId: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages,
      locale,
    });
    const aiCopy =
      (await this.getCachedOrGenerateSummaryCopy(session, baseSummary, locale)) ??
      {
        headline: baseSummary.headline,
        advice: baseSummary.advice,
      };
    return {
      ...baseSummary,
      ...aiCopy,
    };
  }

  async getConversationQuickReplies(
    conversationId: string,
    userId?: string,
    conversationKey?: string,
    locale?: string,
  ): Promise<ConversationQuickRepliesPayload> {
    const session = await this.getAccessibleSession(conversationId, {
      userId,
      conversationKey,
      allowBootstrapMissingAccessKey: true,
    });
    const options = await this.getCachedOrGenerateQuickReplies(session, locale);
    return {
      conversationId: session.id,
      options,
    };
  }

  private getOrCreateStream(
    conversationId: string,
  ): Subject<ConversationSession> {
    let subject = this.sessionStreams.get(conversationId);
    if (!subject) {
      subject = new Subject<ConversationSession>();
      this.sessionStreams.set(conversationId, subject);
    }
    return subject;
  }

  private broadcastSession(session: ConversationSession): void {
    const stream = this.sessionStreams.get(session.id);
    if (stream) {
      stream.next(session);
    }
  }

  private buildConversationUpsertArgs(
    session: ConversationSession,
    includeUserId: boolean,
  ) {
    const shared = {
      scenarioId: session.scenarioId,
      targetLanguage: session.targetLanguage,
      nativeLanguage: session.nativeLanguage,
      accessKey: session.accessKey,
      messages: session.messages as unknown as Prisma.JsonArray,
      score: session.coach?.overallScore,
      title: session.title,
      status: session.status ?? "active",
    };
    const update = includeUserId
      ? { ...shared, userId: session.userId }
      : shared;
    const create = includeUserId
      ? { ...shared, id: session.id, userId: session.userId }
      : { ...shared, id: session.id };
    return {
      where: { id: session.id },
      update,
      create,
    };
  }

  private isMissingUserColumnError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2022"
    );
  }

  private isDatabaseConnectionError(error: unknown): boolean {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P1001" || error.code === "P1002")
    ) {
      return true;
    }
    const message =
      error instanceof Error
        ? error.message.toLowerCase()
        : String(error).toLowerCase();
    return (
      message.includes("server has closed the connection") ||
      message.includes("connection terminated") ||
      message.includes("connection closed") ||
      message.includes("can't reach database server")
    );
  }

  private logMissingUserColumnWarning(): void {
    if (this.schemaMissingUserColumn) {
      return;
    }
    this.schemaMissingUserColumn = true;
    this.logger.warn(
      "Database schema is missing Conversation.userId/Favorite.userId columns. Run `pnpm --filter server prisma:migrate` to apply the latest Prisma migration.",
    );
  }

  private buildUiArtifactKey(
    kind: "summary" | "quick-replies",
    conversationId: string,
    locale?: string,
  ): string {
    return `${kind}:${conversationId}:${locale === "en" ? "en" : "zh"}`;
  }

  private getMessageCountSignature(session: ConversationSession): number {
    return session.messages.length;
  }

  private prewarmConversationUiArtifacts(
    session: ConversationSession,
    locale?: string,
  ): void {
    const normalizedLocale = locale === "en" ? "en" : "zh";
    const messageCount = this.getMessageCountSignature(session);
    const summary = buildSessionSummary({
      conversationId: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages,
      locale: normalizedLocale,
    });
    void this.ensureUiArtifactInflight(
      this.buildUiArtifactKey("summary", session.id, normalizedLocale),
      async () => {
        const copy = await this.generateAiSessionSummaryCopy(
          session,
          summary,
          normalizedLocale,
        );
        this.summaryCopyCache.set(
          this.buildUiArtifactKey("summary", session.id, normalizedLocale),
          { messageCount, value: copy },
        );
      },
    );
    void this.ensureUiArtifactInflight(
      this.buildUiArtifactKey("quick-replies", session.id, normalizedLocale),
      async () => {
        const options = await this.generateAiQuickReplies(session, normalizedLocale);
        this.quickReplyCache.set(
          this.buildUiArtifactKey("quick-replies", session.id, normalizedLocale),
          { messageCount, value: options },
        );
      },
    );
  }

  private async getCachedOrGenerateSummaryCopy(
    session: ConversationSession,
    summary: SessionSummaryPayload,
    locale?: string,
  ): Promise<Pick<SessionSummaryPayload, "headline" | "advice"> | null> {
    const normalizedLocale = locale === "en" ? "en" : "zh";
    const cacheKey = this.buildUiArtifactKey(
      "summary",
      session.id,
      normalizedLocale,
    );
    const messageCount = this.getMessageCountSignature(session);
    const cached = this.summaryCopyCache.get(cacheKey);
    if (cached && cached.messageCount === messageCount) {
      return cached.value;
    }
    await this.ensureUiArtifactInflight(cacheKey, async () => {
      const value = await this.generateAiSessionSummaryCopy(
        session,
        summary,
        normalizedLocale,
      );
      this.summaryCopyCache.set(cacheKey, { messageCount, value });
    });
    return this.summaryCopyCache.get(cacheKey)?.value ?? null;
  }

  private async getCachedOrGenerateQuickReplies(
    session: ConversationSession,
    locale?: string,
  ): Promise<string[]> {
    const normalizedLocale = locale === "en" ? "en" : "zh";
    const cacheKey = this.buildUiArtifactKey(
      "quick-replies",
      session.id,
      normalizedLocale,
    );
    const messageCount = this.getMessageCountSignature(session);
    const cached = this.quickReplyCache.get(cacheKey);
    if (cached && cached.messageCount === messageCount) {
      return cached.value;
    }
    await this.ensureUiArtifactInflight(cacheKey, async () => {
      const value = await this.generateAiQuickReplies(session, normalizedLocale);
      this.quickReplyCache.set(cacheKey, { messageCount, value });
    });
    return this.quickReplyCache.get(cacheKey)?.value ?? [];
  }

  private async ensureUiArtifactInflight(
    key: string,
    factory: () => Promise<void>,
  ): Promise<void> {
    const existing = this.uiArtifactInflight.get(key);
    if (existing) {
      await existing;
      return;
    }
    const pending = factory()
      .catch((error) => {
        this.logger.warn(
          `UI artifact generation failed for ${key}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      })
      .finally(() => {
        this.uiArtifactInflight.delete(key);
      });
    this.uiArtifactInflight.set(key, pending);
    await pending;
  }

  private async generateFastFeedbackTips(params: {
    session: ConversationSession;
    latestMessageText: string;
    interactionMode: TutorInteractionMode;
  }): Promise<ConversationFastTipPayload | null> {
    const nativeLanguage = params.session.nativeLanguage ?? LanguageCode.Mandarin;
    const systemPrompt =
      nativeLanguage === LanguageCode.English
        ? "You write concise, contextual coaching tips for a language tutor app. Return JSON only."
        : "你负责为语言学习应用生成简洁且贴合上下文的教学提示。只返回 JSON。";
    const transcript = params.session.messages
      .filter((message) => message.sender === "user" || message.sender === "ai")
      .slice(-8)
      .map(
        (message) =>
          `${message.sender === "ai" ? "Tutor" : "Learner"}: ${message.text}`,
      )
      .join("\n");
    const content = await this.requestCompactJsonObject({
      label: "fast-feedback-tips",
      modelCandidates: [
        envConfig.modelRouting.thirdModel,
        envConfig.modelRouting.secondaryModel,
      ],
      timeoutMs: Math.min(envConfig.modelTimeoutMs.third, 1200),
      systemPrompt,
      userPrompt: [
        nativeLanguage === LanguageCode.English
          ? "Return 5 fields: correction, cultureNote, pronunciationTip, rhythmTip, grammarTip."
          : "请返回 5 个字段：correction、cultureNote、pronunciationTip、rhythmTip、grammarTip。",
        nativeLanguage === LanguageCode.English
          ? "All fields must be grounded in this exact conversation and the learner's latest message."
          : "所有字段都必须贴合这段真实对话和学习者刚刚那一句。",
        nativeLanguage === LanguageCode.English
          ? "Do not use generic filler or praise. Keep each tip actionable and specific."
          : "不要空泛鼓励，不要套话，每个提示都要具体可执行。",
        `JSON schema: {"correction":"string","cultureNote":"string","pronunciationTip":"string","rhythmTip":"string","grammarTip":"string"}`,
        `Interaction mode: ${params.interactionMode}`,
        `Latest learner message: ${params.latestMessageText}`,
        "Recent transcript:",
        transcript,
      ].join("\n"),
    });
    const parsed = this.parseCompactJsonObject<ConversationFastTipPayload>(content);
    return parsed ?? null;
  }

  private async resolveFastTipFallback(
    promise: Promise<ConversationFastTipPayload | null>,
  ): Promise<ConversationFastTipPayload | undefined> {
    try {
      return (
        (await Promise.race([
          promise,
          new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), 220);
          }),
        ])) ?? undefined
      );
    } catch {
      return undefined;
    }
  }

  private async generateAiSessionSummaryCopy(
    session: ConversationSession,
    summary: SessionSummaryPayload,
    locale?: string,
  ): Promise<Pick<SessionSummaryPayload, "headline" | "advice">> {
    const isEn = locale === "en";
    const fallback = {
      headline: summary.headline,
      advice: summary.advice,
    };
    const transcript = session.messages
      .filter((message) => message.sender === "user" || message.sender === "ai")
      .slice(-10)
      .map(
        (message) =>
          `${message.sender === "ai" ? "Tutor" : "Learner"}: ${message.text}`,
      )
      .join("\n");
    if (!transcript.trim()) {
      return fallback;
    }

    const content = await this.requestCompactJsonObject({
      label: "summary-copy",
      modelCandidates: [
        envConfig.modelRouting.thirdModel,
        envConfig.modelRouting.secondaryModel,
        envConfig.modelRouting.primaryModel,
      ],
      timeoutMs: Math.min(envConfig.modelTimeoutMs.third, 1600),
      systemPrompt: isEn
        ? "You write premium, concise session summaries for a language learning app. Return JSON only."
        : "你为语言学习应用撰写高级、简洁的会话总结。只返回 JSON。",
      userPrompt: [
        isEn
          ? "Summarize this session in 2 fields: headline and advice."
          : "请用 2 个字段总结这轮会话：headline 和 advice。",
        isEn
          ? "headline: one natural sentence summarizing the learner's real session progress."
          : "headline：1 句自然的话，总结学习者这一轮的真实进展。",
        isEn
          ? "advice: one short sentence with a concrete next step in the user's system language."
          : "advice：1 句简短建议，用用户当前系统语言给出下一步练习方向。",
        isEn
          ? "Ground both fields in the recent transcript, key terms, and actual correction signals."
          : "两个字段都必须落在最近对话、关键词和真实纠错点上。",
        isEn
          ? "Do not write score recaps, generic praise, or vague filler like 'keep practicing'."
          : "不要复述分数，不要空泛鼓励，不要写“继续加油”这类空话。",
        isEn
          ? "If the learner was answering a question, reflect that concrete topic instead of abstract performance labels."
          : "如果学习者是在回应某个具体问题，要写出那个具体话题，不要抽象评价。",
        `JSON schema: {"headline":"string","advice":"string"}`,
        `Session metrics: ${JSON.stringify({
          durationMinutes: summary.durationMinutes,
          userTurns: summary.userTurns,
          aiTurns: summary.aiTurns,
          averageScore: summary.averageScore,
          latestScore: summary.latestScore,
          keyTerms: summary.keyTerms.slice(0, 3),
          improvements: summary.improvements.slice(0, 3),
        })}`,
        "Recent transcript:",
        transcript,
      ].join("\n"),
    });

    const parsed = this.parseCompactJsonObject<{
      headline?: unknown;
      advice?: unknown;
    }>(content);
    const headline =
      typeof parsed?.headline === "string" && parsed.headline.trim()
        ? parsed.headline.trim()
        : fallback.headline;
    const advice =
      typeof parsed?.advice === "string" && parsed.advice.trim()
        ? parsed.advice.trim()
        : fallback.advice;
    return { headline, advice };
  }

  private async generateAiQuickReplies(
    session: ConversationSession,
    locale?: string,
  ): Promise<string[]> {
    const recentMessages = session.messages
      .filter((message) => message.sender === "user" || message.sender === "ai")
      .slice(-8);
    if (!recentMessages.length) {
      return [];
    }
    const transcript = recentMessages
      .map(
        (message) =>
          `${message.sender === "ai" ? "Tutor" : "Learner"}: ${message.text}`,
      )
      .join("\n");
    const lastAiScore = [...session.messages]
      .reverse()
      .find(
        (message) =>
          message.sender === "ai" && typeof message.meta?.score === "number",
      )?.meta?.score;

    const content = await this.requestCompactJsonObject({
      label: "quick-replies",
      modelCandidates: [
        envConfig.modelRouting.thirdModel,
        envConfig.modelRouting.secondaryModel,
        envConfig.modelRouting.primaryModel,
      ],
      timeoutMs: Math.min(envConfig.modelTimeoutMs.third, 1200),
      systemPrompt:
        "You generate smart quick-reply chips for a language tutor app. Return JSON only.",
      userPrompt: [
        "Generate 3 short quick replies for the learner's NEXT turn.",
        `Target language: ${this.describeLanguage(
          session.targetLanguage,
          session.nativeLanguage ?? LanguageCode.Mandarin,
        )}.`,
        `System language: ${locale === "en" ? "English" : "Chinese"}.`,
        `Latest score hint: ${lastAiScore ?? "n/a"}.`,
        "Rules:",
        "- All replies must be in the target language.",
        "- Keep each reply natural, contextual, and under 16 words.",
        "- Do not explain. Do not output labels. Do not output translations.",
        "- Use concrete details or intent from the recent transcript whenever possible.",
        "- Avoid filler like 'let me answer directly first' unless the transcript gives no usable detail.",
        "- Offer variety: one direct reply, one detail-expanding reply, one follow-up style reply.",
        '- JSON schema: {"options":["string","string","string"]}',
        "Recent transcript:",
        transcript,
      ].join("\n"),
    });

    const parsed = this.parseCompactJsonObject<{ options?: unknown }>(content);
    const options = Array.isArray(parsed?.options)
      ? parsed.options
          .filter(
            (item): item is string =>
              typeof item === "string" && Boolean(item.trim()),
          )
          .map((item) => item.trim())
          .slice(0, 3)
      : [];
    return options;
  }

  private async requestCompactJsonObject(params: {
    label: string;
    modelCandidates: string[];
    timeoutMs: number;
    systemPrompt: string;
    userPrompt: string;
  }): Promise<string | null> {
    for (const model of params.modelCandidates) {
      const route = resolveChatModelRoute(model);
      if (!route) {
        continue;
      }
      const payload: Record<string, unknown> = {
        model: route.model,
        temperature: 0.35,
        stream: false,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt },
        ],
      };
      if (supportsJsonObjectResponse(route.model)) {
        payload.response_format = { type: "json_object" };
      }
      try {
        const content = await this.fetchChatCompletionContentWithTimeout(
          route.endpoint,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${route.apiKey}`,
            },
            body: JSON.stringify(payload),
          },
          params.timeoutMs,
        );
        if (content?.trim()) {
          return content;
        }
      } catch (error) {
        if (!this.isAbortError(error)) {
          this.logger.warn(
            `${params.label} compact JSON request failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }
    return null;
  }

  private parseCompactJsonObject<T>(content: string | null): T | null {
    if (!content?.trim()) {
      return null;
    }
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start < 0 || end <= start) {
      return null;
    }
    try {
      return JSON.parse(content.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }

  private async fetchChatCompletionContentWithTimeout(
    input: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text();
        this.logger.warn(
          `Chat completion responded with ${response.status}: ${detail}`,
        );
        return null;
      }

      const raw = (await response.json()) as {
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
      const content = this.extractMessageContent(
        raw.choices?.[0]?.message?.content,
      );
      if (!content?.trim()) {
        this.logger.warn("Chat completion returned empty content.");
        return null;
      }
      return content;
    } finally {
      clearTimeout(timer);
    }
  }

  private extractMessageContent(
    content:
      | string
      | Array<
          | { type?: string; text?: string }
          | { type?: string; input_text?: string }
        >
      | undefined,
  ): string {
    if (typeof content === "string") {
      return content;
    }
    if (!Array.isArray(content)) {
      return "";
    }
    return content
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
  }

  private isAbortError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.name === "AbortError" ||
        (typeof error.message === "string" &&
          error.message.toLowerCase().includes("abort")))
    );
  }
}

const resolveTimestamp = (timestamp?: string): string | undefined => {
  if (!timestamp) {
    return undefined;
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
};

const CONVERSATION_IMAGE_STORAGE_ROOT = join(
  process.cwd(),
  "tmp",
  "conversation-images",
);
const CONVERSATION_VOICE_STORAGE_ROOT = join(
  process.cwd(),
  "tmp",
  "voice-uploads",
);
const MAX_IMAGE_FILE_SIZE_BYTES = 6 * 1024 * 1024;
