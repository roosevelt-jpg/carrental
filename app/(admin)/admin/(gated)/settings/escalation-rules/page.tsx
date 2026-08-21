import { EscalationRulesManager } from "@/components/admin/escalation-rules-manager";
import { prisma } from "@/lib/db";

export default async function EscalationRulesPage() {
  const rules = await prisma.escalationRule.findMany({
    orderBy: { reasonCode: "asc" },
  });

  return (
    <div>
      <h1 className="font-serif text-4xl">Escalation rules</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Structural defaults only — toggle rules on or off. These are not business content.
      </p>
      <EscalationRulesManager
        rules={rules.map((r) => ({
          id: r.id,
          reasonCode: r.reasonCode,
          label: r.label,
          description: r.description,
          enabled: r.enabled,
        }))}
      />
    </div>
  );
}
