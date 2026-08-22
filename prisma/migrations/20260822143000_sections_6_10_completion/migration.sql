ALTER TABLE "Escalation" ADD COLUMN "suggestedReply" TEXT;

CREATE TABLE "UserInvitation" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'STAFF',
  "tokenHash" TEXT NOT NULL,
  "invitedByEmail" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserInvitation_tokenHash_key" ON "UserInvitation"("tokenHash");
CREATE INDEX "UserInvitation_email_expiresAt_idx" ON "UserInvitation"("email", "expiresAt");

CREATE TYPE "WhatsAppEventKind" AS ENUM ('INBOUND_MESSAGE', 'DELIVERY_STATUS', 'TEMPLATE_STATUS');
CREATE TABLE "WhatsAppWebhookEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "kind" "WhatsAppEventKind" NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "WebhookEventStatus" NOT NULL DEFAULT 'PROCESSING',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "queuedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "error" TEXT,
  CONSTRAINT "WhatsAppWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhatsAppWebhookEvent_eventId_key" ON "WhatsAppWebhookEvent"("eventId");
CREATE INDEX "WhatsAppWebhookEvent_status_receivedAt_idx" ON "WhatsAppWebhookEvent"("status", "receivedAt");

CREATE TABLE "PipelineLatencyMetric" (
  "id" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "reference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PipelineLatencyMetric_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PipelineLatencyMetric_stage_createdAt_idx" ON "PipelineLatencyMetric"("stage", "createdAt");

CREATE TABLE "ProviderHealth" (
  "id" TEXT NOT NULL,
  "rateLimitedAt" TIMESTAMP(3),
  "retryAfterSecs" INTEGER,
  "usagePercent" INTEGER,
  "lastSuccessAt" TIMESTAMP(3),
  "lastStatusCode" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderHealth_pkey" PRIMARY KEY ("id")
);
