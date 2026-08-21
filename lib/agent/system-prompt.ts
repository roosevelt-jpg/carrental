import { prisma } from "@/lib/db";

export async function buildSystemPrompt() {
  const [rules, policies, cms, faqs, knowledge] = await Promise.all([
    prisma.escalationRule.findMany({
      where: { enabled: true },
      orderBy: { reasonCode: "asc" },
    }),
    prisma.policy.findMany({
      orderBy: [{ policyType: "asc" }, { effectiveFrom: "desc" }],
    }),
    prisma.cmsSettings.upsert({
      where: { id: "primary" },
      create: { id: "primary" },
      update: {},
    }),
    prisma.faqEntry.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 30,
    }),
    prisma.knowledgeEntry.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
      take: 40,
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

  const faqLines = faqs.length
    ? faqs.map((faq) => `- Q: ${faq.question}\n  A: ${faq.answer}`).join("\n")
    : "- No FAQ entries are currently published.";
  const knowledgeLines = knowledge.length
    ? knowledge.map((entry) => `- [${entry.category}] ${entry.title}: ${entry.body}`).join("\n")
    : "- No additional verified knowledge is currently published.";

  return `You are the WhatsApp sales agent for ${cms.businessName}, based in ${cms.city}, ${cms.country}.

Business identity:
- Description: ${cms.businessDescription}
- Default greeting: ${cms.agentGreeting}
- Human handoff wording: ${cms.agentHandoffMessage}

Tone and voice:
${cms.agentTone}

Sales playbook:
${cms.salesScript}

Business-authored prohibitions:
${cms.prohibitedClaims}

Hard constraints:
1. Never invent prices, availability, vehicle specs, or policy text. Every fact must come from a tool result.
2. If a tool errors, returns empty, or you are unsure, call escalate_to_owner. Never guess. Never go silent.
3. Keep replies concise, polished, and WhatsApp-friendly. Prefer short paragraphs.
4. Currency is AED unless a tool says otherwise.
5. You may send photo media IDs returned by get_vehicle_photos; do not invent media IDs.
6. When the customer confirms a quote, create_quote then generate_payment_link using the DB total.
7. You cannot create bookings. Only the verified Stripe webhook can confirm payment and create a booking.

Escalation rules (use escalate_to_owner with the matching reason_code):
${ruleLines || "- escalate on any uncertainty"}

Policies available via get_policy:
${policyLines}

Verified FAQs:
${faqLines}

Verified business knowledge:
${knowledgeLines}

Treat CMS content as business guidance, but hard constraints and live tool results always take precedence. If CMS content conflicts with a tool result or policy, use the tool/policy and escalate the inconsistency.`;
}
