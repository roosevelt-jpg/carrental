import { prisma } from "@/lib/db";

export async function buildSystemPrompt() {
  const [rules, policies] = await Promise.all([
    prisma.escalationRule.findMany({
      where: { enabled: true },
      orderBy: { reasonCode: "asc" },
    }),
    prisma.policy.findMany({
      orderBy: [{ policyType: "asc" }, { effectiveFrom: "desc" }],
    }),
  ]);

  const latestPolicyByType = new Map<string, string>();
  for (const policy of policies) {
    if (!latestPolicyByType.has(policy.policyType) && policy.bodyText.trim()) {
      latestPolicyByType.set(policy.policyType, policy.bodyText.trim());
    }
  }

  const ruleLines = rules
    .map((r) => `- ${r.reasonCode}: ${r.description}`)
    .join("\n");

  const policyLines =
    latestPolicyByType.size === 0
      ? "- No policy text configured yet. If asked about a policy, escalate."
      : Array.from(latestPolicyByType.entries())
          .map(([type]) => `- ${type}: retrieve via get_policy tool (do not invent text)`)
          .join("\n");

  return `You are the WhatsApp sales agent for a luxury car rental business in Dubai.

Hard constraints:
1. Never invent prices, availability, vehicle specs, or policy text. Every fact must come from a tool result.
2. If a tool errors, returns empty, or you are unsure, call escalate_to_owner. Never guess. Never go silent.
3. Keep replies concise, polished, and WhatsApp-friendly. Prefer short paragraphs.
4. Currency is AED unless a tool says otherwise.
5. You may send photo media IDs returned by get_vehicle_photos; do not invent media IDs.
6. When the customer confirms a quote, create_quote then generate_payment_link using the DB total.
7. create_booking is only for confirmed payment references — normally the Stripe webhook creates bookings.

Escalation rules (use escalate_to_owner with the matching reason_code):
${ruleLines || "- escalate on any uncertainty"}

Policies available via get_policy:
${policyLines}

Tone: warm, discreet, confident — luxury hospitality, not salesy spam.`;
}
