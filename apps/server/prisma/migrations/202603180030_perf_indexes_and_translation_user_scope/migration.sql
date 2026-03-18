ALTER TABLE "TranslationRecord"
ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE INDEX IF NOT EXISTS "Conversation_userId_updatedAt_idx"
ON "Conversation"("userId", "updatedAt");

CREATE INDEX IF NOT EXISTS "Conversation_userId_targetLanguage_status_idx"
ON "Conversation"("userId", "targetLanguage", "status");

CREATE INDEX IF NOT EXISTS "Favorite_userId_createdAt_idx"
ON "Favorite"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "Favorite_conversationId_createdAt_idx"
ON "Favorite"("conversationId", "createdAt");

CREATE INDEX IF NOT EXISTS "TranslationRecord_userId_createdAt_idx"
ON "TranslationRecord"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "SessionToken_userId_expiresAt_idx"
ON "SessionToken"("userId", "expiresAt");

CREATE INDEX IF NOT EXISTS "ReviewQueueItem_userId_nextReviewAt_idx"
ON "ReviewQueueItem"("userId", "nextReviewAt");

CREATE INDEX IF NOT EXISTS "ReviewQueueItem_userId_updatedAt_idx"
ON "ReviewQueueItem"("userId", "updatedAt");

CREATE INDEX IF NOT EXISTS "ReviewFeedback_userId_createdAt_idx"
ON "ReviewFeedback"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "ReviewFeedback_cardId_idx"
ON "ReviewFeedback"("cardId");

CREATE INDEX IF NOT EXISTS "UserAchievement_userId_unlockedAt_idx"
ON "UserAchievement"("userId", "unlockedAt");

CREATE INDEX IF NOT EXISTS "UserLevel_levelId_idx"
ON "UserLevel"("levelId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'TranslationRecord_userId_fkey'
    ) THEN
        ALTER TABLE "TranslationRecord"
        ADD CONSTRAINT "TranslationRecord_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;
