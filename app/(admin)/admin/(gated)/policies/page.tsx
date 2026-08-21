import { PoliciesManager } from "@/components/admin/policies-manager";
import { prisma } from "@/lib/db";

export default async function PoliciesPage() {
  const policies = await prisma.policy.findMany({
    orderBy: [{ policyType: "asc" }, { effectiveFrom: "desc" }],
  });

  return (
    <div>
      <h1 className="font-serif text-4xl">Policies</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Deposit, documentation, delivery, and cancellation. The agent retrieves these via get_policy.
      </p>
      <PoliciesManager
        policies={policies.map((p) => ({
          id: p.id,
          policyType: p.policyType,
          bodyText: p.bodyText,
          effectiveFrom: p.effectiveFrom.toISOString(),
        }))}
      />
    </div>
  );
}
