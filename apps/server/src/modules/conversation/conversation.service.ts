import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { Observable, Subject } from "rxjs";
import { envConfig } from "../../common/config/env.config";
import { buildConversationSystemPrompt } from "../../common/config/prompt.config";
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

const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_BASE_URL = "https://api.deepseek.com";

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
      session.title = trimmed.slice(0, 60);
    }

    const aiPayload =
      (await this.requestOpenAi(session, trimmed)) ??
      (await this.requestDsAi(session, trimmed)) ??
      this.composeAiResponse(
        trimmed,
        session.targetLanguage,
        session.scenarioId,
      );

    const translationText = await this.translateForNativeLanguage(
      aiPayload.reply,
      session.targetLanguage,
      session.nativeLanguage ?? LanguageCode.Mandarin,
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
          pronunciationTip: aiPayload.pronunciationTip,
          translation: translationText,
          keyTerms: normalizedKeyTerms,
        },
      },
    );
    session.messages.push(aiMessage);
    session.coach = this.buildCoachNote(aiPayload);
    session.updatedAt = new Date().toISOString();

    await this.persistSession(session);
    this.broadcastSession(session);
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
  ): Promise<AiResponse | null> {
    const { apiKey, tutorModel } = envConfig.openai;
    const endpoint = this.openAiEndpoint;
    if (!apiKey || !tutorModel || !endpoint) {
      this.logger.warn("OpenAI tutor config missing; skipping Yunwu GPT-5.1.");
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
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

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

      return this.parseAiResponseContent(content, "Auto-evaluated by GPT-5.1");
    } catch (error) {
      this.logger.error(
        `OpenAI tutor call failed: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private parseAiResponseContent(
    content: string,
    fallbackReason: string,
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
      if (!parsed.scoreReason) {
        parsed.scoreReason = fallbackReason;
      }
      if (parsed.key_terms && !parsed.keyTerms) {
        parsed.keyTerms = parsed.key_terms;
      }
      if (Array.isArray(parsed.keyTerms)) {
        parsed.keyTerms = parsed.keyTerms.map((entry) => {
          const record = entry as Record<string, unknown>;
          const examples = Array.isArray(record.examples)
            ? record.examples.filter(
                (example): example is string => typeof example === "string",
              )
            : [];
          return {
            term: typeof record.term === "string" ? record.term : "",
            definition:
              typeof record.definition === "string" ? record.definition : "",
            type: typeof record.type === "string" ? record.type : undefined,
            examples,
          };
        });
      } else {
        parsed.keyTerms = [];
      }
      return AiResponseSchema.parse(parsed);
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

    const prompt = buildConversationSystemPrompt({
      targetLanguage: session.targetLanguage,
      nativeLanguage: session.nativeLanguage ?? LanguageCode.Mandarin,
      scenarioLabel: this.describeScenario(
        session.scenarioId,
        session.nativeLanguage,
      ),
    });

    const model =
      envConfig.deepseek.model || process.env.DS_AI_MODEL || DEFAULT_MODEL;

    const payload = {
      model,
      temperature: 0.6,
      stream: false,
      messages: [
        { role: "system", content: prompt },
        ...history,
        { role: "user", content: latestMessage },
      ],
    };

    this.logger.log(
      `DeepSeek request -> ${this.deepSeekEndpoint} | model=${model} | messages=${payload.messages.length}`,
    );

    try {
      const response = await fetch(this.deepSeekEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = await response.text();
        this.logger.warn(
          `DeepSeek responded with ${response.status}: ${detail}`,
        );
        return null;
      }

      const raw: unknown = await response.json();
      const content = (
        raw as { choices?: Array<{ message?: { content?: string } }> }
      )?.choices?.[0]?.message?.content;

      if (!content) {
        this.logger.warn("DeepSeek returned empty content.");
        return null;
      }

      return this.parseAiResponseContent(content, "Auto-evaluated by DeepSeek");
    } catch (error) {
      this.logger.error(`DeepSeek call failed: ${(error as Error).message}`);
      return null;
    }
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

    return AiResponseSchema.parse({
      reply: this.buildReply(polite, language, scenarioId),
      correction:
        polite.length > 28
          ? "句子稍长，可以适当停顿让语气更自然。"
          : "表达清晰，保持礼貌语气即可。",
      cultureNote:
        scenarioId === "restaurant"
          ? "点餐前赞美餐厅或询问招牌菜，会让对话更友好。"
          : "搭配表情或手势会让口语更真诚。",
      associativePhrases: [
        "可以帮我推荐一下招牌菜吗？",
        "Could you recommend something locals enjoy?",
      ],
      score,
      scoreReason: "基于语气与礼貌度的快速估分",
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
      .filter((term) =>
        this.isTermInReply(reply, normalizedReply, term.term),
      )
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
}
