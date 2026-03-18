import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ConversationMessage } from "../../common/types/conversation.types";
import { PrismaService } from "../../core/prisma/prisma.service";
import { ConversationService } from "../conversation/conversation.service";
import { UpsertLearningGoalDto } from "./dto/upsert-learning-goal.dto";
import { RecordLearningFocusDto } from "./dto/record-learning-focus.dto";
import {
  computeLearningGoalProgress,
  mergeFocusMinutesIntoProgress,
} from "./learning-goal.progress";
import {
  LearningGoalCompletion,
  LearningGoalPayload,
  LearningGoalProgress,
  LearningGoalSettings,
} from "./learning-goal.types";

const DEFAULT_SETTINGS: Omit<LearningGoalSettings, "updatedAt"> = {
  dailyMinutes: 10,
  weeklyWords: 20,
  weeklySpeaking: 3,
};

@Injectable()
export class LearningGoalService {
  private readonly logger = new Logger(LearningGoalService.name);
  private learningGoalTableReady: boolean | null = null;
  private learningActivityTableReady: boolean | null = null;
  private readonly fallbackByUser = new Map<string, LearningGoalSettings>();
  private readonly fallbackFocusSecondsByKey = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationService: ConversationService,
  ) {}

  async getGoal(userId?: string): Promise<LearningGoalPayload> {
    if (
      !this.prisma.canUseDatabase() &&
      !this.prisma.allowsInMemoryFallback()
    ) {
      this.prisma.ensurePersistentStorageAvailable();
    }
    const now = new Date();
    const goal = await this.resolveGoalSettings(userId);
    const progress = await this.resolveProgress(userId, now);
    return {
      goal,
      progress,
      completion: this.computeCompletion(goal, progress),
    };
  }

  async recordFocus(
    dto: RecordLearningFocusDto,
    userId?: string,
  ): Promise<LearningGoalPayload> {
    if (
      !this.prisma.canUseDatabase() &&
      !this.prisma.allowsInMemoryFallback()
    ) {
      this.prisma.ensurePersistentStorageAvailable();
    }
    const now = new Date();
    const dateKey = this.toDateKey(now);
    const safeSeconds = Math.max(15, Math.min(600, dto.focusSeconds));

    if (!userId) {
      const key = `guest:${dateKey}`;
      const prev = this.fallbackFocusSecondsByKey.get(key) ?? 0;
      this.fallbackFocusSecondsByKey.set(key, prev + safeSeconds);
      return this.getGoal();
    }

    if (
      (await this.canUseLearningActivityTable()) &&
      this.prisma.canUseDatabase()
    ) {
      try {
        await this.prisma.learningActivityDaily.upsert({
          where: {
            userId_dateKey: {
              userId,
              dateKey,
            },
          },
          create: {
            userId,
            dateKey,
            focusSeconds: safeSeconds,
          },
          update: {
            focusSeconds: {
              increment: safeSeconds,
            },
          },
        });
      } catch (error) {
        if (this.isMissingLearningActivityTable(error)) {
          this.learningActivityTableReady = false;
          const fallbackKey = `${userId}:${dateKey}`;
          const prev = this.fallbackFocusSecondsByKey.get(fallbackKey) ?? 0;
          this.fallbackFocusSecondsByKey.set(fallbackKey, prev + safeSeconds);
        } else {
          throw error;
        }
      }
    } else {
      const fallbackKey = `${userId}:${dateKey}`;
      const prev = this.fallbackFocusSecondsByKey.get(fallbackKey) ?? 0;
      this.fallbackFocusSecondsByKey.set(fallbackKey, prev + safeSeconds);
    }

    return this.getGoal(userId);
  }

  async upsertGoal(
    dto: UpsertLearningGoalDto,
    userId?: string,
  ): Promise<LearningGoalPayload> {
    if (
      !this.prisma.canUseDatabase() &&
      !this.prisma.allowsInMemoryFallback()
    ) {
      this.prisma.ensurePersistentStorageAvailable();
    }
    const nowIso = new Date().toISOString();
    const goal: LearningGoalSettings = {
      dailyMinutes: dto.dailyMinutes,
      weeklyWords: dto.weeklyWords,
      weeklySpeaking: dto.weeklySpeaking,
      updatedAt: nowIso,
    };

    if (!userId) {
      this.fallbackByUser.set("guest", goal);
      return this.getGoal();
    }

    if (
      (await this.canUseLearningGoalTable()) &&
      this.prisma.canUseDatabase()
    ) {
      try {
        await this.prisma.learningGoal.upsert({
          where: { userId },
          create: {
            userId,
            dailyMinutesGoal: dto.dailyMinutes,
            weeklyWordsGoal: dto.weeklyWords,
            weeklySpeakingGoal: dto.weeklySpeaking,
          },
          update: {
            dailyMinutesGoal: dto.dailyMinutes,
            weeklyWordsGoal: dto.weeklyWords,
            weeklySpeakingGoal: dto.weeklySpeaking,
          },
        });
      } catch (error) {
        if (this.isMissingLearningGoalTable(error)) {
          this.learningGoalTableReady = false;
          this.logger.warn(
            "LearningGoal table not available, switched to in-memory fallback.",
          );
          this.fallbackByUser.set(userId, goal);
        } else {
          throw error;
        }
      }
    } else {
      this.fallbackByUser.set(userId, goal);
    }

    return this.getGoal(userId);
  }

  private async resolveGoalSettings(
    userId?: string,
  ): Promise<LearningGoalSettings> {
    if (!userId) {
      const guest = this.fallbackByUser.get("guest");
      return guest ?? { ...DEFAULT_SETTINGS, updatedAt: null };
    }

    if (
      (await this.canUseLearningGoalTable()) &&
      this.prisma.canUseDatabase()
    ) {
      try {
        const record = await this.prisma.learningGoal.findUnique({
          where: { userId },
        });
        if (record) {
          return {
            dailyMinutes: record.dailyMinutesGoal,
            weeklyWords: record.weeklyWordsGoal,
            weeklySpeaking: record.weeklySpeakingGoal,
            updatedAt: record.updatedAt.toISOString(),
          };
        }
      } catch (error) {
        if (this.isMissingLearningGoalTable(error)) {
          this.learningGoalTableReady = false;
        } else {
          throw error;
        }
      }
    }

    const fallback = this.fallbackByUser.get(userId);
    if (fallback) {
      return fallback;
    }

    return {
      ...DEFAULT_SETTINGS,
      updatedAt: null,
    };
  }

  private async resolveProgress(
    userId: string | undefined,
    now: Date,
  ): Promise<LearningGoalProgress> {
    const recentMessages = await this.listRecentMessages(userId, now);
    const baseProgress = computeLearningGoalProgress(recentMessages, now);
    const focusSeconds = await this.resolveDailyFocusSeconds(userId, now);
    return mergeFocusMinutesIntoProgress(baseProgress, focusSeconds);
  }

  private async listRecentMessages(
    userId: string | undefined,
    now: Date,
  ): Promise<ConversationMessage[]> {
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);

    if (userId && this.prisma.canUseDatabase()) {
      try {
        const records = await this.prisma.conversation.findMany({
          where: {
            userId,
            updatedAt: {
              gte: weekStart,
            },
          },
          select: {
            messages: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
          take: 100,
        });
        return records.flatMap((record) => {
          if (!Array.isArray(record.messages)) {
            return [];
          }
          return record.messages as unknown as ConversationMessage[];
        });
      } catch (error) {
        if (this.isMissingLearningGoalTable(error)) {
          this.learningGoalTableReady = false;
        } else {
          this.logger.warn(
            `Failed to query conversations for learning goal progress: ${(error as Error).message}`,
          );
        }
      }
    }

    if (!userId) {
      return [];
    }

    return this.conversationService
      .listCachedSessions()
      .filter((session) => session.userId === userId)
      .flatMap((session) => session.messages);
  }

  private computeCompletion(
    goal: LearningGoalSettings,
    progress: LearningGoalProgress,
  ): LearningGoalCompletion {
    const toPct = (value: number, target: number): number => {
      if (target <= 0) {
        return 0;
      }
      return Math.min(100, Math.round((value / target) * 100));
    };

    const daily = toPct(progress.dailyMinutes, goal.dailyMinutes);
    const weeklyWords = toPct(progress.weeklyWords, goal.weeklyWords);
    const weeklySpeaking = toPct(progress.weeklySpeaking, goal.weeklySpeaking);

    return {
      dailyMinutes: daily,
      weeklyWords,
      weeklySpeaking,
      overall: Math.round((daily + weeklyWords + weeklySpeaking) / 3),
    };
  }

  private async canUseLearningGoalTable(): Promise<boolean> {
    if (!this.prisma.canUseDatabase()) {
      return false;
    }
    if (this.learningGoalTableReady !== null) {
      return this.learningGoalTableReady;
    }
    try {
      await this.prisma.learningGoal.findFirst({
        select: { id: true },
      });
      this.learningGoalTableReady = true;
      return true;
    } catch (error) {
      if (this.isMissingLearningGoalTable(error)) {
        this.learningGoalTableReady = false;
        this.logger.warn(
          "LearningGoal table not available yet. Use migration to enable persistence.",
        );
        return false;
      }
      throw error;
    }
  }

  private async canUseLearningActivityTable(): Promise<boolean> {
    if (!this.prisma.canUseDatabase()) {
      return false;
    }
    if (this.learningActivityTableReady !== null) {
      return this.learningActivityTableReady;
    }
    try {
      await this.prisma.learningActivityDaily.findFirst({
        select: { id: true },
      });
      this.learningActivityTableReady = true;
      return true;
    } catch (error) {
      if (this.isMissingLearningActivityTable(error)) {
        this.learningActivityTableReady = false;
        this.logger.warn(
          "LearningActivityDaily table not available yet. Focus tracking falls back to memory.",
        );
        return false;
      }
      throw error;
    }
  }

  private async resolveDailyFocusSeconds(
    userId: string | undefined,
    now: Date,
  ): Promise<number> {
    const dateKey = this.toDateKey(now);
    if (!userId) {
      return this.fallbackFocusSecondsByKey.get(`guest:${dateKey}`) ?? 0;
    }

    if (
      (await this.canUseLearningActivityTable()) &&
      this.prisma.canUseDatabase()
    ) {
      try {
        const record = await this.prisma.learningActivityDaily.findUnique({
          where: {
            userId_dateKey: {
              userId,
              dateKey,
            },
          },
          select: {
            focusSeconds: true,
          },
        });
        return record?.focusSeconds ?? 0;
      } catch (error) {
        if (this.isMissingLearningActivityTable(error)) {
          this.learningActivityTableReady = false;
        } else {
          this.logger.warn(
            `Failed to query learning focus seconds: ${(error as Error).message}`,
          );
        }
      }
    }

    return this.fallbackFocusSecondsByKey.get(`${userId}:${dateKey}`) ?? 0;
  }

  private toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private isMissingLearningGoalTable(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    );
  }

  private isMissingLearningActivityTable(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    );
  }
}
