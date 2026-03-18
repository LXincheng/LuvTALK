DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewSourceType') THEN
        CREATE TYPE "ReviewSourceType" AS ENUM ('favorite', 'low_score');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewFeedbackAction') THEN
        CREATE TYPE "ReviewFeedbackAction" AS ENUM ('known', 'practice');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AchievementRarity') THEN
        CREATE TYPE "AchievementRarity" AS ENUM ('common', 'rare', 'epic', 'legendary');
    END IF;
END
$$;

ALTER TABLE "Conversation"
ADD COLUMN IF NOT EXISTS "title" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS "accessKey" TEXT;

CREATE TABLE IF NOT EXISTS "ReviewQueueItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" "ReviewSourceType" NOT NULL,
    "sourceId" TEXT,
    "term" TEXT NOT NULL,
    "definition" TEXT,
    "example" TEXT,
    "exampleTranslation" TEXT,
    "favoriteType" "FavoriteType",
    "conversationId" TEXT,
    "score" INTEGER,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewQueueItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReviewFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "action" "ReviewFeedbackAction" NOT NULL,
    "sourceType" "ReviewSourceType",
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Achievement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "rarity" "AchievementRarity" NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "targetMetric" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LevelDefinition" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "minXp" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LevelDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserLevel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "currentXp" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLevel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Achievement_code_key"
ON "Achievement"("code");

CREATE UNIQUE INDEX IF NOT EXISTS "UserAchievement_userId_achievementId_key"
ON "UserAchievement"("userId", "achievementId");

CREATE UNIQUE INDEX IF NOT EXISTS "LevelDefinition_level_key"
ON "LevelDefinition"("level");

CREATE UNIQUE INDEX IF NOT EXISTS "UserLevel_userId_key"
ON "UserLevel"("userId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ReviewQueueItem_userId_fkey'
    ) THEN
        ALTER TABLE "ReviewQueueItem"
        ADD CONSTRAINT "ReviewQueueItem_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ReviewFeedback_userId_fkey'
    ) THEN
        ALTER TABLE "ReviewFeedback"
        ADD CONSTRAINT "ReviewFeedback_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'UserAchievement_userId_fkey'
    ) THEN
        ALTER TABLE "UserAchievement"
        ADD CONSTRAINT "UserAchievement_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'UserAchievement_achievementId_fkey'
    ) THEN
        ALTER TABLE "UserAchievement"
        ADD CONSTRAINT "UserAchievement_achievementId_fkey"
        FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'UserLevel_userId_fkey'
    ) THEN
        ALTER TABLE "UserLevel"
        ADD CONSTRAINT "UserLevel_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'UserLevel_levelId_fkey'
    ) THEN
        ALTER TABLE "UserLevel"
        ADD CONSTRAINT "UserLevel_levelId_fkey"
        FOREIGN KEY ("levelId") REFERENCES "LevelDefinition"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;
