ALTER TABLE "CmsSettings" ADD COLUMN IF NOT EXISTS "publishedSnapshot" JSONB;

-- Structural shells only. The owner supplies business wording and samples.
INSERT INTO "MessageTemplate"
  ("id", "name", "purpose", "language", "category", "bodyText", "bodyVariables", "sampleValues", "notes", "updatedAt", "createdAt")
VALUES
  ('system_template_booking_confirmation', 'booking_confirmation', 'BOOKING_CONFIRMATION', 'en', 'UTILITY', '', ARRAY[]::TEXT[], ARRAY[]::TEXT[], NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('system_template_payment_reminder', 'payment_reminder', 'PAYMENT_REMINDER', 'en', 'UTILITY', '', ARRAY[]::TEXT[], ARRAY[]::TEXT[], NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('system_template_reengagement', 'reengagement', 'REENGAGEMENT', 'en', 'MARKETING', '', ARRAY[]::TEXT[], ARRAY[]::TEXT[], NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('system_template_owner_escalation', 'owner_escalation', 'OWNER_ESCALATION', 'en', 'UTILITY', '', ARRAY[]::TEXT[], ARRAY[]::TEXT[], NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('system_template_owner_reminder', 'owner_reminder', 'OWNER_REMINDER', 'en', 'UTILITY', '', ARRAY[]::TEXT[], ARRAY[]::TEXT[], NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('system_template_weekly_digest', 'weekly_digest', 'WEEKLY_DIGEST', 'en', 'UTILITY', '', ARRAY[]::TEXT[], ARRAY[]::TEXT[], NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('system_template_owner_booking', 'owner_booking', 'OWNER_BOOKING', 'en', 'UTILITY', '', ARRAY[]::TEXT[], ARRAY[]::TEXT[], NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
