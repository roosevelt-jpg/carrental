-- Production safety and observability fields.
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('RECEIVED', 'ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED');
CREATE TYPE "WebhookEventStatus" AS ENUM ('PROCESSING', 'COMPLETE');

ALTER TYPE "MessageTemplatePurpose" ADD VALUE IF NOT EXISTS 'OWNER_ESCALATION';
ALTER TYPE "MessageTemplatePurpose" ADD VALUE IF NOT EXISTS 'OWNER_REMINDER';
ALTER TYPE "MessageTemplatePurpose" ADD VALUE IF NOT EXISTS 'WEEKLY_DIGEST';
ALTER TYPE "MessageTemplatePurpose" ADD VALUE IF NOT EXISTS 'OWNER_BOOKING';

ALTER TABLE "Customer"
  ADD COLUMN "optInAt" TIMESTAMP(3),
  ADD COLUMN "lastInboundAt" TIMESTAMP(3),
  ADD COLUMN "anonymizedAt" TIMESTAMP(3);

ALTER TABLE "Vehicle" ADD COLUMN "mediaUploadedAt" TIMESTAMP(3);

ALTER TABLE "Message"
  ADD COLUMN "deliveryStatus" "MessageDeliveryStatus" NOT NULL DEFAULT 'RECEIVED',
  ADD COLUMN "statusUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "failureCode" TEXT,
  ADD COLUMN "agentReply" JSONB,
  ADD COLUMN "sourceMessageId" TEXT,
  ADD COLUMN "sequence" INTEGER;

CREATE UNIQUE INDEX "Message_sourceMessageId_sequence_key" ON "Message"("sourceMessageId", "sequence");

ALTER TABLE "Quote"
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "checkoutSessionId" TEXT,
  ADD COLUMN "checkoutUrl" TEXT,
  ADD COLUMN "paymentExpiresAt" TIMESTAMP(3),
  ADD COLUMN "availabilityBlockId" TEXT;

UPDATE "Quote"
SET "expiresAt" = "createdAt" + INTERVAL '1 hour'
WHERE "expiresAt" IS NULL;

ALTER TABLE "Quote" ALTER COLUMN "expiresAt" SET NOT NULL;

-- Legacy pending quotes had no inventory hold and cannot be fulfilled safely.
UPDATE "Quote" SET "status" = 'EXPIRED' WHERE "status" = 'PENDING';

ALTER TABLE "Escalation"
  ADD COLUMN "ownerNotificationMessageId" TEXT;

ALTER TABLE "Booking"
  ADD COLUMN "customerNotifiedAt" TIMESTAMP(3),
  ADD COLUMN "ownerNotifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Quote_checkoutSessionId_key" ON "Quote"("checkoutSessionId");
CREATE UNIQUE INDEX "Quote_availabilityBlockId_key" ON "Quote"("availabilityBlockId");
CREATE UNIQUE INDEX "Escalation_ownerNotificationMessageId_key" ON "Escalation"("ownerNotificationMessageId");

ALTER TABLE "Quote"
  ADD CONSTRAINT "Quote_availabilityBlockId_fkey"
  FOREIGN KEY ("availabilityBlockId") REFERENCES "AvailabilityBlock"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- The database, not application timing, is the final authority against double-booking.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "AvailabilityBlock"
  ADD CONSTRAINT "AvailabilityBlock_no_overlap"
  EXCLUDE USING gist (
    "vehicleId" WITH =,
    tsrange("startDate", "endDate", '[)') WITH &&
  );

CREATE TABLE "ProcessingMetric" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "inboundMessageId" TEXT NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "toolRounds" INTEGER NOT NULL DEFAULT 0,
  "escalated" BOOLEAN NOT NULL DEFAULT false,
  "succeeded" BOOLEAN NOT NULL,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessingMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcessingMetric_inboundMessageId_key" ON "ProcessingMetric"("inboundMessageId");
CREATE INDEX "ProcessingMetric_createdAt_idx" ON "ProcessingMetric"("createdAt");
CREATE INDEX "ProcessingMetric_succeeded_createdAt_idx" ON "ProcessingMetric"("succeeded", "createdAt");
ALTER TABLE "ProcessingMetric"
  ADD CONSTRAINT "ProcessingMetric_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProcessedWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "status" "WebhookEventStatus" NOT NULL DEFAULT 'PROCESSING',
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcessedWebhookEvent_provider_eventId_key" ON "ProcessedWebhookEvent"("provider", "eventId");
CREATE INDEX "ProcessedWebhookEvent_provider_status_createdAt_idx" ON "ProcessedWebhookEvent"("provider", "status", "createdAt");

CREATE TABLE "WorkerHeartbeat" (
  "id" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);
