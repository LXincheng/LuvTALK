import { apiClient } from './apiClient';
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

export function fetchDailyReview() {
  return apiClient.get<DailyReviewPayload>('/review/daily');
}

export function submitReviewFeedback(payload: ReviewFeedbackPayload) {
  return apiClient.post<{ status: string }, ReviewFeedbackPayload>(
    '/review/feedback',
    payload,
  );
}
