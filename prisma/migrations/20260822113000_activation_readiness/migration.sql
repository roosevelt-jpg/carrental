CREATE TABLE "ActivationReview" (
  "id" TEXT NOT NULL DEFAULT 'primary',
  "metaWebhookConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "stripeWebhookConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "escalationRulesReviewed" BOOLEAN NOT NULL DEFAULT false,
  "stripeModeReviewed" BOOLEAN NOT NULL DEFAULT false,
  "ownerUatSignedOff" BOOLEAN NOT NULL DEFAULT false,
  "confirmedByEmail" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivationReview_pkey" PRIMARY KEY ("id")
);
