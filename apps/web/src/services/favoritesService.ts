import { FavoriteItem, FavoriteType } from '../types/api';
import { apiClient } from './apiClient';

export interface FavoritePayload {
  title: string;
  content: string;
  type: FavoriteType;
  metadata?: Record<string, unknown>;
  pinned?: boolean;
}

const fallbackFavorites: FavoriteItem[] = [
  {
    id: 'fav-1',
    title: '礼貌结束语',
    content: '多谢晒你嘅帮助，改日再见！',
    type: 'cultural',
    createdAt: new Date().toISOString(),
    authorName: 'LuvTALK 导师',
    avatar: 'https://i.pravatar.cc/120?img=3',
    metadata: { scenario: 'daily', language: 'cantonese' },
  },
  {
    id: 'fav-2',
    title: '点餐句型',
    content: 'Can I have the chef’s recommendation, please?',
    type: 'phrase',
    createdAt: new Date().toISOString(),
    authorName: '我',
    avatar: 'https://i.pravatar.cc/120?img=58',
    metadata: { scenario: 'restaurant', language: 'english' },
  },
];

export async function fetchFavorites() {
  try {
    const result = await apiClient.get<FavoriteItem[]>('/favorites');
    return result;
  } catch {
    return [...fallbackFavorites];
  }
}

export async function createFavorite(payload: FavoritePayload) {
  try {
    return await apiClient.post<FavoriteItem, FavoritePayload>('/favorites', payload);
  } catch {
    const item: FavoriteItem = {
      id: `fav-${Date.now()}`,
      title: payload.title,
      content: payload.content,
      type: payload.type,
      metadata: payload.metadata as Record<string, string | number>,
      createdAt: new Date().toISOString(),
      authorName: payload.type === 'phrase' ? '我' : 'LuvTALK 导师',
      avatar: payload.type === 'phrase' ? 'https://i.pravatar.cc/120?img=58' : 'https://i.pravatar.cc/120?img=3',
    };
    fallbackFavorites.unshift(item);
    return item;
  }
}

export async function removeFavorite(id: string) {
  try {
    await apiClient.delete<void>(`/favorites/${id}`);
  } catch {
    const index = fallbackFavorites.findIndex(item => item.id === id);
    if (index >= 0) {
      fallbackFavorites.splice(index, 1);
    }
  }
}
