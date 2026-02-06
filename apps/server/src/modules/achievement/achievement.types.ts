export interface AchievementDefinition {
  code: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  targetValue: number;
  targetMetric: string;
}

export interface LevelDefinition {
  level: number;
  title: string;
  icon: string;
  color: string;
  minXp: number;
}

export interface AchievementWithProgress extends AchievementDefinition {
  id: string;
  progress: number;
  unlocked: boolean;
}

export interface LevelWithProgress extends LevelDefinition {
  id: string;
  unlocked: boolean;
}

export interface AchievementSummary {
  unlockedCount: number;
  totalCount: number;
  completionRate: number;
  currentLevel: number;
  totalXp: number;
}
