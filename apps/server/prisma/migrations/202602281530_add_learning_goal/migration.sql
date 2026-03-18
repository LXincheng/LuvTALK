CREATE TABLE IF NOT EXISTS "LearningGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyMinutesGoal" INTEGER NOT NULL DEFAULT 10,
    "weeklyWordsGoal" INTEGER NOT NULL DEFAULT 20,
    "weeklySpeakingGoal" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningGoal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LearningGoal_userId_key"
ON "LearningGoal"("userId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'LearningGoal_userId_fkey'
    ) THEN
        ALTER TABLE "LearningGoal"
        ADD CONSTRAINT "LearningGoal_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;
