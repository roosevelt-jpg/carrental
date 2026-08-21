"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type EscalationRow = {
  id: string;
  referenceCode: string;
  reasonCode: string;
  contextSummary: string;
  status: string;
  urgency: string;
  createdAt: string;
  customerWhatsappId: string;
};

export function EscalationsManager({ escalations }: { escalations: EscalationRow[] }) {
  const router = useRouter();
  const [replyById, setReplyById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reply(escalationId: string) {
    const ownerReply = replyById[escalationId]?.trim();
    if (!ownerReply) return;
    setBusyId(escalationId);
    setError(null);
    const res = await fetch("/api/admin/escalations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ escalationId, ownerReply }),
    });
    const body = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(body.error ?? "Could not resolve escalation");
      return;
    }
    router.refresh();
  }

  if (escalations.length === 0) {
    return (
      <p className="mt-4 text-muted">
        Open handoffs to the owner will queue here with a REF code.
      </p>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {escalations.map((item) => (
        <article key={item.id} className="rounded-xl border border-line bg-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-gold-2">{item.referenceCode}</p>
            <span className="text-xs uppercase tracking-widest text-muted">
              {item.status} · {item.urgency}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">
            {item.reasonCode} · {item.customerWhatsappId} ·{" "}
            {new Date(item.createdAt).toLocaleString()}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm">{item.contextSummary}</p>
          {item.status === "OPEN" ? (
            <div className="mt-4 space-y-3">
              <textarea
                rows={3}
                className="w-full rounded-md border border-line bg-[#14110e] p-3 text-cream"
                placeholder="Owner reply to send to the customer"
                value={replyById[item.id] ?? ""}
                onChange={(e) =>
                  setReplyById((current) => ({ ...current, [item.id]: e.target.value }))
                }
              />
              <button
                className="btn-gold"
                type="button"
                disabled={busyId === item.id}
                onClick={() => reply(item.id)}
              >
                Resolve and send
              </button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
