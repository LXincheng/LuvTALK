import { apiClient } from './apiClient';
import type { FavoriteItem, FavoriteType } from '../types/api';

export interface CreateFavoritePayload {
  title: string;
  content: string;
  type: FavoriteType;
  metadata?: Record<string, unknown>;
}

export function fetchFavorites() {
  return apiClient.get<FavoriteItem[]>('/favorites');
}

export function createFavorite(payload: CreateFavoritePayload) {
  return apiClient.post<FavoriteItem, CreateFavoritePayload>(
    '/favorites',
    payload,
  );
}

export function removeFavorite(id: string) {
  return apiClient.delete<void>(`/favorites/${id}`);
}
