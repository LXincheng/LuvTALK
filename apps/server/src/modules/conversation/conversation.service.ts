import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
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
import { UpdateConversationPreferencesDto } from "./dto/update-conversation-preferences.dto";
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

interface RealtimeTranscriptEntry {
  role: "user" | "ai";
  text: string;
  timestamp?: string;
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
      memoryEnabled: true,
      deepThinkingEnabled: false,
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

  async updateSessionPreferences(
    conversationId: string,
    dto: UpdateConversationPreferencesDto,
    userId?: string,
    conversationKey?: string,
  ): Promise<ConversationSession> {
    const session = await this.getAccessibleSession(conversationId, {
      userId,
      conversationKey,
      bindUserIfAuthenticated: true,
    });
    session.memoryEnabled = true;
    if (typeof dto.deepThinkingEnabled === "boolean") {
      session.deepThinkingEnabled = dto.deepThinkingEnabled;
    }
    session.updatedAt = new Date().toISOString();
    await this.persistSession(session);
    this.broadcastSession(session);
    return session;
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

    const interactionMode = this.resolveInteractionMode(
      dto.mode,
      options?.userMessageMeta,
    );
    const rawAiPayload =
      (await this.requestFastestTutorReply(session, trimmed, interactionMode)) ??
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

  async generateScenarioHint(
    conversationId: string,
    kind: "hint" | "nudge",
    userId?: string,
    conversationKey?: string,
  ): Promise<{ kind: "hint" | "nudge"; message: string; translation?: string }> {
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
      const [primaryPhrase, secondaryPhrase] = this.buildScenarioAssociativePhrases(
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
        this.buildScenarioAssociativePhrases(targetLanguage, session.scenarioId)[0];
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
      if (typeof cached.memoryEnabled !== "boolean") {
        cached.memoryEnabled = true;
      }
      if (typeof cached.deepThinkingEnabled !== "boolean") {
        cached.deepThinkingEnabled = false;
      }
      return cached;
    }

    const cachedSnapshot = await this.sessionCache.getSession(conversationId);
    if (cachedSnapshot) {
      if (typeof cachedSnapshot.memoryEnabled !== "boolean") {
        cachedSnapshot.memoryEnabled = true;
      }
      if (typeof cachedSnapshot.deepThinkingEnabled !== "boolean") {
        cachedSnapshot.deepThinkingEnabled = false;
      }
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
          memoryEnabled: true,
          deepThinkingEnabled: false,
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
    latestMessage: string,
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
      prompt,
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
        { role: "user", content: latestMessage },
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
              latestMessage,
            )
          : parsed;
      }

      return this.buildAiResponseFromPlainText(
        content,
        session.targetLanguage,
        session.nativeLanguage ?? LanguageCode.Mandarin,
        interactionMode,
        session.scenarioId,
        latestMessage,
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

  private async requestFastestTutorReply(
    session: ConversationSession,
    latestMessage: string,
    interactionMode: TutorInteractionMode,
  ): Promise<AiResponse | null> {
    const wrapCandidate = (
      task: Promise<AiResponse | null>,
      label: string,
    ): Promise<AiResponse> =>
      task.then((payload) => {
        if (!payload) {
          throw new Error(`${label}_empty`);
        }
        return payload;
      });
    const primaryModel = envConfig.modelRouting.primaryModel.trim();
    const secondaryModel = envConfig.modelRouting.secondaryModel.trim();
    const thirdModel = envConfig.modelRouting.thirdModel.trim();
    const deepThinkingEnabled = session.deepThinkingEnabled === true;
    const candidates: Array<Promise<AiResponse>> = [];

    const enqueueCandidate = (
      label: string,
      model: string,
      timeoutMs: number,
      delayMs: number,
      options?: { enableThinking?: boolean; preferJson?: boolean },
    ) => {
      if (!model) {
        return;
      }
      const run = () =>
        wrapCandidate(
          this.requestChatModelAi(session, latestMessage, interactionMode, {
            model,
            timeoutMs,
            label,
            enableThinking: options?.enableThinking,
            preferJson: options?.preferJson,
          }),
          label,
        );
      if (delayMs <= 0) {
        candidates.push(run());
        return;
      }
      candidates.push(
        new Promise<AiResponse>((resolve, reject) => {
          windowLikeSetTimeout(() => {
            run().then(resolve).catch(reject);
          }, delayMs);
        }),
      );
    };

    if (deepThinkingEnabled) {
      enqueueCandidate("primary-thinking", primaryModel, envConfig.modelTimeoutMs.primary, 0, {
        enableThinking: true,
        preferJson: false,
      });
      enqueueCandidate("secondary-fast", secondaryModel, envConfig.modelTimeoutMs.secondary, 900, {
        preferJson: true,
      });
    } else {
      enqueueCandidate("secondary-fast", secondaryModel, envConfig.modelTimeoutMs.secondary, 0, {
        preferJson: true,
      });
      enqueueCandidate("primary-quality", primaryModel, envConfig.modelTimeoutMs.primary, 220, {
        preferJson: true,
      });
    }
    enqueueCandidate("third-fallback", thirdModel, envConfig.modelTimeoutMs.third, 350, {
      preferJson: true,
    });

    if (!candidates.length) {
      return null;
    }
    try {
      return await Promise.any(candidates);
    } catch {
      return null;
    }
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
          '- The final answer must be pure JSON and must not contain markdown fences such as ```json.',
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
              "- text mode: reply must include target-language conversational response, plus 1-2 numbered native-language study steps.",
              "- text mode: study steps must be specific and immediately actionable.",
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
          pronunciationTip: payload.pronunciationTip,
          rhythmTip: payload.rhythmTip,
          grammarTip: payload.grammarTip,
        },
        {
          pronunciationTip: fallbackTips.pronunciationTip,
          rhythmTip: fallbackTips.rhythmTip,
          grammarTip: fallbackTips.grammarTip,
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
    return {
      ...payload,
      reply: this.ensureStructuredTextTeachingReply(
        payload,
        targetLanguage,
        nativeLanguage,
        scenarioId,
      ),
    };
  }

  private appendMemoryPackToPrompt(
    basePrompt: string,
    session: ConversationSession,
    interactionMode: TutorInteractionMode,
  ): string {
    if (session.memoryEnabled === false) {
      return basePrompt;
    }
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

  private ensureStructuredTextTeachingReply(
    payload: AiResponse,
    targetLanguage: LanguageCode,
    nativeLanguage: LanguageCode,
    scenarioId: string,
  ): string {
    const rawReply = payload.reply.trim();
    const alreadyStructured =
      /(\n|^)\s*(学习建议|Study Steps)[:：]/i.test(rawReply) ||
      /(\n|^)\s*1[).]/.test(rawReply);
    if (alreadyStructured) {
      return rawReply;
    }

    const fallbackTips = buildDefaultTeachingTips({
      targetLanguage,
      nativeLanguage,
      interactionMode: "text",
      scenarioId,
    });
    const stepCandidates = [
      payload.correction,
      payload.grammarTip,
      payload.pronunciationTip,
      payload.rhythmTip,
      payload.cultureNote,
      payload.scoreReason,
      fallbackTips.correction,
      fallbackTips.grammarTip,
    ]
      .map((item) => item?.trim())
      .filter((item): item is string => Boolean(item))
      .filter((item, index, list) => list.indexOf(item) === index);

    const step1 = stepCandidates[0] ?? fallbackTips.correction;
    const step2 = stepCandidates[1] ?? fallbackTips.cultureNote;
    const sectionTitle =
      nativeLanguage === LanguageCode.English ? "Study Steps" : "学习建议";
    return [
      rawReply,
      "",
      `${sectionTitle}:`,
      `1. ${step1}`,
      `2. ${step2}`,
    ].join("\n");
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
    const detailBonus = normalizedLength >= 18 ? 8 : normalizedLength >= 10 ? 4 : 0;
    const questionBonus = hasQuestion ? 4 : 0;
    const score = Math.max(
      48,
      Math.min(82, 50 + detailBonus + questionBonus + Math.round(normalizedLength / 12)),
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

  async listByIds(ids: string[], limit = 20) {
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

  async listUserHistory(userId: string, limit = 20) {
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
    return buildSessionSummary({
      conversationId: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages,
      locale,
    });
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
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P1001" || error.code === "P1002")
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
      const content = this.extractMessageContent(raw.choices?.[0]?.message?.content);
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

const windowLikeSetTimeout = (callback: () => void, delayMs: number) => {
  setTimeout(callback, delayMs);
};
