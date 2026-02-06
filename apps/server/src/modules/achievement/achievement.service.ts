import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../core/prisma/prisma.service";
import {
  AchievementDefinition,
  AchievementSummary,
  AchievementWithProgress,
  LevelDefinition,
  LevelWithProgress,
} from "./achievement.types";

const ACHIEVEMENT_SEED: AchievementDefinition[] = [
  {
    code: "first_steps",
    title: "First Steps",
    description: "Complete your first conversation",
    icon: "💬",
    color: "from-blue-500 to-cyan-500",
    rarity: "common",
    targetValue: 1,
    targetMetric: "conversation_count",
  },
  {
    code: "week_warrior",
    title: "Week Warrior",
    description: "Maintain a 7-day streak",
    icon: "🔥",
    color: "from-orange-500 to-red-500",
    rarity: "rare",
    targetValue: 7,
    targetMetric: "streak_days",
  },
  {
    code: "vocab_master",
    title: "Vocabulary Master",
    description: "Learn 500 new words",
    icon: "📚",
    color: "from-green-500 to-emerald-500",
    rarity: "epic",
    targetValue: 500,
    targetMetric: "vocab_count",
  },
  {
    code: "perfect_pronunciation",
    title: "Perfect Pronunciation",
    description: "Get 100/100 pronunciation score",
    icon: "🎯",
    color: "from-purple-500 to-pink-500",
    rarity: "rare",
    targetValue: 1,
    targetMetric: "perfect_score_count",
  },
  {
    code: "social_butterfly",
    title: "Social Butterfly",
    description: "Complete 100 conversations",
    icon: "🦋",
    color: "from-indigo-500 to-blue-500",
    rarity: "epic",
    targetValue: 100,
    targetMetric: "conversation_count",
  },
  {
    code: "speed_learner",
    title: "Speed Learner",
    description: "Complete 10 lessons in one day",
    icon: "⚡",
    color: "from-yellow-500 to-orange-500",
    rarity: "rare",
    targetValue: 10,
    targetMetric: "daily_lessons",
  },
  {
    code: "polyglot",
    title: "Polyglot",
    description: "Master 3 different languages",
    icon: "🌍",
    color: "from-cyan-500 to-blue-500",
    rarity: "legendary",
    targetValue: 3,
    targetMetric: "language_mastery",
  },
  {
    code: "diamond_streak",
    title: "Diamond Streak",
    description: "Maintain a 30-day streak",
    icon: "💎",
    color: "from-pink-500 to-purple-500",
    rarity: "legendary",
    targetValue: 30,
    targetMetric: "streak_days",
  },
];

const LEVEL_SEED: LevelDefinition[] = [
  {
    level: 1,
    title: "Beginner",
    icon: "⭐",
    color: "from-gray-400 to-gray-500",
    minXp: 0,
  },
  {
    level: 2,
    title: "Novice",
    icon: "🎯",
    color: "from-green-400 to-green-500",
    minXp: 100,
  },
  {
    level: 3,
    title: "Learner",
    icon: "📖",
    color: "from-blue-400 to-blue-500",
    minXp: 300,
  },
  {
    level: 4,
    title: "Intermediate",
    icon: "📈",
    color: "from-purple-400 to-purple-500",
    minXp: 600,
  },
  {
    level: 5,
    title: "Advanced",
    icon: "🏅",
    color: "from-orange-400 to-orange-500",
    minXp: 1000,
  },
  {
    level: 6,
    title: "Expert",
    icon: "🥇",
    color: "from-red-400 to-red-500",
    minXp: 1500,
  },
  {
    level: 7,
    title: "Master",
    icon: "🏆",
    color: "from-yellow-400 to-yellow-500",
    minXp: 2200,
  },
  {
    level: 8,
    title: "Legend",
    icon: "👑",
    color: "from-purple-500 to-pink-500",
    minXp: 3000,
  },
];

@Injectable()
export class AchievementService {
  constructor(private readonly prisma: PrismaService) {}

