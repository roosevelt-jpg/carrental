"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const OUTCOMES = ["BOOKED", "DROPPED", "ESCALATED"] as const;

export function OutcomeTagger({
  conversationId,
  current,
}: {
  conversationId: string;
  current: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function tag(outcome: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/conversations/${conversationId}/outcome`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not tag outcome");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <p className="text-xs uppercase tracking-widest text-muted">Outcome</p>
      <p className="mt-2 text-sm">
        Current: <span className="text-gold-2">{current ?? "untagged"}</span>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {OUTCOMES.map((outcome) => (
          <button
            key={outcome}
            type="button"
            className="btn-ghost text-xs"
            disabled={busy}
            onClick={() => tag(outcome)}
          >
            {outcome}
          </button>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
