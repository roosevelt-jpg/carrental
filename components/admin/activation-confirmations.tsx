"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Confirmation = {
  field: "metaWebhookConfirmed" | "stripeWebhookConfirmed" | "escalationRulesReviewed" | "stripeModeReviewed" | "sentryTestConfirmed" | "ownerUatSignedOff";
  label: string;
  detail: string;
  confirmed: boolean;
};

export function ActivationConfirmations({ confirmations }: { confirmations: Confirmation[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(item: Confirmation) {
    setBusy(item.field);
    setError(null);
    const response = await fetch("/api/admin/activation-review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: item.field, confirmed: !item.confirmed }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setError(body.error ?? "Could not save confirmation");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-8 rounded-2xl border border-gold/30 bg-gold/5 p-5">
      <h2 className="font-serif text-2xl">Owner confirmations</h2>
      <p className="mt-2 text-sm text-muted">Confirm only after completing each action against the real configured services. Every change is audited.</p>
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <ul className="mt-5 space-y-3">
        {confirmations.map((item) => (
          <li key={item.field} className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-panel p-4 sm:flex-row sm:items-center">
            <div><p>{item.label}</p><p className="mt-1 text-sm text-muted">{item.detail}</p></div>
            <button type="button" className={item.confirmed ? "btn-ghost" : "btn-gold"} disabled={busy === item.field} onClick={() => toggle(item)}>
              {busy === item.field ? "Saving…" : item.confirmed ? "Confirmed ✓" : "Confirm"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
