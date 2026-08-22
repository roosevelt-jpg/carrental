import type { MessageTemplatePurpose } from "@prisma/client";
import { prisma } from "@/lib/db";

const REQUIRED_TEMPLATES: Array<{ name: string; purpose: MessageTemplatePurpose }> = [
  { name: "booking_confirmation", purpose: "BOOKING_CONFIRMATION" },
  { name: "payment_reminder", purpose: "PAYMENT_REMINDER" },
  { name: "reengagement", purpose: "REENGAGEMENT" },
  { name: "owner_escalation", purpose: "OWNER_ESCALATION" },
  { name: "owner_reminder", purpose: "OWNER_REMINDER" },
  { name: "weekly_digest", purpose: "WEEKLY_DIGEST" },
  { name: "owner_booking", purpose: "OWNER_BOOKING" },
];

/** Creates business-neutral draft shells; the owner must author all wording and samples. */
export async function ensureRequiredMessageTemplateDrafts() {
  await prisma.$transaction(
    REQUIRED_TEMPLATES.map((template) =>
      prisma.messageTemplate.upsert({
        where: { name: template.name },
        create: { ...template, bodyText: "", bodyVariables: [], sampleValues: [] },
        update: {},
      }),
    ),
  );
}
