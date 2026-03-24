-- CreateTable
CREATE TABLE "ConversationReport" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT,
    "targetLanguage" TEXT NOT NULL,
    "nativeLanguage" TEXT,
    "voiceStyle" TEXT,
    "sourceMode" TEXT NOT NULL DEFAULT 'immersive',
    "reportLanguage" TEXT NOT NULL,
    "report" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConversationReport_conversationId_key" ON "ConversationReport"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationReport_userId_updatedAt_idx" ON "ConversationReport"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ConversationReport_updatedAt_idx" ON "ConversationReport"("updatedAt");

-- AddForeignKey
ALTER TABLE "ConversationReport" ADD CONSTRAINT "ConversationReport_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationReport" ADD CONSTRAINT "ConversationReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
