import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FavoriteTypeEnum } from "../../common/enums/favorite-type.enum";
import { FavoriteItem } from "../../common/types/conversation.types";
import { ConversationMessage } from "../../common/types/conversation.types";
import {
  DailyReviewPayload,
  ReviewCard,
  ReviewSourceType,
} from "../../common/types/review.types";
import { PrismaService } from "../../core/prisma/prisma.service";
import { AchievementService } from "../achievement/achievement.service";
import { ConversationService } from "../conversation/conversation.service";
import { FavoritesService } from "../favorites/favorites.service";
import {
  ReviewFeedbackAction,
  ReviewFeedbackDto,
} from "./dto/review-feedback.dto";

const LOW_SCORE_THRESHOLD = 60;
const MAX_LOW_SCORE_CARDS = 4;
const MAX_DAILY_CARDS = 10;
const MIN_EASE_FACTOR = 1.3;
const MAX_EASE_FACTOR = 3.0;
const MAX_TERMS_PER_LOW_SCORE_MESSAGE = 2;
const MAX_REVIEW_TERM_WORDS = 8;
const REVIEW_NOISE_PATTERNS = [
  /\btest(?:ing)?\b/i,
  /\bplaceholder\b/i,
  /\bdummy\b/i,
  /\bsample\b/i,
  /\bsystem note\b/i,
  /\bno real content\b/i,
  /\btry a full simple sentence next\b/i,
  /\bencourage you to try\b/i,
  /\byour sentence\b/i,
  /\bour sentence\b/i,
  /测试/,
  /占位/,
  /示例文本/,
  /系统提示/,
  /请尝试/,
];

