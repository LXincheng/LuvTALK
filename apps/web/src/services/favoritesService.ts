import { apiClient, cachedGet, invalidateCache } from './apiClient';
import type { FavoriteItem, FavoriteType } from '../types/api';
import { invalidateDailyReviewCache } from './reviewService';

export interface CreateFavoritePayload {
  title: string;
  content: string;
  type: FavoriteType;
  metadata?: Record<string, unknown>;
  conversationId?: string;
}

export function fetchFavorites() {
  return apiClient.get<FavoriteItem[]>('/favorites');
}

export function fetchFavoritesCached() {
  return cachedGet('favorites', fetchFavorites);
}

export function createFavorite(payload: CreateFavoritePayload) {
  invalidateCache('favorites');
  invalidateDailyReviewCache();
  return apiClient.post<FavoriteItem, CreateFavoritePayload>(
    '/favorites',
    payload,
  );
}

export function removeFavorite(id: string) {
  invalidateCache('favorites');
  invalidateDailyReviewCache();
  return apiClient.delete<void>(`/favorites/${id}`);
}
