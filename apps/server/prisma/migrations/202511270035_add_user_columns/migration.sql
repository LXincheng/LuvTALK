-- Conversation/Favorite user linkage and auth tables

-- Conversation & Favorite may already contain these columns; guard with IF NOT EXISTS
ALTER TABLE "Conversation"
ADD COLUMN IF NOT EXISTS "userId" TEXT;

ALTER TABLE "Favorite"
ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Create User table if missing
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT UNIQUE,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Session tokens for future use
CREATE TABLE IF NOT EXISTS "SessionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionToken_pkey" PRIMARY KEY ("id")
);

-- Foreign key wiring (add constraints only when missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Conversation_userId_fkey'
    ) THEN
        ALTER TABLE "Conversation"
        ADD CONSTRAINT "Conversation_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Favorite_userId_fkey'
    ) THEN
        ALTER TABLE "Favorite"
        ADD CONSTRAINT "Favorite_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'SessionToken_userId_fkey'
    ) THEN
        ALTER TABLE "SessionToken"
        ADD CONSTRAINT "SessionToken_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;
