import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { Observable, Subject } from "rxjs";
import { envConfig } from "../../common/config/env.config";
import {
  buildConversationSystemPrompt,
  TutorInteractionMode,
} from "../../common/config/prompt.config";
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
import { TranslationService } from "../translation/translation.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { StartConversationDto } from "./dto/start-conversation.dto";
import { normalizeAiResponsePayload } from "./ai-response-normalizer";
import {
  buildSessionSummary,
  SessionSummaryPayload,
} from "./conversation-summary.types";

const DEFAULT_MODEL = "deepseek-reasoner";
const DEFAULT_FALLBACK_MODEL = "deepseek-chat";
const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_PRIMARY_TIMEOUT_MS = 3_200;
const DEEPSEEK_FALLBACK_TIMEOUT_MS = 1_800;
const OPENAI_TUTOR_TIMEOUT_MS = 7_000;

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
  private readonly deepSeekEndpoint = this.resolveDeepSeekEndpoint();
  private readonly openAiEndpoint = this.resolveOpenAiEndpoint();

  constructor(
    private readonly prisma: PrismaService,
    private readonly translation: TranslationService,
    private readonly sessionCache: SessionCacheService,
  ) {}

  async startSession(
    dto: StartConversationDto,
    userId?: string,
  ): Promise<ConversationSession> {
    const now = new Date().toISOString();
    const scenarioId = dto.scenarioId ?? "daily";
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
      userId,
      title: this.describeScenario(scenarioId, nativeLanguage),
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
  ): Promise<number> {
    const session = await this.getSession(conversationId);
    if (session.userId && (!userId || session.userId !== userId)) {
      throw new NotFoundException("Conversation not found");
    }
    if (!session.userId && userId) {
      session.userId = userId;
    }

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
          session.nativeLanguage,
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
          return this.getSession(existing.id);
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
        const session = await this.getSession(dto.conversationId);
        // Only resume if the target language matches the request
        if (session.targetLanguage !== dto.targetLanguage) {
          this.logger.log(
            `Language mismatch (session=${session.targetLanguage}, requested=${dto.targetLanguage}), creating new session.`,
          );
        } else {
          // Bind to user if not already bound
          if (!session.userId && userId) {
            session.userId = userId;
            await this.persistSession(session);
          }
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
  ): Promise<void> {
    const session = await this.getSession(conversationId);
    if (session.userId && userId && session.userId !== userId) {
      throw new NotFoundException("Conversation not found");
    }
    session.status = "archived";
    await this.persistSession(session);
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
  ): Promise<ConversationSession> {
    const session = await this.getSession(conversationId);
    if (session.userId && userId && session.userId !== userId) {
      throw new NotFoundException("Conversation not found");
    }
    if (!session.userId && userId) {
      session.userId = userId;
    }
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
      session.title = this.summarizeTitle(trimmed, session.nativeLanguage);
    }

    // Early broadcast: user message appears instantly in the UI
    this.broadcastSession(session);

    const interactionMode = this.resolveInteractionMode(
      options?.userMessageMeta,
    );
    const rawAiPayload =
      (await this.requestOpenAi(session, trimmed, interactionMode)) ??
      (await this.requestDsAi(session, trimmed, interactionMode)) ??
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

    return session;
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
    const prefersEnglish = nativeLanguage === LanguageCode.English;
    const welcomeText = prefersEnglish
      ? `👋 Welcome to the ${title} scenario.\nI'll coach you in ${targetLabel} and share tips in ${nativeLabel}. Let's warm up with a friendly greeting.`
      : `👋 欢迎来到${title}练习场景。\n我会用${targetLabel}陪你练习，并用${nativeLabel}提供提示。先来一句轻松的寒暄吧。`;
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
   * Generate a concise title (≤20 chars) from the first user message.
   * Strips punctuation, truncates intelligently at word/character boundaries.
   */
  private summarizeTitle(text: string, nativeLanguage?: LanguageCode): string {
    const cleaned = text
      .replace(/[\n\r]+/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .trim();
    if (!cleaned) {
      return this.describeScenario("daily", nativeLanguage);
    }
    // For CJK-heavy text, truncate by character count
    const cjkRatio =
      (cleaned.match(
        /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g,
      )?.length ?? 0) / cleaned.length;
    if (cjkRatio > 0.3) {
      return cleaned.length > 15 ? cleaned.slice(0, 15) + "…" : cleaned;
    }
    // For alphabetic text, truncate at word boundary
    if (cleaned.length <= 30) {
      return cleaned;
    }
    const words = cleaned.split(/\s+/);
    let result = "";
    for (const word of words) {
      if ((result + " " + word).trim().length > 28) break;
      result = (result + " " + word).trim();
    }
    return result ? result + "…" : cleaned.slice(0, 28) + "…";
  }

  private describeScenario(
    scenarioId: string,
    nativeLanguage?: LanguageCode,
  ): string {
    const zhMap: Record<string, string> = {
      restaurant: "餐厅点单",
      shopping: "商店交流",
      directions: "问路指引",
      business: "商务寒暄",
      daily: "日常聊天",
    };
    const enMap: Record<string, string> = {
      restaurant: "Dining etiquette",
      shopping: "Shopping chat",
      directions: "Asking for directions",
      business: "Business meetup",
      daily: "Daily small talk",
    };
    const prefersEnglish = nativeLanguage === LanguageCode.English;
    const map = prefersEnglish ? enMap : zhMap;
    return (
      map[scenarioId] ?? (prefersEnglish ? "Conversation practice" : "沉浸对话")
    );
  }

  private describeLanguage(
    language: LanguageCode,
    nativeLanguage: LanguageCode,
  ): string {
    const prefersEnglish = nativeLanguage === LanguageCode.English;
    switch (language) {
      case LanguageCode.Cantonese:
        return prefersEnglish ? "Cantonese" : "粤语";
      case LanguageCode.Mandarin:
        return prefersEnglish ? "Mandarin" : "普通话";
      case LanguageCode.English:
        return prefersEnglish ? "English" : "英语";
      default:
        return language;
    }
  }

  private async requestOpenAi(
    session: ConversationSession,
    latestMessage: string,
    interactionMode: TutorInteractionMode,
  ): Promise<AiResponse | null> {
    const { apiKey, tutorModel } = envConfig.openai;
    const endpoint = this.openAiEndpoint;
    if (!apiKey || !tutorModel || !endpoint) {
      this.logger.warn("OpenAI tutor config missing; skipping Yunwu GPT-5.2.");
      return null;
    }

    const history = session.messages.slice(-6).map((entry) => ({
      role: entry.sender === "ai" ? "assistant" : "user",
      content: entry.text,
    }));

    const prompt = buildConversationSystemPrompt({
      targetLanguage: session.targetLanguage,
      nativeLanguage: session.nativeLanguage ?? LanguageCode.Mandarin,
      scenarioLabel: this.describeScenario(
        session.scenarioId,
        session.nativeLanguage,
      ),
      interactionMode,
    });

    const payload = {
      model: tutorModel,
      temperature: 0.65,
      messages: [
        { role: "system", content: prompt },
        ...history,
        { role: "user", content: latestMessage },
      ],
    };

    this.logger.log(
      `Yunwu tutor request -> ${endpoint} | model=${tutorModel} | messages=${payload.messages.length}`,
    );

    try {
      const response = await this.fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        },
        OPENAI_TUTOR_TIMEOUT_MS,
      );

      if (!response.ok) {
        const detail = await response.text();
        this.logger.warn(
          `OpenAI tutor responded with ${response.status}: ${detail}`,
        );
        return null;
      }

      const raw: unknown = await response.json();
      const content = (
        raw as { choices?: Array<{ message?: { content?: string } }> }
      )?.choices?.[0]?.message?.content;

      if (!content) {
        this.logger.warn("OpenAI tutor returned empty content.");
        return null;
      }

      return this.parseAiResponseContent(
        content,
        "Auto-evaluated by GPT-5.2",
        session.targetLanguage,
      );
    } catch (error) {
      if (this.isAbortError(error)) {
        this.logger.warn(
          `OpenAI tutor timed out after ${OPENAI_TUTOR_TIMEOUT_MS}ms, switching to fallback source.`,
        );
        return null;
      }
      this.logger.error(
        `OpenAI tutor call failed: ${(error as Error).message}`,
      );
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
      this.logger.warn("AI response missing JSON payload.");
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
        this.logger.warn("AI response normalization failed.");
      }
      return normalized;
    } catch (error) {
      this.logger.warn(
        `Failed to parse AI response JSON: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async requestDsAi(
    session: ConversationSession,
    latestMessage: string,
    interactionMode: TutorInteractionMode,
  ): Promise<AiResponse | null> {
    const apiKey =
      envConfig.deepseek.apiKey ||
      process.env.DEEPSEEK_API_KEY ||
      process.env.DS_AI_API_KEY;
    if (!apiKey) {
      this.logger.warn("DeepSeek API key missing; using fallback payload.");
      return null;
    }

    const history = session.messages.slice(-6).map((entry) => ({
      role: entry.sender === "ai" ? "assistant" : "user",
      content: entry.text,
    }));

    const prompt = this.buildDeepSeekFallbackPrompt({
      targetLanguage: session.targetLanguage,
      nativeLanguage: session.nativeLanguage ?? LanguageCode.Mandarin,
      scenarioLabel: this.describeScenario(
        session.scenarioId,
        session.nativeLanguage,
      ),
      interactionMode,
    });

    const configuredPrimary =
      (envConfig.deepseek.model || process.env.DS_AI_MODEL || "").trim();
    const configuredFallback =
      (
        envConfig.deepseek.fallbackModel ||
        process.env.DS_AI_FALLBACK_MODEL ||
        ""
      ).trim();

    // Force backup order: deepseek-reasoner -> deepseek-chat, then configured extras.
    const orderedModels = [
      DEFAULT_MODEL,
      DEFAULT_FALLBACK_MODEL,
      configuredPrimary,
      configuredFallback,
    ].filter((model, index, list) => model && list.indexOf(model) === index);

    const candidates = orderedModels.map((model, index) => ({
      model,
      timeoutMs:
        index === 0 ? DEEPSEEK_PRIMARY_TIMEOUT_MS : DEEPSEEK_FALLBACK_TIMEOUT_MS,
      label: index === 0 ? "primary" : index === 1 ? "fallback" : "extra",
    }));

    for (const candidate of candidates) {
      const payload = {
        model: candidate.model,
        temperature: 0.6,
        stream: false,
        messages: [
          { role: "system", content: prompt },
          ...history,
          { role: "user", content: latestMessage },
        ],
      };

      this.logger.log(
        `DeepSeek request (${candidate.label}) -> ${this.deepSeekEndpoint} | model=${candidate.model} | timeout=${candidate.timeoutMs}ms | messages=${payload.messages.length}`,
      );

      try {
        const response = await this.fetchWithTimeout(
          this.deepSeekEndpoint,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          },
          candidate.timeoutMs,
        );

        if (!response.ok) {
          const detail = await response.text();
          this.logger.warn(
            `DeepSeek ${candidate.label} model responded with ${response.status}: ${detail}`,
          );
          continue;
        }

        const raw: unknown = await response.json();
        const content = (
          raw as { choices?: Array<{ message?: { content?: string } }> }
        )?.choices?.[0]?.message?.content;

        if (!content) {
          this.logger.warn(
            `DeepSeek ${candidate.label} model returned empty content.`,
          );
          continue;
        }

        const parsed = this.parseAiResponseContent(
          content,
          "Auto-evaluated by DeepSeek",
          session.targetLanguage,
        );
        if (parsed) {
          return this.enrichFallbackTeachingTips(
            parsed,
            session.targetLanguage,
            session.nativeLanguage ?? LanguageCode.Mandarin,
            interactionMode,
            session.scenarioId,
            latestMessage,
          );
        }

        const plainFallback = this.buildAiResponseFromPlainText(
          content,
          session.targetLanguage,
          session.nativeLanguage ?? LanguageCode.Mandarin,
          interactionMode,
          session.scenarioId,
          latestMessage,
        );
        if (plainFallback) {
          return plainFallback;
        }

        this.logger.warn(
          `DeepSeek ${candidate.label} model returned invalid JSON payload.`,
        );
      } catch (error) {
        if (this.isAbortError(error)) {
          this.logger.warn(
            `DeepSeek ${candidate.label} model timed out after ${candidate.timeoutMs}ms.`,
          );
          continue;
        }
        this.logger.error(
          `DeepSeek ${candidate.label} model failed: ${(error as Error).message}`,
        );
      }
    }

    return null;
  }

  private buildDeepSeekFallbackPrompt(input: {
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
    const fallback = this.buildDefaultTeachingTips(
      targetLanguage,
      nativeLanguage,
      interactionMode,
      scenarioId,
    );
    return {
      ...payload,
      reply: this.ensureScenarioTeachingReply(
        payload.reply,
        targetLanguage,
        scenarioId,
        interactionMode,
        latestMessage,
      ),
      correction: payload.correction?.trim() || fallback.correction,
      cultureNote: payload.cultureNote?.trim() || fallback.cultureNote,
      pronunciationTip:
        payload.pronunciationTip?.trim() || fallback.pronunciationTip,
      rhythmTip: payload.rhythmTip?.trim() || fallback.rhythmTip,
      grammarTip: payload.grammarTip?.trim() || fallback.grammarTip,
    };
  }

  private buildDefaultTeachingTips(
    targetLanguage: LanguageCode,
    nativeLanguage: LanguageCode,
    interactionMode: TutorInteractionMode,
    scenarioId: string,
  ): {
    correction: string;
    cultureNote: string;
    pronunciationTip: string;
    rhythmTip: string;
    grammarTip: string;
  } {
    const prefersEnglish = nativeLanguage === LanguageCode.English;
    const targetLabel = this.describeLanguage(targetLanguage, nativeLanguage);
    const scenarioLabel = this.describeScenario(scenarioId, nativeLanguage);
    if (prefersEnglish) {
      return {
        correction:
          interactionMode === "voice"
            ? `In ${scenarioLabel}, use one shorter ${targetLabel} sentence first, then add details in the next turn.`
            : `For ${scenarioLabel}, polish one sentence in ${targetLabel} first, and keep the next sentence concise.`,
        cultureNote:
          interactionMode === "voice"
            ? `In ${scenarioLabel}, start with one positive phrase before asking a question to sound natural.`
            : `In ${scenarioLabel}, add one friendly acknowledgement before your request.`,
        pronunciationTip:
          "Slow down the stressed syllables and keep ending consonants clear.",
        rhythmTip:
          "Pause briefly after each clause instead of speaking in one long breath.",
        grammarTip:
          "Prefer one tense in one sentence; avoid mixing structures in the same turn.",
      };
    }
    return {
      correction:
        interactionMode === "voice"
          ? `在${scenarioLabel}场景中，先用一句更短的${targetLabel}表达核心意思，再补充细节。`
          : `在${scenarioLabel}场景中，先把一句${targetLabel}核心表达说完整，再用下一句补充信息。`,
      cultureNote:
        interactionMode === "voice"
          ? `在${scenarioLabel}里先肯定对方再提出问题，会更像真实口语互动。`
          : `在${scenarioLabel}里先做简短回应再表达需求，更符合母语者交流习惯。`,
      pronunciationTip: "重读关键词，句尾辅音收清楚，语气会更自然。",
      rhythmTip: "按意群做短停顿，不要一口气读完整句。",
      grammarTip: "一句话只保留一个主结构，避免时态和句式混用。",
    };
  }

  private ensureScenarioTeachingReply(
    reply: string,
    targetLanguage: LanguageCode,
    scenarioId: string,
    interactionMode: TutorInteractionMode,
    latestMessage: string,
  ): string {
    const trimmed = reply.trim();
    if (trimmed.length >= 28) {
      return trimmed;
    }
    const scenario = this.describeScenario(scenarioId, targetLanguage);
    if (targetLanguage === LanguageCode.English) {
      return `${trimmed} In this ${scenario} context, try: "${latestMessage}" with one clearer key phrase and a follow-up question.`;
    }
    if (targetLanguage === LanguageCode.Cantonese) {
      return `${trimmed} 喺${scenario}呢个场景，你可以先讲重点，再加一句追问令对话更自然。`;
    }
    return `${trimmed} 在${scenario}场景里，你可以先说重点，再补一句追问，让表达更像母语者。`;
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
    const fallbackTips = this.buildDefaultTeachingTips(
      targetLanguage,
      nativeLanguage,
      interactionMode,
      scenarioId,
    );
    return AiResponseSchema.parse({
      reply: this.ensureScenarioTeachingReply(
        plain,
        targetLanguage,
        scenarioId,
        interactionMode,
        latestMessage,
      ),
      correction: fallbackTips.correction,
      cultureNote: fallbackTips.cultureNote,
      associativePhrases: this.buildScenarioAssociativePhrases(
        targetLanguage,
        scenarioId,
      ),
      score: 72,
      scoreReason:
        nativeLanguage === LanguageCode.English
          ? "Fallback scoring based on DeepSeek plain-text response."
          : "DeepSeek 返回纯文本，已启用教学兜底评分。",
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
    if (targetLanguage === LanguageCode.English) {
      switch (scenarioId) {
        case "restaurant":
          return [
            "Could you recommend your signature dish?",
            "I'd like something light but flavorful.",
          ];
        case "directions":
          return [
            "Could you show me the fastest route?",
            "Is it within walking distance from here?",
          ];
        case "business":
          return [
            "Could we align on the next action today?",
            "Let's confirm the timeline before we proceed.",
          ];
        default:
          return [
            "Could you tell me more about that?",
            "That sounds great. What should I do next?",
          ];
      }
    }
    if (targetLanguage === LanguageCode.Cantonese) {
      return ["可唔可以介绍一个最啱新手嘅讲法？", "我下一句可以点样讲得更自然？"];
    }
    return ["你可以给我一个更地道的说法吗？", "我下一句怎么接会更自然？"];
  }

  private enrichPayloadForInteractionMode(
    payload: AiResponse,
    interactionMode: TutorInteractionMode,
    targetLanguage: LanguageCode,
    nativeLanguage: LanguageCode,
    scenarioId: string,
  ): AiResponse {
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

  private ensureStructuredTextTeachingReply(
    payload: AiResponse,
    targetLanguage: LanguageCode,
    nativeLanguage: LanguageCode,
    scenarioId: string,
  ): string {
    const rawReply = payload.reply.trim();
    const alreadyStructured =
      /(\n|^)\s*(学习建议|Study Steps)[:：]/i.test(rawReply) ||
      /(\n|^)\s*1[\).]/.test(rawReply);
    if (alreadyStructured) {
      return rawReply;
    }

    const fallbackTips = this.buildDefaultTeachingTips(
      targetLanguage,
      nativeLanguage,
      "text",
      scenarioId,
    );
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
    const score = Math.max(
      60,
      Math.min(98, 92 - Math.round(Math.min(polite.length, 120) / 6)),
    );

    const tips = this.buildDefaultTeachingTips(
      language,
      LanguageCode.Mandarin,
      "text",
      scenarioId,
    );
    return AiResponseSchema.parse({
      reply: this.ensureScenarioTeachingReply(
        this.buildReply(polite, language, scenarioId),
        language,
        scenarioId,
        "text",
        polite,
      ),
      correction: tips.correction,
      cultureNote: tips.cultureNote,
      associativePhrases: this.buildScenarioAssociativePhrases(
        language,
        scenarioId,
      ),
      score,
      scoreReason: "基于语气、场景贴合度与可理解性的兜底估分",
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
    if (language === LanguageCode.English) {
      return `I heard "${message}". Here is a natural ${scenarioId} response to keep things flowing.`;
    }
    if (language === LanguageCode.Cantonese) {
      return `我聽到你講：「${message}」。等我用地道講法繼續对话。`;
    }
    return `我听到你说：“${message}”。我来示范一个自然的续写方式。`;
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
    const prefersEnglish = nativeLanguage === LanguageCode.English;
    const aiName = prefersEnglish ? "LuvTALK Tutor" : "LuvTALK 导师";
    const userName = prefersEnglish ? "You" : "我";
    return {
      id: randomUUID(),
      sender,
      text,
      language,
      createdAt: extra?.createdAt ?? new Date().toISOString(),
      senderName: sender === "ai" ? aiName : userName,
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
    messageMeta?: ConversationMessage["meta"],
  ): TutorInteractionMode {
    if (messageMeta?.audioUrl || messageMeta?.source === "realtime") {
      return "voice";
    }
    return "text";
  }

  private async persistSession(session: ConversationSession): Promise<void> {
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
        } else {
          this.logger.warn(`listByIds failed: ${(error as Error).message}`);
        }
      }
      if (records.length > 0) {
        return records.map((record) => this.toHistorySummary(record));
      }
    }

    // Fallback: resolve from in-memory cache
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
    const session = await this.getSession(conversationId);
    if (session.userId !== userId) {
      throw new NotFoundException("Conversation not found");
    }
    return session;
  }

  async getSessionSummary(
    conversationId: string,
    userId?: string,
  ): Promise<SessionSummaryPayload> {
    const session = await this.getSession(conversationId);
    if (session.userId && userId && session.userId !== userId) {
      throw new NotFoundException("Conversation not found");
    }
    return buildSessionSummary({
      conversationId: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages,
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

  private resolveDeepSeekEndpoint(): string {
    const raw =
      envConfig.deepseek.apiUrl ||
      process.env.DS_AI_API_URL ||
      DEFAULT_BASE_URL;
    const normalized = raw.replace(/\/$/, "");
    if (normalized.endsWith("/chat/completions")) {
      return normalized;
    }
    if (normalized.endsWith("/v1")) {
      return `${normalized}/chat/completions`;
    }
    return `${normalized}/v1/chat/completions`;
  }

  private resolveOpenAiEndpoint(): string | null {
    const raw = envConfig.openai.apiUrl?.replace(/\/$/, "");
    if (!raw) {
      return null;
    }
    if (raw.endsWith("/chat/completions")) {
      return raw;
    }
    if (raw.endsWith("/v1")) {
      return `${raw}/chat/completions`;
    }
    return `${raw}/v1/chat/completions`;
  }

  private async fetchWithTimeout(
    input: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
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
