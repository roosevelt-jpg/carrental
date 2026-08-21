"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OutcomeTagger } from "@/components/admin/outcome-tagger";

export function ConversationActions({
  conversationId,
  status,
  currentOutcome,
}: {
  conversationId: string;
  status: string;
  currentOutcome: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close(markDropped: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/conversations/${conversationId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markDropped }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not close conversation");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <OutcomeTagger conversationId={conversationId} current={currentOutcome} />
      {status !== "CLOSED" ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-ghost text-sm"
            disabled={busy}
            onClick={() => close(false)}
          >
            Close conversation
          </button>
          <button
            type="button"
            className="btn-ghost text-sm"
            disabled={busy}
            onClick={() => close(true)}
          >
            Close + mark dropped
          </button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
