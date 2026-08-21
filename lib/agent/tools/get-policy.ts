import type { PolicyType } from "@prisma/client";
import { prisma } from "@/lib/db";

const MAP: Record<string, PolicyType> = {
  deposit: "DEPOSIT",
  documentation: "DOCUMENTATION",
  delivery: "DELIVERY",
  cancellation: "CANCELLATION",
};

export async function getPolicy(input: { policy_type: string }) {
  const policyType = MAP[input.policy_type.toLowerCase()];
  if (!policyType) {
    return { ok: false, error: "Unknown policy_type" };
  }

  const policy = await prisma.policy.findFirst({
    where: { policyType },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!policy || !policy.bodyText.trim()) {
    return {
      ok: false,
      error: "No policy text configured for this type. Escalate if the customer needs an answer.",
      policy_type: input.policy_type,
    };
  }

  return {
    ok: true,
    policy_type: input.policy_type,
    body_text: policy.bodyText,
    effective_from: policy.effectiveFrom.toISOString(),
  };
}