  async listAchievements(userId?: string): Promise<AchievementWithProgress[]> {
    const definitions = await this.getAchievementDefinitions();
    if (!userId) {
      return definitions.map((def) => ({
        id: def.code,
        ...def,
        progress: 0,
        unlocked: false,
      }));
    }

    if (!this.prisma.canUseDatabase()) {
      return definitions.map((def) => ({
        id: def.code,
        ...def,
        progress: 0,
        unlocked: false,
      }));
    }

    const rows = await this.prisma.userAchievement.findMany({
      where: { userId },
    });
    const progressMap = new Map(
      rows.map((row) => [
        row.achievementId,
        {
          progress: row.progress,
          unlocked: Boolean(row.unlockedAt),
        },
      ]),
    );

    return definitions.map((def) => {
      const row = progressMap.get(def.code);
      return {
        id: def.code,
        ...def,
        progress: row?.progress ?? 0,
        unlocked: row?.unlocked ?? false,
      };
    });
  }

  async listLevels(userId?: string): Promise<LevelWithProgress[]> {
    const definitions = await this.getLevelDefinitions();
    let currentXp = 0;
    let currentLevel = 0;

    if (userId && this.prisma.canUseDatabase()) {
      const userLevel = await this.prisma.userLevel.findUnique({
        where: { userId },
        include: { level: true },
      });
      currentXp = userLevel?.currentXp ?? 0;
      currentLevel = userLevel?.level?.level ?? 0;
    }

    return definitions.map((def) => ({
      id: def.level.toString(),
      ...def,
      unlocked: currentLevel >= def.level || currentXp >= def.minXp,
    }));
  }

  async getSummary(userId?: string): Promise<AchievementSummary> {
    const totalCount = ACHIEVEMENT_SEED.length;
    if (!userId || !this.prisma.canUseDatabase()) {
      return {
        unlockedCount: 0,
        totalCount,
        completionRate: 0,
        currentLevel: 0,
        totalXp: 0,
      };
    }

    const unlockedCount = await this.prisma.userAchievement.count({
      where: { userId, unlockedAt: { not: null } },
    });
    const levelRow = await this.prisma.userLevel.findUnique({
      where: { userId },
      include: { level: true },
    });

    const totalXp = levelRow?.currentXp ?? 0;
    const currentLevel = levelRow?.level?.level ?? 0;
    const completionRate =
      totalCount === 0 ? 0 : Math.round((unlockedCount / totalCount) * 100);

    return {
      unlockedCount,
      totalCount,
      completionRate,
      currentLevel,
      totalXp,
    };
  }

  private async getAchievementDefinitions(): Promise<AchievementDefinition[]> {
    if (!this.prisma.canUseDatabase()) {
      return ACHIEVEMENT_SEED;
    }
    try {
      const rows = await this.prisma.achievement.findMany({
        orderBy: { createdAt: "asc" },
      });
      if (!rows.length) {
        return ACHIEVEMENT_SEED;
      }
      return rows.map((row) => ({
        code: row.code,
        title: row.title,
        description: row.description,
        icon: row.icon,
        color: row.color,
        rarity: row.rarity as AchievementDefinition["rarity"],
        targetValue: row.targetValue,
        targetMetric: row.targetMetric,
      }));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2021" || error.code === "P2022")
      ) {
        return ACHIEVEMENT_SEED;
      }
      throw error;
    }
  }

  private async getLevelDefinitions(): Promise<LevelDefinition[]> {
    if (!this.prisma.canUseDatabase()) {
      return LEVEL_SEED;
    }
    try {
      const rows = await this.prisma.levelDefinition.findMany({
        orderBy: { level: "asc" },
      });
      if (!rows.length) {
        return LEVEL_SEED;
      }
      return rows.map((row) => ({
        level: row.level,
        title: row.title,
        icon: row.icon,
        color: row.color,
        minXp: row.minXp,
      }));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2021" || error.code === "P2022")
      ) {
        return LEVEL_SEED;
      }
      throw error;
    }
  }
}
