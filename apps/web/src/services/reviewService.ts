import { apiClient, cachedGet, invalidateCache } from './apiClient';
import type {
  DailyReviewPayload,
  ReviewSourceType,
} from '../types/api';

export type ReviewFeedbackAction = 'known' | 'practice';

export interface ReviewFeedbackPayload {
  cardId: string;
  action: ReviewFeedbackAction;
  sourceType?: ReviewSourceType;
  conversationId?: string;
}

const DAILY_REVIEW_CACHE_KEY = 'daily-review';
const DAILY_REVIEW_STORAGE_KEY = 'daily-review-cache-v2';

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const readPersistedDailyReview = (): DailyReviewPayload | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(DAILY_REVIEW_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const payload = JSON.parse(raw) as DailyReviewPayload;
    if (
      !payload ||
      typeof payload !== 'object' ||
      payload.date !== getTodayKey() ||
      !Array.isArray(payload.cards)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

const writePersistedDailyReview = (payload: DailyReviewPayload) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(
    DAILY_REVIEW_STORAGE_KEY,
    JSON.stringify(payload),
  );
};

export function invalidateDailyReviewCache() {
  invalidateCache(DAILY_REVIEW_CACHE_KEY);
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(DAILY_REVIEW_STORAGE_KEY);
  }
}

export function fetchDailyReview() {
  return apiClient.get<DailyReviewPayload>('/review/daily').then((payload) => {
    writePersistedDailyReview(payload);
    return payload;
  });
}

export function fetchDailyReviewCached() {
  const persisted = readPersistedDailyReview();
  const { cached, fresh } = cachedGet(DAILY_REVIEW_CACHE_KEY, fetchDailyReview);
  return {
    cached: cached ?? persisted,
    fresh,
  };
}

export function submitReviewFeedback(payload: ReviewFeedbackPayload) {
  invalidateDailyReviewCache();
  return apiClient.post<{ status: string }, ReviewFeedbackPayload>(
    '/review/feedback',
    payload,
  );
}
