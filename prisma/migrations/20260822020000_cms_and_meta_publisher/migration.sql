CREATE TYPE "MessageTemplateCategory" AS ENUM ('UTILITY', 'MARKETING', 'AUTHENTICATION');
CREATE TYPE "MessageTemplateButtonType" AS ENUM ('NONE', 'QUICK_REPLY', 'URL', 'PHONE_NUMBER');

ALTER TABLE "MessageTemplate"
  ADD COLUMN "category" "MessageTemplateCategory" NOT NULL DEFAULT 'UTILITY',
  ADD COLUMN "metaTemplateId" TEXT,
  ADD COLUMN "bodyText" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "bodyVariables" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "sampleValues" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "headerText" TEXT,
  ADD COLUMN "footerText" TEXT,
  ADD COLUMN "buttonType" "MessageTemplateButtonType" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "buttonText" TEXT,
  ADD COLUMN "buttonValue" TEXT,
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "lastSubmittedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "MessageTemplate_metaTemplateId_key" ON "MessageTemplate"("metaTemplateId");

CREATE TABLE "CmsSettings" (
  "id" TEXT NOT NULL DEFAULT 'primary',
  "businessName" TEXT NOT NULL DEFAULT '',
  "legalName" TEXT,
  "tagline" TEXT NOT NULL DEFAULT '',
  "businessDescription" TEXT NOT NULL DEFAULT '',
  "phone" TEXT,
  "email" TEXT,
  "whatsappDisplay" TEXT,
  "address" TEXT,
  "city" TEXT NOT NULL DEFAULT '',
  "country" TEXT NOT NULL DEFAULT '',
  "timezone" TEXT NOT NULL DEFAULT '',
  "currency" TEXT NOT NULL DEFAULT '',
  "logoUrl" TEXT,
  "heroImageUrl" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#c6a36a',
  "accentColor" TEXT NOT NULL DEFAULT '#e0c48a',
  "backgroundColor" TEXT NOT NULL DEFAULT '#100e0c',
  "seoTitle" TEXT NOT NULL DEFAULT '',
  "seoDescription" TEXT NOT NULL DEFAULT '',
  "heroEyebrow" TEXT NOT NULL DEFAULT '',
  "heroTitle" TEXT NOT NULL DEFAULT '',
  "heroSubtitle" TEXT NOT NULL DEFAULT '',
  "heroPrimaryLabel" TEXT NOT NULL DEFAULT '',
  "heroPrimaryHref" TEXT NOT NULL DEFAULT '#fleet',
  "heroSecondaryLabel" TEXT NOT NULL DEFAULT '',
  "heroSecondaryHref" TEXT NOT NULL DEFAULT '#contact',
  "aboutTitle" TEXT NOT NULL DEFAULT '',
  "aboutBody" TEXT NOT NULL DEFAULT '',
  "fleetTitle" TEXT NOT NULL DEFAULT '',
  "fleetBody" TEXT NOT NULL DEFAULT '',
  "faqTitle" TEXT NOT NULL DEFAULT '',
  "contactTitle" TEXT NOT NULL DEFAULT '',
  "contactBody" TEXT NOT NULL DEFAULT '',
  "footerText" TEXT NOT NULL DEFAULT '',
  "agentTone" TEXT NOT NULL DEFAULT '',
  "salesScript" TEXT NOT NULL DEFAULT '',
  "agentGreeting" TEXT NOT NULL DEFAULT '',
  "agentHandoffMessage" TEXT NOT NULL DEFAULT '',
  "prohibitedClaims" TEXT NOT NULL DEFAULT '',
  "sitePublished" BOOLEAN NOT NULL DEFAULT false,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CmsSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CmsRevision" (
  "id" TEXT NOT NULL,
  "cmsSettingsId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "actorEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CmsRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FaqEntry" (
  "id" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'General',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FaqEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeEntry" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'General',
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CmsRevision_cmsSettingsId_revision_key" ON "CmsRevision"("cmsSettingsId", "revision");
CREATE INDEX "CmsRevision_cmsSettingsId_createdAt_idx" ON "CmsRevision"("cmsSettingsId", "createdAt");
CREATE INDEX "FaqEntry_active_sortOrder_idx" ON "FaqEntry"("active", "sortOrder");
CREATE INDEX "KnowledgeEntry_active_category_idx" ON "KnowledgeEntry"("active", "category");

ALTER TABLE "CmsRevision" ADD CONSTRAINT "CmsRevision_cmsSettingsId_fkey"
  FOREIGN KEY ("cmsSettingsId") REFERENCES "CmsSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CmsSettings" ("id", "updatedAt") VALUES ('primary', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
