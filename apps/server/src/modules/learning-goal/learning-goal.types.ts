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
