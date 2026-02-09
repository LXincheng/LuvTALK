import { apiClient, cachedGet } from './apiClient';

export interface AchievementWithProgress {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  targetValue: number;
  targetMetric: string;
  progress: number;
  unlocked: boolean;
}

export interface LevelWithProgress {
  id: string;
  level: number;
  title: string;
  icon: string;
  color: string;
  minXp: number;
  unlocked: boolean;
}

export interface AchievementSummary {
  unlockedCount: number;
  totalCount: number;
  completionRate: number;
  currentLevel: number;
  totalXp: number;
}

export function fetchAchievements() {
  return apiClient.get<AchievementWithProgress[]>('/achievements');
}

export function fetchLevels() {
  return apiClient.get<LevelWithProgress[]>('/achievements/levels');
}

export function fetchAchievementSummary() {
  return apiClient.get<AchievementSummary>('/achievements/summary');
}

export function fetchAchievementsCached() {
  return cachedGet('achievements', fetchAchievements);
}

export function fetchLevelsCached() {
  return cachedGet('levels', fetchLevels);
}

export function fetchAchievementSummaryCached() {
  return cachedGet('achievement-summary', fetchAchievementSummary);
}
