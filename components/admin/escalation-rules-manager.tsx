"use client";

import { useRouter } from "next/navigation";

type Rule = {
  id: string;
  reasonCode: string;
  label: string;
  description: string;
  enabled: boolean;
};

export function EscalationRulesManager({ rules }: { rules: Rule[] }) {
  const router = useRouter();

  async function toggle(id: string, enabled: boolean) {
    await fetch(`/api/admin/escalation-rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    router.refresh();
  }

  return (
    <ul className="mt-8 space-y-3">
      {rules.map((rule) => (
        <li key={rule.id} className="rounded-xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-gold-2">{rule.label}</p>
              <p className="mt-2 text-sm text-muted">{rule.description}</p>
              <p className="mt-2 font-mono text-xs text-cream/50">{rule.reasonCode}</p>
            </div>
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => toggle(rule.id, rule.enabled)}
            >
              {rule.enabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
