import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ConversationMessage } from "../../common/types/conversation.types";
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

type AchievementMetricKey = AchievementDefinition["targetMetric"];

type UserProgressMetrics = Record<AchievementMetricKey, number> & {
  totalXp: number;
};

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);
  private readonly syncTimers = new Map<string, NodeJS.Timeout>();
  private static readonly SEED_RETRY_COOLDOWN_MS = 30_000;
  private seedReady = false;
  private seedPromise?: Promise<void>;
  private seedRetryNotBefore = 0;

  constructor(private readonly prisma: PrismaService) {}

  queueUserProgressSync(userId?: string, delayMs = 400): void {
    if (!userId || !this.prisma.canUseDatabase()) {
      return;
    }
    const existing = this.syncTimers.get(userId);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.syncTimers.delete(userId);
      void this.syncUserProgressNow(userId).catch((error: unknown) => {
        this.logger.warn(
          `Failed to sync achievement progress for ${userId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    }, delayMs);
    this.syncTimers.set(userId, timer);
  }

  async listAchievements(userId?: string): Promise<AchievementWithProgress[]> {
    if (
      !this.prisma.canUseDatabase() &&
      !this.prisma.allowsInMemoryFallback()
    ) {
      this.prisma.ensurePersistentStorageAvailable();
    }
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

    try {
      await this.syncUserProgressNow(userId);
      const rows = await this.prisma.userAchievement.findMany({
        where: { userId },
        include: {
          achievement: {
            select: { code: true },
          },
        },
      });
      const progressMap = new Map(
        rows.map((row) => [
          row.achievement?.code ?? row.achievementId,
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
    } catch (error) {
      if (this.handleDatabaseConnectionError(error, "listAchievements")) {
        return definitions.map((def) => ({
          id: def.code,
          ...def,
          progress: 0,
          unlocked: false,
        }));
      }
      throw error;
    }
  }

  async listLevels(userId?: string): Promise<LevelWithProgress[]> {
    if (
      !this.prisma.canUseDatabase() &&
      !this.prisma.allowsInMemoryFallback()
    ) {
      this.prisma.ensurePersistentStorageAvailable();
    }
    const definitions = await this.getLevelDefinitions();
    let currentXp = 0;
    let currentLevel = 0;

    if (userId && this.prisma.canUseDatabase()) {
      try {
        await this.syncUserProgressNow(userId);
        const userLevel = await this.prisma.userLevel.findUnique({
          where: { userId },
          include: { level: true },
        });
        currentXp = userLevel?.currentXp ?? 0;
        currentLevel = userLevel?.level?.level ?? 0;
      } catch (error) {
        if (!this.handleDatabaseConnectionError(error, "listLevels")) {
          throw error;
        }
      }
    }

    return definitions.map((def) => ({
      id: def.level.toString(),
      ...def,
      unlocked: currentLevel >= def.level || currentXp >= def.minXp,
    }));
  }

  async getSummary(userId?: string): Promise<AchievementSummary> {
    if (
      !this.prisma.canUseDatabase() &&
      !this.prisma.allowsInMemoryFallback()
    ) {
      this.prisma.ensurePersistentStorageAvailable();
    }
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

    try {
      await this.syncUserProgressNow(userId);
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
    } catch (error) {
      if (this.handleDatabaseConnectionError(error, "getSummary")) {
        return {
          unlockedCount: 0,
          totalCount,
          completionRate: 0,
          currentLevel: 0,
          totalXp: 0,
        };
      }
      throw error;
    }
  }

  private async getAchievementDefinitions(): Promise<AchievementDefinition[]> {
    if (!this.prisma.canUseDatabase()) {
      return ACHIEVEMENT_SEED;
    }
    try {
      await this.ensureSeedData();
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
        this.handleDatabaseConnectionError(error, "getAchievementDefinitions")
      ) {
        return ACHIEVEMENT_SEED;
      }
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
      await this.ensureSeedData();
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
      if (this.handleDatabaseConnectionError(error, "getLevelDefinitions")) {
        return LEVEL_SEED;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2021" || error.code === "P2022")
      ) {
        return LEVEL_SEED;
      }
      throw error;
    }
  }

  private async syncUserProgressNow(userId: string): Promise<void> {
    if (!this.prisma.canUseDatabase()) {
      return;
    }
    try {
      await this.ensureSeedData();
      if (!this.prisma.canUseDatabase()) {
        return;
      }
      const definitions = await this.getAchievementDefinitions();
      if (!this.prisma.canUseDatabase()) {
        return;
      }
      const [metrics, achievements, levelRows] = await Promise.all([
        this.collectUserMetrics(userId),
        this.prisma.achievement.findMany({
          select: { id: true, code: true },
        }),
        this.prisma.levelDefinition.findMany({
          select: { id: true, level: true, minXp: true },
        }),
      ]);
      const achievementIdByCode = new Map(
        achievements.map((item) => [item.code, item.id] as const),
      );
      const now = new Date();

      await this.prisma.$transaction(async (tx) => {
        for (const definition of definitions) {
          const achievementId = achievementIdByCode.get(definition.code);
          if (!achievementId) {
            continue;
          }
          const progress = Math.min(
            metrics[definition.targetMetric],
            definition.targetValue,
          );
          const unlocked =
            metrics[definition.targetMetric] >= definition.targetValue;
          await tx.userAchievement.upsert({
            where: {
              userId_achievementId: {
                userId,
                achievementId,
              },
            },
            update: {
              progress,
              unlockedAt: unlocked ? now : null,
            },
            create: {
              userId,
              achievementId,
              progress,
              unlockedAt: unlocked ? now : null,
            },
          });
        }

        const currentLevel =
          levelRows
            .slice()
            .sort((left, right) => left.level - right.level)
            .reverse()
            .find((level) => metrics.totalXp >= level.minXp) ?? levelRows[0];
        if (!currentLevel) {
          return;
        }
        await tx.userLevel.upsert({
          where: { userId },
          update: {
            levelId: currentLevel.id,
            currentXp: metrics.totalXp,
          },
          create: {
            userId,
            levelId: currentLevel.id,
            currentXp: metrics.totalXp,
          },
        });
      });
    } catch (error) {
      if (this.handleDatabaseConnectionError(error, "syncUserProgressNow")) {
        return;
      }
      throw error;
    }
  }

  private async ensureSeedData(): Promise<void> {
    if (!this.prisma.canUseDatabase()) {
      return;
    }
    if (this.seedReady) {
      return;
    }
    if (Date.now() < this.seedRetryNotBefore) {
      return;
    }
    if (!this.seedPromise) {
      this.seedPromise = this.seedDefinitionsIfNeeded();
    }
    try {
      await this.seedPromise;
      this.seedReady = true;
      this.seedRetryNotBefore = 0;
    } catch (error) {
      this.seedPromise = undefined;
      if (this.handleDatabaseConnectionError(error, "ensureSeedData")) {
        this.seedRetryNotBefore =
          Date.now() + AchievementService.SEED_RETRY_COOLDOWN_MS;
        return;
      }
      throw error;
    }
  }

  private async seedDefinitionsIfNeeded(): Promise<void> {
    const [achievementCount, levelCount] = await Promise.all([
      this.prisma.achievement.count(),
      this.prisma.levelDefinition.count(),
    ]);

    const hasAchievementSeed = achievementCount >= ACHIEVEMENT_SEED.length;
    const hasLevelSeed = levelCount >= LEVEL_SEED.length;
    if (hasAchievementSeed && hasLevelSeed) {
      return;
    }

    await this.seedDefinitions();
  }

  private async seedDefinitions(): Promise<void> {
    const upserts = [
      ...ACHIEVEMENT_SEED.map((definition) =>
        this.prisma.achievement.upsert({
          where: { code: definition.code },
          update: {
            title: definition.title,
            description: definition.description,
            icon: definition.icon,
            color: definition.color,
            rarity: definition.rarity,
            targetValue: definition.targetValue,
            targetMetric: definition.targetMetric,
          },
          create: {
            code: definition.code,
            title: definition.title,
            description: definition.description,
            icon: definition.icon,
            color: definition.color,
            rarity: definition.rarity,
            targetValue: definition.targetValue,
            targetMetric: definition.targetMetric,
          },
        }),
      ),
      ...LEVEL_SEED.map((level) =>
        this.prisma.levelDefinition.upsert({
          where: { level: level.level },
          update: {
            title: level.title,
            icon: level.icon,
            color: level.color,
            minXp: level.minXp,
          },
          create: {
            level: level.level,
            title: level.title,
            icon: level.icon,
            color: level.color,
            minXp: level.minXp,
          },
        }),
      ),
    ];

    await Promise.all(upserts);
  }

  private handleDatabaseConnectionError(
    error: unknown,
    context: string,
  ): boolean {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P1001" || error.code === "P1002")
    ) {
      const summary = error.message.split("\n").find(Boolean)?.trim();
      this.logger.warn(
        `Achievement service fallback in ${context}: ${error.code}${
          summary ? ` ${summary}` : ""
        }`,
      );
      this.prisma.markDatabaseUnavailable(
        `Achievement service connection failure in ${context}.`,
      );
      return true;
    }
    return false;
  }

  private async collectUserMetrics(
    userId: string,
  ): Promise<UserProgressMetrics> {
    const [conversations, reviewFeedback, learningActivity] = await Promise.all(
      [
        this.prisma.conversation.findMany({
          where: { userId },
          select: {
            targetLanguage: true,
            messages: true,
            updatedAt: true,
          },
        }),
        this.prisma.reviewFeedback.findMany({
          where: { userId },
          select: { createdAt: true },
        }),
        this.prisma.learningActivityDaily.findMany({
          where: {
            userId,
            focusSeconds: { gt: 0 },
          },
          select: { dateKey: true },
        }),
      ],
    );

    const distinctVocabulary = new Set<string>();
    const activeDays = new Set<string>(
      learningActivity.map((row) => row.dateKey),
    );
    const masteredLanguages = new Set<string>();
    const todayKey = this.toDateKey(new Date());

    let conversationCount = 0;
    let perfectScoreCount = 0;
    let conversationsToday = 0;

    conversations.forEach((conversation) => {
      const messages = Array.isArray(conversation.messages)
        ? (conversation.messages as unknown as ConversationMessage[])
        : [];
      const userMessages = messages.filter(
        (message) => message.sender === "user",
      );
      if (userMessages.length === 0) {
        return;
      }
      conversationCount += 1;
      masteredLanguages.add(conversation.targetLanguage);

      const userDayKeys = new Set<string>();
      userMessages.forEach((message) => {
        const dateKey = this.toDateKey(new Date(message.createdAt));
        if (dateKey) {
          userDayKeys.add(dateKey);
          activeDays.add(dateKey);
        }
        this.extractVocabularyTokens(message.text).forEach((token) => {
          distinctVocabulary.add(token);
        });
      });
      if (userDayKeys.has(todayKey)) {
        conversationsToday += 1;
      }

      messages.forEach((message) => {
        if (message.sender !== "ai") {
          return;
        }
        if ((message.meta?.score ?? 0) >= 100) {
          perfectScoreCount += 1;
        }
        message.meta?.keyTerms?.forEach((term) => {
          const normalized = this.normalizeVocabularyToken(term.term);
          if (normalized) {
            distinctVocabulary.add(normalized);
          }
        });
      });
    });

    reviewFeedback.forEach((item) => {
      const dateKey = this.toDateKey(item.createdAt);
      if (dateKey) {
        activeDays.add(dateKey);
      }
    });

    const reviewToday = reviewFeedback.filter(
      (item) => this.toDateKey(item.createdAt) === todayKey,
    ).length;
    const streakDays = this.computeStreakDays(activeDays, todayKey);
    const dailyLessons = conversationsToday + reviewToday;
    const totalXp =
      conversationCount * 10 +
      distinctVocabulary.size +
      perfectScoreCount * 20 +
      reviewFeedback.length * 3 +
      streakDays * 5 +
      masteredLanguages.size * 25;

    return {
      conversation_count: conversationCount,
      streak_days: streakDays,
      vocab_count: distinctVocabulary.size,
      perfect_score_count: perfectScoreCount,
      daily_lessons: dailyLessons,
      language_mastery: masteredLanguages.size,
      totalXp,
    };
  }

  private computeStreakDays(activeDays: Set<string>, todayKey: string): number {
    if (!activeDays.size) {
      return 0;
    }
    const today = this.fromDateKey(todayKey);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const latestKey = activeDays.has(todayKey)
      ? todayKey
      : activeDays.has(this.toDateKey(yesterday))
        ? this.toDateKey(yesterday)
        : "";
    if (!latestKey) {
      return 0;
    }
    let streak = 0;
    const cursor = this.fromDateKey(latestKey);
    while (activeDays.has(this.toDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  private extractVocabularyTokens(text: string): string[] {
    return text
      .split(/\s+/)
      .map((token) => this.normalizeVocabularyToken(token))
      .filter((token): token is string => Boolean(token));
  }

  private normalizeVocabularyToken(token: string): string | undefined {
    const normalized = token
      .toLowerCase()
      .replace(/[^\p{L}\p{N}']/gu, "")
      .trim();
    return normalized.length >= 2 ? normalized : undefined;
  }

  private toDateKey(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toISOString().slice(0, 10);
  }

  private fromDateKey(dateKey: string): Date {
    return new Date(`${dateKey}T00:00:00.000Z`);
  }
}