interface ReviewQueueSnapshot {
  id: string;
  userId: string;
  sourceType: ReviewSourceType;
  sourceId?: string;
  term: string;
  definition?: string;
  example?: string;
  exampleTranslation?: string;
  favoriteType?: FavoriteTypeEnum;
  conversationId?: string;
  score?: number;
  reviewCount: number;
  intervalDays: number;
  easeFactor: number;
  lastReviewedAt?: string;
  nextReviewAt?: string;
}

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);
  private readonly feedbackLog = new Map<
    string,
    ReviewFeedbackDto & { createdAt: string }
  >();
  private readonly queueFallback = new Map<string, ReviewQueueSnapshot>();
  private reviewTablesReady: boolean | null = null;

  constructor(
    private readonly favoritesService: FavoritesService,
    private readonly prisma: PrismaService,
    private readonly achievementService: AchievementService,
    private readonly conversationService: ConversationService,
  ) {}

  async buildDailyReview(userId?: string): Promise<DailyReviewPayload> {
    if (
      !this.prisma.canUseDatabase() &&
      !this.prisma.allowsInMemoryFallback()
    ) {
      this.prisma.ensurePersistentStorageAvailable();
    }
    const favorites = await this.favoritesService.list(userId);
    const favoriteCards = this.buildFavoriteCards(favorites);
    const lowScoreCards = await this.buildLowScoreCards(userId);

    const merged = [
      ...lowScoreCards.slice(0, MAX_LOW_SCORE_CARDS),
      ...favoriteCards,
    ];

    const deduped = this.deduplicateCards(merged);
    let cards = deduped.slice(0, MAX_DAILY_CARDS);

    if (userId && (await this.canUseReviewTables())) {
      await this.syncQueueFromCards(userId, deduped);
      const dueCards = await this.fetchDueQueueCards(userId, MAX_DAILY_CARDS);
      if (dueCards.length > 0) {
        cards = dueCards;
      }
    }

    return {
      date: new Date().toISOString().split("T")[0],
      cards,
    };
  }

  async recordFeedback(
    dto: ReviewFeedbackDto,
    userId?: string,
  ): Promise<{ status: string }> {
    if (
      !this.prisma.canUseDatabase() &&
      !this.prisma.allowsInMemoryFallback()
    ) {
      this.prisma.ensurePersistentStorageAvailable();
    }
    const createdAt = new Date().toISOString();
    const entry = { ...dto, createdAt };
    this.feedbackLog.set(`${dto.cardId}-${createdAt}`, entry);
    const actionLabel =
      dto.action === ReviewFeedbackAction.Known ? "known" : "practice";
    this.logger.log(
      `Review feedback: card=${dto.cardId} action=${actionLabel} source=${dto.sourceType ?? "unknown"}`,
    );

    if (!userId) {
      return { status: "ok" };
    }

    if (!(await this.canUseReviewTables())) {
      this.updateFallbackSchedule(dto, userId, createdAt);
      return { status: "ok" };
    }

    try {
      await this.prisma.reviewFeedback.create({
        data: {
          userId,
          cardId: dto.cardId,
          action: dto.action,
          sourceType: dto.sourceType,
          conversationId: dto.conversationId,
        },
      });
      await this.applyFeedbackToQueue(dto, userId);
    } catch (error) {
      if (this.isMissingTableError(error)) {
        this.reviewTablesReady = false;
        this.updateFallbackSchedule(dto, userId, createdAt);
      } else {
        throw error;
      }
    }

    this.achievementService.queueUserProgressSync(userId);
    return { status: "ok" };
  }

  private async buildLowScoreCards(userId?: string): Promise<ReviewCard[]> {
    const cards: ReviewCard[] = [];
    if (this.prisma.canUseDatabase()) {
      const records = await this.prisma.conversation.findMany({
        where: userId ? { userId } : undefined,
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          id: true,
          messages: true,
        },
      });
      records.forEach((record) => {
        const messages = Array.isArray(record.messages)
          ? (record.messages as unknown as ConversationMessage[])
          : [];
        cards.push(...this.extractLowScoreCards(record.id, messages));
      });
      return cards;
    }

    const sessions = this.conversationService.listCachedSessions();
    sessions.forEach((session) => {
      if (userId && session.userId !== userId) {
        return;
      }
      cards.push(...this.extractLowScoreCards(session.id, session.messages));
    });
    return cards;
  }

  private buildFavoriteCards(favorites: FavoriteItem[]): ReviewCard[] {
    return favorites
      .map((favorite) => {
        const metadata = favorite.metadata ?? {};
        const definition = this.pickReviewDefinition(
          typeof metadata.definition === "string"
            ? metadata.definition
            : favorite.content,
        );
        const translation =
          typeof metadata.translation === "string"
            ? this.cleanReviewText(metadata.translation)
            : undefined;
        const examples = Array.isArray(metadata.examples)
          ? metadata.examples.filter(
              (example): example is string => typeof example === "string",
            )
          : [];
        const card: ReviewCard = {
          id: favorite.id,
          term: this.cleanReviewText(favorite.title) ?? favorite.title,
          definition,
          example:
            this.pickReviewExample(examples) ??
            this.pickReviewExample([translation]) ??
            undefined,
          exampleTranslation:
            typeof metadata.exampleTranslation === "string"
              ? this.cleanReviewText(metadata.exampleTranslation)
              : undefined,
          sourceType: "favorite",
          favoriteType: favorite.type,
          conversationId: favorite.conversationId,
        };
        return this.isReviewCardUseful(card) ? card : null;
      })
      .filter((card): card is ReviewCard => Boolean(card));
  }

  private extractLowScoreCards(
    conversationId: string,
    messages: ConversationMessage[],
  ): ReviewCard[] {
    const cards: ReviewCard[] = [];
    messages.forEach((message, index) => {
      if (message.sender !== "ai") {
        return;
      }
      // Skip the first AI message (system welcome) — it has no score and no user input
      if (index === 0) {
        return;
      }
      const score = message.meta?.score;
      if (typeof score !== "number" || score >= LOW_SCORE_THRESHOLD) {
        return;
      }
      for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const userMessage = messages[cursor];
        if (userMessage?.sender === "user") {
          if (!this.isQualityInput(userMessage.text)) {
            break;
          }
          const keyTermCards = this.extractKeyTermCards(
            conversationId,
            message.id,
            message,
            score,
          );
          if (keyTermCards.length > 0) {
            cards.push(...keyTermCards);
            break;
          }
          const fallbackCard = this.buildLowScoreFallbackCard(
            conversationId,
            message.id,
            userMessage.text,
            message.text,
            message.meta?.translation,
            message.meta?.scoreReason,
            score,
          );
          if (fallbackCard) {
            cards.push(fallbackCard);
          }
          break;
        }
      }
    });
    return cards;
  }

  private isQualityInput(text: string): boolean {
    const trimmed = this.cleanReviewText(text);
    if (!trimmed || trimmed.length < 2) {
      return false;
    }
    if (/^[\d\s.,!?;:'"()\-_+=]+$/.test(trimmed)) {
      return false;
    }
    if (/^(.)\1{2,}$/.test(trimmed)) {
      return false;
    }
    const alphaOnly = trimmed.replace(/[^a-zA-Z]/g, "");
    if (alphaOnly.length >= 3) {
      const uniqueChars = new Set(alphaOnly.toLowerCase()).size;
      if (uniqueChars <= 2) {
        return false;
      }
    }
    return !this.isReviewNoise(trimmed);
  }

  private extractKeyTermCards(
    conversationId: string,
    messageId: string,
    message: ConversationMessage,
    score: number,
  ): ReviewCard[] {
    const keyTerms = message.meta?.keyTerms ?? [];
    return keyTerms
      .map((term, index) => {
        const normalizedTerm = this.pickReviewTerm(term.term);
        const definition = this.pickReviewDefinition(term.definition);
        const example =
          this.pickReviewExample(term.examples) ??
          this.pickReviewExample([message.text]);
        const exampleTranslation = this.cleanReviewText(
          message.meta?.translation,
        );
        if (!normalizedTerm || !definition || !example) {
          return null;
        }
        const card: ReviewCard = {
          id: `${conversationId}-${messageId}-term-${index}`,
          term: normalizedTerm,
          definition,
          example,
          exampleTranslation,
          sourceType: "low_score",
          conversationId,
          score,
        };
        return this.isReviewCardUseful(card) ? card : null;
      })
      .filter((card): card is ReviewCard => Boolean(card))
      .slice(0, MAX_TERMS_PER_LOW_SCORE_MESSAGE);
  }

  private buildLowScoreFallbackCard(
    conversationId: string,
    messageId: string,
    learnerText: string,
    tutorReply?: string,
    tutorTranslation?: string,
    scoreReason?: string,
    score?: number,
  ): ReviewCard | null {
    const term = this.pickReviewTerm(learnerText);
    const definition = this.pickReviewDefinition(scoreReason);
    const example =
      this.pickReviewExample([learnerText]) ??
      this.pickReviewExample([tutorReply]);
    const exampleTranslation = this.cleanReviewText(tutorTranslation);
    if (!term || !definition || !example) {
      return null;
    }
    const card: ReviewCard = {
      id: `${conversationId}-${messageId}`,
      term,
      definition,
      example,
      exampleTranslation,
      sourceType: "low_score",
      conversationId,
      score,
    };
    return this.isReviewCardUseful(card) ? card : null;
  }

  private pickReviewTerm(value?: string): string | undefined {
    const cleaned = this.cleanReviewText(value);
    if (!cleaned || this.isReviewNoise(cleaned)) {
      return undefined;
    }
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (
      /^[a-zA-Z][a-zA-Z\s'/-]*$/.test(cleaned) &&
      words.length > MAX_REVIEW_TERM_WORDS
    ) {
      return undefined;
    }
    return cleaned;
  }

  private pickReviewDefinition(value?: string): string | undefined {
    const cleaned = this.cleanReviewText(value);
    if (!cleaned || this.isReviewNoise(cleaned)) {
      return undefined;
    }
    if (cleaned.length < 2) {
      return undefined;
    }
    return cleaned;
  }

  private pickReviewExample(
    values: Array<string | undefined>,
  ): string | undefined {
    return values
      .map((value) => this.cleanReviewText(value))
      .find((value): value is string => {
        if (!value) {
          return false;
        }
        return !this.isReviewNoise(value);
      });
  }

  private cleanReviewText(value?: string): string | undefined {
    const trimmed = value?.replace(/\s+/g, " ").trim();
    return trimmed ? trimmed : undefined;
  }

  private isReviewNoise(text: string): boolean {
    const normalized = text.trim();
    if (!normalized) {
      return true;
    }
    return REVIEW_NOISE_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  private isReviewCardUseful(card: ReviewCard): boolean {
    const term = this.pickReviewTerm(card.term);
    const definition = this.pickReviewDefinition(card.definition);
    const example = this.pickReviewExample([card.example]);
    if (!term || !definition || !example) {
      return false;
    }
    card.term = term;
    card.definition = definition;
    card.example = example;
    card.exampleTranslation = this.cleanReviewText(card.exampleTranslation);
    return true;
  }

  private deduplicateCards(cards: ReviewCard[]): ReviewCard[] {
    const seen = new Set<string>();
    const output: ReviewCard[] = [];
    cards.forEach((card) => {
      const key = `${card.term}-${card.sourceType}`.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      output.push(card);
    });
    return output;
  }

  private async canUseReviewTables(): Promise<boolean> {
    if (!this.prisma.canUseDatabase()) {
      return false;
    }
    if (this.reviewTablesReady !== null) {
      return this.reviewTablesReady;
    }
    try {
      await this.prisma.reviewQueueItem.findFirst({
        select: { id: true },
      });
      this.reviewTablesReady = true;
      return true;
    } catch (error) {
      if (this.isMissingTableError(error)) {
        this.reviewTablesReady = false;
        this.logger.warn(
          "Review tables not available. Falling back to in-memory schedule.",
        );
        return false;
      }
      throw error;
    }
  }

  private isMissingTableError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    );
  }

  private buildQueueId(userId: string, card: ReviewCard): string {
    return `review-${userId}-${card.sourceType}-${card.id}`.toLowerCase();
  }

  private async syncQueueFromCards(
    userId: string,
    cards: ReviewCard[],
  ): Promise<void> {
    const now = new Date();
    const tablesReady = await this.canUseReviewTables();
    await Promise.all(
      cards.map(async (card) => {
        const queueId = this.buildQueueId(userId, card);
        const createPayload = {
          id: queueId,
          userId,
          sourceType: card.sourceType,
          sourceId: card.id,
          term: card.term,
          definition: card.definition,
          example: card.example,
          exampleTranslation: card.exampleTranslation,
          favoriteType: card.favoriteType,
          conversationId: card.conversationId,
          score: card.score,
          nextReviewAt: now,
        };
        const updatePayload = {
          term: card.term,
          definition: card.definition,
          example: card.example,
          exampleTranslation: card.exampleTranslation,
          favoriteType: card.favoriteType,
          conversationId: card.conversationId,
          score: card.score,
          sourceId: card.id,
        };
        if (tablesReady) {
          try {
            await this.prisma.reviewQueueItem.upsert({
              where: { id: queueId },
              create: createPayload,
              update: updatePayload,
            });
            return;
          } catch (error) {
            if (this.isMissingTableError(error)) {
              this.reviewTablesReady = false;
            } else {
              throw error;
            }
          }
        }

        const fallback = this.queueFallback.get(queueId);
        const snapshot: ReviewQueueSnapshot = fallback ?? {
          id: queueId,
          userId,
          sourceType: card.sourceType,
          sourceId: card.id,
          term: card.term,
          definition: card.definition,
          example: card.example,
          exampleTranslation: card.exampleTranslation,
          favoriteType: card.favoriteType,
          conversationId: card.conversationId,
          score: card.score,
          reviewCount: 0,
          intervalDays: 1,
          easeFactor: 2.5,
          lastReviewedAt: undefined,
          nextReviewAt: now.toISOString(),
        };
        this.queueFallback.set(queueId, snapshot);
      }),
    );
  }

  private async fetchDueQueueCards(
    userId: string,
    limit: number,
  ): Promise<ReviewCard[]> {
    const now = new Date();
    if (await this.canUseReviewTables()) {
      try {
        const items = await this.prisma.reviewQueueItem.findMany({
          where: {
            userId,
            OR: [{ nextReviewAt: null }, { nextReviewAt: { lte: now } }],
          },
          orderBy: [{ nextReviewAt: "asc" }, { updatedAt: "desc" }],
          take: limit,
        });
        return items.map((item) => ({
          id: item.id,
          term: item.term,
          definition: item.definition ?? undefined,
          example: item.example ?? undefined,
          exampleTranslation: item.exampleTranslation ?? undefined,
          sourceType: item.sourceType as ReviewSourceType,
          favoriteType: item.favoriteType as FavoriteTypeEnum | undefined,
          conversationId: item.conversationId ?? undefined,
          score: item.score ?? undefined,
        }));
      } catch (error) {
        if (this.isMissingTableError(error)) {
          this.reviewTablesReady = false;
        } else {
          throw error;
        }
      }
    }

    return Array.from(this.queueFallback.values())
      .filter((item) => item.userId === userId)
      .sort((a, b) => {
        const nextA = a.nextReviewAt ?? "";
        const nextB = b.nextReviewAt ?? "";
        return nextA.localeCompare(nextB);
      })
      .slice(0, limit)
      .map((item) => ({
        id: item.id,
        term: item.term,
        definition: item.definition,
        example: item.example,
        exampleTranslation: item.exampleTranslation,
        sourceType: item.sourceType,
        favoriteType: item.favoriteType,
        conversationId: item.conversationId,
        score: item.score,
      }));
  }

  private async applyFeedbackToQueue(
    dto: ReviewFeedbackDto,
    userId: string,
  ): Promise<void> {
    const queue = await this.prisma.reviewQueueItem.findUnique({
      where: { id: dto.cardId },
    });
    if (!queue || queue.userId !== userId) {
      return;
    }
    const next = this.computeNextSchedule(
      queue.intervalDays,
      queue.easeFactor,
      dto.action,
    );
    const now = new Date();
    await this.prisma.reviewQueueItem.update({
      where: { id: queue.id },
      data: {
        reviewCount: queue.reviewCount + 1,
        intervalDays: next.intervalDays,
        easeFactor: next.easeFactor,
        lastReviewedAt: now,
        nextReviewAt: next.nextReviewAt,
      },
    });
  }

  private updateFallbackSchedule(
    dto: ReviewFeedbackDto,
    userId: string,
    createdAt: string,
  ) {
    const item = this.queueFallback.get(dto.cardId);
    if (!item || item.userId !== userId) {
      return;
    }
    const next = this.computeNextSchedule(
      item.intervalDays,
      item.easeFactor,
      dto.action,
    );
    item.reviewCount += 1;
    item.intervalDays = next.intervalDays;
    item.easeFactor = next.easeFactor;
    item.lastReviewedAt = createdAt;
    item.nextReviewAt = next.nextReviewAt.toISOString();
    this.queueFallback.set(dto.cardId, item);
  }

  private computeNextSchedule(
    intervalDays: number,
    easeFactor: number,
    action: ReviewFeedbackAction,
  ): { intervalDays: number; easeFactor: number; nextReviewAt: Date } {
    const now = new Date();
    if (action === ReviewFeedbackAction.Practice) {
      const nextEase = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2);
      const nextInterval = 1;
      return {
        intervalDays: nextInterval,
        easeFactor: nextEase,
        nextReviewAt: new Date(now.getTime() + nextInterval * 86400000),
      };
    }
    const nextEase = Math.min(MAX_EASE_FACTOR, easeFactor + 0.1);
    const nextInterval = Math.max(1, Math.round(intervalDays * nextEase));
    return {
      intervalDays: nextInterval,
      easeFactor: nextEase,
      nextReviewAt: new Date(now.getTime() + nextInterval * 86400000),
    };
  }
}
