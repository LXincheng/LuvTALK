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
  conversationCount: number;
  vocabCount: number;
  streakDays: number;
  averageScore: number | null;
}

const isEmptySummary = (summary: AchievementSummary) =>
  summary.unlockedCount === 0 &&
  summary.currentLevel === 0 &&
  summary.totalXp === 0 &&
  summary.conversationCount === 0 &&
  summary.vocabCount === 0 &&
  summary.streakDays === 0 &&
  summary.averageScore == null;

const hasMeaningfulAchievementProgress = (
  items: AchievementWithProgress[],
) => items.some((item) => item.unlocked || item.progress > 0);

const getUnlockedLevel = (items: LevelWithProgress[]) =>
  items.reduce((max, item) => (item.unlocked ? Math.max(max, item.level) : max), 0);

export function fetchAchievements() {
  return apiClient.get<AchievementWithProgress[]>('/achievements', {
    timeoutMs: 12000,
  });
}

export function fetchLevels() {
  return apiClient.get<LevelWithProgress[]>('/achievements/levels', {
    timeoutMs: 12000,
  });
}

export function fetchAchievementSummary() {
  return apiClient.get<AchievementSummary>('/achievements/summary', {
    timeoutMs: 12000,
  });
}

export function fetchAchievementsCached(userKey = 'guest') {
  return cachedGet(`achievements:${userKey}`, fetchAchievements, {
    shouldReplaceCache: (current, next) => {
      if (!current) {
        return true;
      }
      if (
        hasMeaningfulAchievementProgress(current) &&
        !hasMeaningfulAchievementProgress(next)
      ) {
        return false;
      }
      return true;
    },
  });
}

export function fetchLevelsCached(userKey = 'guest') {
  return cachedGet(`levels:${userKey}`, fetchLevels, {
    shouldReplaceCache: (current, next) => {
      if (!current) {
        return true;
      }
      return getUnlockedLevel(next) >= getUnlockedLevel(current);
    },
  });
}

export function fetchAchievementSummaryCached(userKey = 'guest') {
  return cachedGet(`achievement-summary:${userKey}`, fetchAchievementSummary, {
    shouldReplaceCache: (current, next) => {
      if (!current) {
        return true;
      }
      if (!isEmptySummary(current) && isEmptySummary(next)) {
        return false;
      }
      return true;
    },
  });
}
