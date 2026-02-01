import { Injectable, Logger } from "@nestjs/common";
import { FavoriteItem } from "../../common/types/conversation.types";
import {
  DailyReviewPayload,
  ReviewCard,
} from "../../common/types/review.types";
import { FavoritesService } from "../favorites/favorites.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { ConversationMessage } from "../../common/types/conversation.types";
import { ConversationService } from "../conversation/conversation.service";
import {
  ReviewFeedbackAction,
  ReviewFeedbackDto,
} from "./dto/review-feedback.dto";

const LOW_SCORE_THRESHOLD = 60;
const MAX_LOW_SCORE_CARDS = 4;
const MAX_DAILY_CARDS = 10;

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);
  private readonly feedbackLog = new Map<
    string,
    ReviewFeedbackDto & { createdAt: string }
  >();

  constructor(
    private readonly favoritesService: FavoritesService,
    private readonly prisma: PrismaService,
    private readonly conversationService: ConversationService,
  ) {}

  async buildDailyReview(): Promise<DailyReviewPayload> {
    const favorites = this.favoritesService.list();
    const favoriteCards = this.buildFavoriteCards(favorites);
    const lowScoreCards = await this.buildLowScoreCards();

    const merged = [
      ...lowScoreCards.slice(0, MAX_LOW_SCORE_CARDS),
      ...favoriteCards,
    ];

    const deduped = this.deduplicateCards(merged);

    return {
      date: new Date().toISOString().split("T")[0],
      cards: deduped.slice(0, MAX_DAILY_CARDS),
    };
  }

  recordFeedback(dto: ReviewFeedbackDto): { status: string } {
    const createdAt = new Date().toISOString();
    const entry = { ...dto, createdAt };
    this.feedbackLog.set(`${dto.cardId}-${createdAt}`, entry);
    const actionLabel =
      dto.action === ReviewFeedbackAction.Known ? "known" : "practice";
    this.logger.log(
      `Review feedback: card=${dto.cardId} action=${actionLabel} source=${dto.sourceType ?? "unknown"}`,
    );
    return { status: "ok" };
  }

  private buildFavoriteCards(favorites: FavoriteItem[]): ReviewCard[] {
    return favorites.map((favorite) => {
      const metadata = favorite.metadata ?? {};
      const definition =
        typeof metadata.definition === "string"
          ? metadata.definition
          : favorite.content;
      const translation =
        typeof metadata.translation === "string"
          ? metadata.translation
          : undefined;
      const examples = Array.isArray(metadata.examples)
        ? metadata.examples.filter(
            (example): example is string => typeof example === "string",
          )
        : [];
      return {
        id: favorite.id,
        term: favorite.title,
        definition,
        example: examples[0] ?? translation ?? undefined,
        exampleTranslation:
          typeof metadata.exampleTranslation === "string"
            ? metadata.exampleTranslation
            : undefined,
        sourceType: "favorite",
        favoriteType: favorite.type,
        conversationId: favorite.conversationId,
      };
    });
  }

  private async buildLowScoreCards(): Promise<ReviewCard[]> {
    const cards: ReviewCard[] = [];
    if (this.prisma.canUseDatabase()) {
      const records = await this.prisma.conversation.findMany({
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
      cards.push(...this.extractLowScoreCards(session.id, session.messages));
    });
    return cards;
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
      const score = message.meta?.score;
      if (typeof score !== "number" || score >= LOW_SCORE_THRESHOLD) {
        return;
      }
      for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const userMessage = messages[cursor];
        if (userMessage?.sender === "user") {
          cards.push({
            id: `${conversationId}-${message.id}`,
            term: userMessage.text,
            definition: message.meta?.scoreReason,
            example: message.text,
            exampleTranslation: message.meta?.translation,
            sourceType: "low_score",
            conversationId,
            score,
          });
          break;
        }
      }
    });
    return cards;
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
}
