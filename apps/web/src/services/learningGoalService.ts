import { apiClient, cachedGet, invalidateCache } from './apiClient';

export interface LearningGoalSettings {
  dailyMinutes: number;
  weeklyWords: number;
  weeklySpeaking: number;
  updatedAt: string | null;
}

export interface LearningGoalProgress {
  dailyMinutes: number;
  weeklyWords: number;
  weeklySpeaking: number;
}

export interface LearningGoalCompletion {
  dailyMinutes: number;
  weeklyWords: number;
  weeklySpeaking: number;
  overall: number;
}

export interface LearningGoalPayload {
  goal: LearningGoalSettings;
  progress: LearningGoalProgress;
  completion: LearningGoalCompletion;
}

const LEARNING_GOAL_CACHE_KEY = 'learning-goal';

export function fetchLearningGoalCached() {
  return cachedGet(LEARNING_GOAL_CACHE_KEY, () =>
    apiClient.get<LearningGoalPayload>('/learning-goal'),
  );
}

export async function saveLearningGoal(payload: {
  dailyMinutes: number;
  weeklyWords: number;
  weeklySpeaking: number;
}) {
  const result = await apiClient.post<LearningGoalPayload, typeof payload>(
    '/learning-goal',
    payload,
  );
  invalidateCache(LEARNING_GOAL_CACHE_KEY);
  return result;
}

export async function reportLearningFocus(focusSeconds: number) {
  const result = await apiClient.post<LearningGoalPayload, { focusSeconds: number }>(
    '/learning-goal/focus',
    { focusSeconds },
  );
  invalidateCache(LEARNING_GOAL_CACHE_KEY);
  return result;
}
