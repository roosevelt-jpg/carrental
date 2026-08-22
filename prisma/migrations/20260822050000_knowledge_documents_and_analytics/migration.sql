CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('DRAFT', 'VERIFIED', 'FAILED', 'ARCHIVED');

CREATE TABLE "KnowledgeDocument" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'General',
  "keywords" TEXT[],
  "content" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT,
  "mimeType" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "errorMessage" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeQueryLog" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT,
  "query" TEXT NOT NULL,
  "matchedEntryIds" TEXT[],
  "matchedDocumentIds" TEXT[],
  "found" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeQueryLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeDocument_status_category_idx" ON "KnowledgeDocument"("status", "category");
CREATE INDEX "KnowledgeDocument_expiresAt_idx" ON "KnowledgeDocument"("expiresAt");
CREATE INDEX "KnowledgeQueryLog_createdAt_found_idx" ON "KnowledgeQueryLog"("createdAt", "found");
CREATE INDEX "KnowledgeQueryLog_conversationId_createdAt_idx" ON "KnowledgeQueryLog"("conversationId", "createdAt");
