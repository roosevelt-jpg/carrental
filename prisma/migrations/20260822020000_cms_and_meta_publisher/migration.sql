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
  "businessName" TEXT NOT NULL DEFAULT 'Atelier Fleet',
  "legalName" TEXT,
  "tagline" TEXT NOT NULL DEFAULT 'Exceptional cars. Effortless journeys.',
  "businessDescription" TEXT NOT NULL DEFAULT 'A curated luxury car rental experience in Dubai.',
  "phone" TEXT,
  "email" TEXT,
  "whatsappDisplay" TEXT,
  "address" TEXT,
  "city" TEXT NOT NULL DEFAULT 'Dubai',
  "country" TEXT NOT NULL DEFAULT 'United Arab Emirates',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Dubai',
  "currency" TEXT NOT NULL DEFAULT 'AED',
  "logoUrl" TEXT,
  "heroImageUrl" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#c6a36a',
  "accentColor" TEXT NOT NULL DEFAULT '#e0c48a',
  "backgroundColor" TEXT NOT NULL DEFAULT '#100e0c',
  "seoTitle" TEXT NOT NULL DEFAULT 'Atelier Fleet | Luxury Car Rental Dubai',
  "seoDescription" TEXT NOT NULL DEFAULT 'Reserve a curated luxury vehicle in Dubai with personal WhatsApp assistance.',
  "heroEyebrow" TEXT NOT NULL DEFAULT 'Luxury car rental · Dubai',
  "heroTitle" TEXT NOT NULL DEFAULT 'The right car, arranged around you.',
  "heroSubtitle" TEXT NOT NULL DEFAULT 'Explore our fleet and speak with our concierge on WhatsApp for availability, pricing, and a secure reservation.',
  "heroPrimaryLabel" TEXT NOT NULL DEFAULT 'View the fleet',
  "heroPrimaryHref" TEXT NOT NULL DEFAULT '#fleet',
  "heroSecondaryLabel" TEXT NOT NULL DEFAULT 'Chat on WhatsApp',
  "heroSecondaryHref" TEXT NOT NULL DEFAULT '#contact',
  "aboutTitle" TEXT NOT NULL DEFAULT 'A considered rental experience',
  "aboutBody" TEXT NOT NULL DEFAULT 'From first enquiry to handover, every detail is handled with clarity, discretion, and local expertise.',
  "fleetTitle" TEXT NOT NULL DEFAULT 'Curated fleet',
  "fleetBody" TEXT NOT NULL DEFAULT 'Live rates and vehicle details are managed directly by our team.',
  "faqTitle" TEXT NOT NULL DEFAULT 'Frequently asked questions',
  "contactTitle" TEXT NOT NULL DEFAULT 'Plan your drive',
  "contactBody" TEXT NOT NULL DEFAULT 'Tell us your dates and preferred vehicle. Our WhatsApp concierge will confirm live availability and pricing.',
  "footerText" TEXT NOT NULL DEFAULT 'Luxury car rental in Dubai.',
  "agentTone" TEXT NOT NULL DEFAULT 'Warm, discreet, concise, confident, and hospitality-led. Never pressure the customer.',
  "salesScript" TEXT NOT NULL DEFAULT 'Understand dates, vehicle preference, delivery needs, and eligibility. Present only verified options, answer objections honestly, then offer a secure quote and payment link.',
  "agentGreeting" TEXT NOT NULL DEFAULT 'Welcome. How may I help with your Dubai car rental?',
  "agentHandoffMessage" TEXT NOT NULL DEFAULT 'I’m bringing in a member of our team to confirm this for you.',
  "prohibitedClaims" TEXT NOT NULL DEFAULT 'Never promise unverified availability, discounts, eligibility exceptions, refunds, delivery times, or policy exceptions.',
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
