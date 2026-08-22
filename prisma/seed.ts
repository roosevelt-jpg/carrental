import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ESCALATION_RULES = [
  ["refund_request", "Refund request", "Customer asked for a refund or deposit return. Never handle autonomously."],
  ["eligibility_exception", "Eligibility exception", "Under minimum age, unsupported license country, or other eligibility exception."],
  ["fee_dispute", "Fee dispute", "Customer disputes a charge or fee."],
  ["price_negotiation", "Price negotiation", "Discount request below policy floor."],
  ["out_of_scope", "Out of scope", "No tool or policy can answer confidently."],
  ["repeated_misunderstanding", "Repeated misunderstanding", "Agent failed to resolve intent after repeated turns."],
  ["explicit_human_request", "Explicit human request", "Customer asked to speak to a person. Escalate immediately."],
  ["payment_fulfillment_exception", "Payment fulfillment exception", "Stripe accepted payment but the booking could not be fulfilled safely."],
] as const;

async function main() {
  for (const [reasonCode, label, description] of ESCALATION_RULES) {
    await prisma.escalationRule.upsert({
      where: { reasonCode },
      create: { reasonCode, label, description, defaultAction: "escalate" },
      update: { label, description, defaultAction: "escalate" },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
