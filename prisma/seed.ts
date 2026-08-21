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
] as const;

const MESSAGE_TEMPLATES = [
  {
    name: "booking_confirmation",
    purpose: "BOOKING_CONFIRMATION" as const,
    language: "en",
    notes: "Submit to Meta for post-payment confirmation outside the 24h window.",
  },
  {
    name: "payment_reminder",
    purpose: "PAYMENT_REMINDER" as const,
    language: "en",
    notes: "Submit to Meta for unpaid quote follow-up.",
  },
  {
    name: "reengagement",
    purpose: "REENGAGEMENT" as const,
    language: "en",
    notes: "Submit to Meta for re-opening cold conversations.",
  },
];

async function main() {
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
