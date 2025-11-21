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
} from "../../common/types/ai-response.schema";
import { PrismaService } from "../../core/prisma/prisma.service";
import { TranslationService } from "../translation/translation.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { StartConversationDto } from "./dto/start-conversation.dto";

const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_BASE_URL = "https://api.deepseek.com";

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
  private readonly avatars = {
    ai: "https://api.dicebear.com/6.x/bottts-neutral/svg?seed=coach&background=%23e5edff",
    user: "https://api.dicebear.com/6.x/bottts-neutral/svg?seed=learner&background=%23fef3c7",
  };
  private readonly deepSeekEndpoint = this.resolveDeepSeekEndpoint();

  constructor(
    private readonly prisma: PrismaService,
    private readonly translation: TranslationService,
  ) {}

  async startSession(dto: StartConversationDto): Promise<ConversationSession> {
    const now = new Date().toISOString();
    const scenarioId = dto.scenarioId ?? "daily";
    const nativeLanguage = dto.nativeLanguage ?? LanguageCode.Mandarin;
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
      createdAt: now,
      updatedAt: now,
      messages: [welcomeMessage],
    };

    await this.persistSession(session);
    this.broadcastSession(session);
    return session;
  }

  async processMessage(
    conversationId: string,
    dto: SendMessageDto,
    options?: ProcessMessageOptions,
  ): Promise<ConversationSession> {
    const session = await this.getSession(conversationId);
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

    const aiPayload =
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

    const aiMessage = this.buildMessage(
      "ai",
      aiPayload.reply,
      session.targetLanguage,
      session.nativeLanguage,
      {
        meta: {
          score: aiPayload.score,
          scoreReason: aiPayload.scoreReason,
          translation: translationText,
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

    if (this.prisma.canUseDatabase()) {
      const record = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });
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
        return rehydrated;
      }
    }

    throw new NotFoundException(`Conversation ${conversationId} not found`);
  }

  streamSession(conversationId: string): Observable<ConversationSession> {
    return this.getOrCreateStream(conversationId).asObservable();
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
      ? `👋 Welcome to the “${title}” scenario.\nI’ll coach you in ${targetLabel} and share hints in ${nativeLabel}. Let’s warm up with a friendly greeting.`
      : `👋 欢迎来到「${title}」练习场景。\n我会用${targetLabel}陪你练习，并用${nativeLabel}提供提示。我们先从寒暄热身开始吧。`;
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

      const jsonText = content.slice(
        content.indexOf("{"),
        content.lastIndexOf("}") + 1,
      );
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      if (!parsed.scoreReason) {
        parsed.scoreReason = "Auto-evaluated by DeepSeek";
      }
      return AiResponseSchema.parse(parsed);
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
          ? "语句稍长，可以适当停顿。"
          : "表达清晰，保持礼貌语气即可。",
      cultureNote:
        scenarioId === "restaurant"
          ? "点餐前赞美餐厅或询问招牌菜，会让对话更自然。"
          : "搭配表情和手势能让口语更真诚。",
      associativePhrases: [
        "可以帮我推荐一下招牌菜吗？",
        "Could you recommend something locals enjoy?",
      ],
      score,
      scoreReason: "基于语气与礼貌度的快速估分",
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

    if (this.prisma.canUseDatabase()) {
      await this.prisma.conversation.upsert({
        where: { id: session.id },
        update: {
          scenarioId: session.scenarioId,
          targetLanguage: session.targetLanguage,
          nativeLanguage: session.nativeLanguage,
          messages: session.messages as unknown as Prisma.JsonArray,
          score: session.coach?.overallScore,
        },
        create: {
          id: session.id,
          scenarioId: session.scenarioId,
          targetLanguage: session.targetLanguage,
          nativeLanguage: session.nativeLanguage,
          messages: session.messages as unknown as Prisma.JsonArray,
          score: session.coach?.overallScore,
        },
      });
    }
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
}
