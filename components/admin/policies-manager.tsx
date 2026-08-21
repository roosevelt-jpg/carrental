"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TYPES = ["DEPOSIT", "DOCUMENTATION", "DELIVERY", "CANCELLATION"] as const;

type PolicyRow = {
  id: string;
  policyType: string;
  bodyText: string;
  effectiveFrom: string;
};

export function PoliciesManager({ policies }: { policies: PolicyRow[] }) {
  const router = useRouter();
  const [policyType, setPolicyType] = useState<(typeof TYPES)[number]>("DEPOSIT");
  const [bodyText, setBodyText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyType, bodyText }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not save policy");
      return;
    }
    setBodyText("");
    router.refresh();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/policies/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Could not delete policy");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-8">
      <form className="space-y-4 rounded-xl border border-line bg-panel p-6" onSubmit={save}>
        <div>
          <label htmlFor="policyType">Policy type</label>
          <select
            id="policyType"
            value={policyType}
            onChange={(e) => setPolicyType(e.target.value as (typeof TYPES)[number])}
          >
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="bodyText">Policy text</label>
          <textarea
            id="bodyText"
            required
            rows={6}
            className="w-full rounded-md border border-line bg-[#14110e] p-3 text-cream"
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button className="btn-gold" disabled={busy} type="submit">
          Publish policy
        </button>
      </form>

      <ul className="space-y-3">
        {policies.length === 0 ? (
          <li className="text-muted">No policies yet. Add owner-authored text above.</li>
        ) : (
          policies.map((policy) => (
            <li key={policy.id} className="rounded-xl border border-line bg-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-gold">{policy.policyType}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-cream/90">{policy.bodyText}</p>
                  <p className="mt-3 text-xs text-muted">
                    Effective {new Date(policy.effectiveFrom).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm text-danger"
                  onClick={() => remove(policy.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
