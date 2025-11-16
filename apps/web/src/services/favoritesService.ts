import { FavoriteItem, FavoriteType } from '../types/api';
import { apiClient } from './apiClient';

export interface FavoritePayload {
  title: string;
  content: string;
  type: FavoriteType;
  metadata?: Record<string, unknown>;
  pinned?: boolean;
}

export async function fetchFavorites() {
  return apiClient.get<FavoriteItem[]>('/favorites');
}

export async function createFavorite(payload: FavoritePayload) {
  return apiClient.post<FavoriteItem, FavoritePayload>('/favorites', payload);
}

export async function removeFavorite(id: string) {
  await apiClient.delete<void>(`/favorites/${id}`);
}

