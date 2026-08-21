ALTER TABLE "CmsSettings" ADD COLUMN IF NOT EXISTS "publishedSnapshot" JSONB;

INSERT INTO "MessageTemplate"
  ("id", "name", "purpose", "language", "category", "bodyText", "bodyVariables", "sampleValues", "notes", "updatedAt", "createdAt")
VALUES
  ('system_template_booking_confirmation', 'booking_confirmation', 'BOOKING_CONFIRMATION', 'en', 'UTILITY', E'Your {{business_name}} booking is confirmed.\n\nVehicle: {{vehicle}}\nDates: {{start_date}} to {{end_date}}\nReference: {{booking_id}}', ARRAY['business_name','vehicle','start_date','end_date','booking_id'], ARRAY['Atelier Fleet','Mercedes G63','25 August 2026','28 August 2026','BK-12345'], 'Post-payment confirmation outside the 24-hour window.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('system_template_payment_reminder', 'payment_reminder', 'PAYMENT_REMINDER', 'en', 'UTILITY', E'{{payment_summary}}\n\nComplete your secure payment here: {{payment_url}}', ARRAY['payment_summary','payment_url'], ARRAY['Secure payment for 3,500 AED.','https://example.com/pay/quote'], 'Unpaid quote follow-up.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('system_template_reengagement', 'reengagement', 'REENGAGEMENT', 'en', 'MARKETING', 'Hello from {{business_name}}. {{message}}', ARRAY['business_name','message'], ARRAY['Atelier Fleet','Would you still like help finding a vehicle?'], 'Re-opening cold conversations; use only with valid opt-in.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('system_template_owner_escalation', 'owner_escalation', 'OWNER_ESCALATION', 'en', 'UTILITY', E'Sales-agent escalation:\n\n{{message}}', ARRAY['message'], ARRAY['[REF-1234] A customer needs an owner decision.'], 'Operational owner notification.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('system_template_owner_reminder', 'owner_reminder', 'OWNER_REMINDER', 'en', 'UTILITY', E'Reminder — an owner decision is still required:\n\n{{message}}', ARRAY['message'], ARRAY['[REF-1234] Please reply with the reference and your decision.'], 'Unresolved escalation reminder.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('system_template_weekly_digest', 'weekly_digest', 'WEEKLY_DIGEST', 'en', 'UTILITY', E'Weekly sales-agent summary:\n\n{{message}}', ARRAY['message'], ARRAY['12 conversations, 3 bookings, and 1 escalation this week.'], 'Weekly owner report.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('system_template_owner_booking', 'owner_booking', 'OWNER_BOOKING', 'en', 'UTILITY', E'New confirmed booking:\n\n{{message}}', ARRAY['message'], ARRAY['Booking BK-12345 for a Mercedes G63 has been confirmed.'], 'New confirmed booking notification.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET
  "bodyText" = CASE WHEN "MessageTemplate"."bodyText" = '' THEN EXCLUDED."bodyText" ELSE "MessageTemplate"."bodyText" END,
  "bodyVariables" = CASE WHEN cardinality("MessageTemplate"."bodyVariables") = 0 THEN EXCLUDED."bodyVariables" ELSE "MessageTemplate"."bodyVariables" END,
  "sampleValues" = CASE WHEN cardinality("MessageTemplate"."sampleValues") = 0 THEN EXCLUDED."sampleValues" ELSE "MessageTemplate"."sampleValues" END;
