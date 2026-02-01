import { FavoriteTypeEnum } from "../enums/favorite-type.enum";

export type ReviewSourceType = "favorite" | "low_score";

export interface ReviewCard {
  id: string;
  term: string;
  definition?: string;
  example?: string;
  exampleTranslation?: string;
  sourceType: ReviewSourceType;
  favoriteType?: FavoriteTypeEnum;
  conversationId?: string;
  score?: number;
}

export interface DailyReviewPayload {
  date: string;
  cards: ReviewCard[];
}
