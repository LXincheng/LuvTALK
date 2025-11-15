import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { LanguageCode } from '../../common/enums/language-code.enum';
import {
  ConversationCoachNote,
  ConversationMessage,
  ConversationSession,
} from '../../common/types/conversation.types';
import { AiResponse, AiResponseSchema } from '../../common/types/ai-response.schema';
import { PrismaService } from '../../core/prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { StartConversationDto } from './dto/start-conversation.dto';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  private readonly sessions = new Map<string, ConversationSession>();
  private readonly avatars = {
    ai: 'https://api.dicebear.com/6.x/bottts-neutral/svg?seed=coach&background=%23e5edff',
    user: 'https://api.dicebear.com/6.x/bottts-neutral/svg?seed=learner&background=%23fef3c7',
  };

  constructor(private readonly prisma: PrismaService) {}

  async startSession(dto: StartConversationDto): Promise<ConversationSession> {
    const now = new Date().toISOString();
    const scenarioId = dto.scenarioId ?? 'daily';
    const welcomeMessage = this.buildSystemWelcome(scenarioId, dto.targetLanguage, now);

    const session: ConversationSession = {
      id: randomUUID(),
      scenarioId,
      targetLanguage: dto.targetLanguage,
      createdAt: now,
      updatedAt: now,
      messages: [welcomeMessage],
      coach: {
        associativePhrases: ['可以随时问我文化背景', '想练语气或礼貌表达直接告诉我'],
        overallScore: 100,
        correction: '先自我介绍，再进入主题更自然。',
        cultureNote: '粤语会话通常先寒暄几句，保持亲切语气。',
      },
    };

    await this.persistSession(session);
    return session;
  }

  async processMessage(conversationId: string, dto: SendMessageDto): Promise<ConversationSession> {
    const session = await this.getSession(conversationId);
    const trimmed = dto.message.trim();

    const userMessage = this.buildMessage('user', trimmed, session.targetLanguage);
    session.messages.push(userMessage);

    const aiPayload =
      (await this.requestDsAi(trimmed, session.targetLanguage, session.scenarioId)) ??
      this.composeAiResponse(trimmed, session.targetLanguage, session.scenarioId);

    const aiMessage = this.buildMessage('ai', aiPayload.reply, session.targetLanguage, {
      meta: { score: aiPayload.score },
    });
    session.messages.push(aiMessage);

    session.coach = this.buildCoachNote(aiPayload);
    session.updatedAt = new Date().toISOString();

    await this.persistSession(session);
    return session;
  }

  async getSession(conversationId: string): Promise<ConversationSession> {
    const cached = this.sessions.get(conversationId);
    if (cached) {
      return cached;
    }

    if (this.prisma.canUseDatabase()) {
      const record = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
      if (record) {
        const persistedMessages = Array.isArray(record.messages)
          ? (record.messages as unknown as ConversationMessage[])
          : [];
        const rehydrated: ConversationSession = {
          id: record.id,
          scenarioId: record.scenarioId,
          targetLanguage: record.targetLanguage as LanguageCode,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
          messages: persistedMessages,
        };
        this.sessions.set(rehydrated.id, rehydrated);
        return rehydrated;
      }
    }

    throw new NotFoundException(`Conversation ${conversationId} not found`);
  }

  private buildSystemWelcome(
    scenarioId: string,
    language: LanguageCode,
    timestamp: string,
  ): ConversationMessage {
    const title = this.describeScenario(scenarioId);
    return this.buildMessage(
      'ai',
      `🎯 场景：${title}\n我会用${this.describeLanguage(language)}陪你练习，请告诉我想模拟的细节。`,
      language,
      { createdAt: timestamp },
    );
  }

  // TODO: replace literal文本 with nestjs-i18n once translation module is introduced.
  private describeScenario(scenarioId: string): string {
    const map: Record<string, string> = {
      restaurant: '餐厅点餐',
      shopping: '购物交流',
      directions: '问路',
      business: '商务寒暄',
      daily: '日常寒暄',
    };
    return map[scenarioId] ?? '沉浸式练习';
  }

  private describeLanguage(language: LanguageCode): string {
    switch (language) {
      case LanguageCode.Cantonese:
        return '粤语';
      case LanguageCode.Mandarin:
        return '普通话';
      case LanguageCode.English:
        return 'English';
      default:
        return language;
    }
  }

  private async requestDsAi(
    message: string,
    language: LanguageCode,
    scenarioId: string,
  ): Promise<AiResponse | null> {
    const apiKey = process.env.DS_AI_API_KEY;
    if (!apiKey) {
      this.logger.warn('DS_AI_API_KEY not configured, falling back to template response');
      return null;
    }

    try {
      const prompt = `你是 LuvTALK 的语伴教练，请使用 ${this.describeLanguage(
        language,
      )} 回答，并针对场景「${this.describeScenario(
        scenarioId,
      )}」提供对话、纠错、文化解释。严格输出 JSON，格式为 {"reply":"","correction":"","cultureNote":"","associativePhrases":["",""],"score":95}`;

      const response = await fetch(process.env.DS_AI_API_URL ?? 'https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.DS_AI_MODEL ?? 'deepseek-chat',
          temperature: 0.6,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: message },
          ],
        }),
      });

      const payload = await response.json();
      const content: string | undefined = payload?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('empty ds-ai response');
      }

      const jsonText = content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1);
      const parsed = JSON.parse(jsonText);
      return AiResponseSchema.parse(parsed);
    } catch (error) {
      this.logger.warn(`DS AI fallback triggered: ${(error as Error).message}`);
      return null;
    }
  }

  private composeAiResponse(message: string, language: LanguageCode, scenarioId: string): AiResponse {
    const polite = message.length > 0 ? message : '（等待输入）';
    const baseScore = 88 - Math.min(20, polite.length / 4);
    const score = Math.max(62, Math.min(98, Math.round(baseScore)));

    const payload = {
      reply: this.buildReply(polite, language, scenarioId),
      correction: polite.length > 18 ? '注意语速与停顿，让表达更自然。' : '语气不错，保持礼貌即可。',
      cultureNote:
        scenarioId === 'restaurant'
          ? '点餐前通常会先称赞一下餐厅或询问招牌菜，语气会更亲切。'
          : '结合表情和手势会让表达更真诚。',
      associativePhrases: ['唔该晒，你可以介绍一下招牌菜吗？', 'Could you recommend something locals enjoy?'],
      score,
    };

    return AiResponseSchema.parse(payload);
  }

  private buildReply(message: string, language: LanguageCode, scenarioId: string): string {
    if (language === LanguageCode.English) {
      return `I hear "${message}". Here's how a native speaker might respond in a ${scenarioId} scenario.`;
    }
    if (language === LanguageCode.Cantonese) {
      return `我聽到你講：「${message}」。等我用更地道嘅講法回應你。`;
    }
    return `我听到你说：“${message}”。我们继续把场景推进吧。`;
  }

  private buildMessage(
    sender: 'user' | 'ai',
    text: string,
    language: LanguageCode,
    extra?: Partial<ConversationMessage>,
  ): ConversationMessage {
    return {
      id: randomUUID(),
      sender,
      text,
      language,
      createdAt: extra?.createdAt ?? new Date().toISOString(),
      senderName: sender === 'ai' ? 'LuvTALK 导师' : '我',
      avatar: sender === 'ai' ? this.avatars.ai : this.avatars.user,
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
          messages: session.messages as unknown as Prisma.JsonArray,
          score: session.coach?.overallScore,
        },
        create: {
          id: session.id,
          scenarioId: session.scenarioId,
          targetLanguage: session.targetLanguage,
          messages: session.messages as unknown as Prisma.JsonArray,
          score: session.coach?.overallScore,
        },
      });
    }
  }
}
