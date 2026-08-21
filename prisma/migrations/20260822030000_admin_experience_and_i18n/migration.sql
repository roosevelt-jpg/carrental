ALTER TABLE "User"
ADD COLUMN "name" TEXT,
ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "TranslationCache" (
  "id" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "translatedText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TranslationCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TranslationCache_locale_sourceHash_key"
ON "TranslationCache"("locale", "sourceHash");

CREATE INDEX "TranslationCache_locale_updatedAt_idx"
ON "TranslationCache"("locale", "updatedAt");
