import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ESCALATION_RULES = [
  {
    reasonCode: "refund_request",
    label: "Refund request",
    description: "Customer asked for a refund or deposit return. Never handle autonomously.",
    defaultAction: "escalate",
  },
  {
    reasonCode: "eligibility_exception",
    label: "Eligibility exception",
    description: "Under minimum age, unsupported license country, or other eligibility exception.",
    defaultAction: "escalate",
  },
  {
    reasonCode: "fee_dispute",
    label: "Fee dispute",
    description: "Customer disputes a charge or fee.",
    defaultAction: "escalate",
  },
  {
    reasonCode: "price_negotiation",
    label: "Price negotiation",
    description: "Discount request below policy floor.",
    defaultAction: "escalate",
  },
  {
    reasonCode: "out_of_scope",
    label: "Out of scope",
    description: "No tool or policy can answer confidently.",
    defaultAction: "escalate",
  },
  {
    reasonCode: "repeated_misunderstanding",
    label: "Repeated misunderstanding",
    description: "Agent failed to resolve intent after repeated turns.",
    defaultAction: "escalate",
  },
  {
    reasonCode: "explicit_human_request",
    label: "Explicit human request",
    description: "Customer asked to speak to a person. Escalate immediately.",
    defaultAction: "escalate",
  },
  {
    reasonCode: "payment_fulfillment_exception",
    label: "Payment fulfillment exception",
    description: "Stripe accepted payment but the booking could not be fulfilled safely.",
    defaultAction: "escalate",
  },
];

const MESSAGE_TEMPLATES = [
  {
    name: "booking_confirmation",
    purpose: "BOOKING_CONFIRMATION",
    language: "en",
    category: "UTILITY",
    bodyText: "Your {{business_name}} booking is confirmed.\n\nVehicle: {{vehicle}}\nDates: {{start_date}} to {{end_date}}\nReference: {{booking_id}}",
    bodyVariables: ["business_name", "vehicle", "start_date", "end_date", "booking_id"],
    sampleValues: ["Atelier Fleet", "Mercedes G63", "25 August 2026", "28 August 2026", "BK-12345"],
    notes: "Submit to Meta for post-payment confirmation outside the 24h window.",
  },
  {
    name: "payment_reminder",
    purpose: "PAYMENT_REMINDER",
    language: "en",
    category: "UTILITY",
    bodyText: "{{payment_summary}}\n\nComplete your secure payment here: {{payment_url}}",
    bodyVariables: ["payment_summary", "payment_url"],
    sampleValues: ["Secure payment for 3,500 AED.", "https://example.com/pay/quote"],
    notes: "Submit to Meta for unpaid quote follow-up.",
  },
  {
    name: "reengagement",
    purpose: "REENGAGEMENT",
    language: "en",
    category: "MARKETING",
    bodyText: "Hello from {{business_name}}. {{message}}",
    bodyVariables: ["business_name", "message"],
    sampleValues: ["Atelier Fleet", "Would you still like help finding a vehicle?"],
    notes: "Submit to Meta for re-opening cold conversations.",
  },
  {
    name: "owner_escalation",
    purpose: "OWNER_ESCALATION",
    language: "en",
    category: "UTILITY",
    bodyText: "Sales-agent escalation:\n\n{{message}}",
    bodyVariables: ["message"],
    sampleValues: ["[REF-1234] A customer needs an owner decision."],
    notes: "Operational owner notification. Body must contain one text variable.",
  },
  {
    name: "owner_reminder",
    purpose: "OWNER_REMINDER",
    language: "en",
    category: "UTILITY",
    bodyText: "Reminder — an owner decision is still required:\n\n{{message}}",
    bodyVariables: ["message"],
    sampleValues: ["[REF-1234] Please reply with the reference and your decision."],
    notes: "Unresolved escalation reminder. Body must contain one text variable.",
  },
  {
    name: "weekly_digest",
    purpose: "WEEKLY_DIGEST",
    language: "en",
    category: "UTILITY",
    bodyText: "Weekly sales-agent summary:\n\n{{message}}",
    bodyVariables: ["message"],
    sampleValues: ["12 conversations, 3 bookings, and 1 escalation this week."],
    notes: "Weekly owner report. Body must contain one text variable.",
  },
  {
    name: "owner_booking",
    purpose: "OWNER_BOOKING",
    language: "en",
    category: "UTILITY",
    bodyText: "New confirmed booking:\n\n{{message}}",
    bodyVariables: ["message"],
    sampleValues: ["Booking BK-12345 for a Mercedes G63 has been confirmed."],
    notes: "New confirmed booking notification. Body must contain one text variable.",
  },
];

async function main() {
  await prisma.cmsSettings.upsert({
    where: { id: "primary" },
    create: { id: "primary" },
    update: {},
  });

  for (const rule of ESCALATION_RULES) {
    await prisma.escalationRule.upsert({
      where: { reasonCode: rule.reasonCode },
      create: rule,
      update: {
        label: rule.label,
        description: rule.description,
        defaultAction: rule.defaultAction,
      },
    });
  }

  for (const template of MESSAGE_TEMPLATES) {
    await prisma.messageTemplate.upsert({
      where: { name: template.name },
      create: template,
      update: {
        purpose: template.purpose,
        language: template.language,
        notes: template.notes,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
