"use client";

import { useRouter, useSearchParams } from "next/navigation";

const STATUS = ["ALL", "ACTIVE", "ESCALATED", "CLOSED"] as const;
const OUTCOMES = ["ALL", "BOOKED", "DROPPED", "ESCALATED", "UNTAGGED"] as const;

export function ConversationFilters({
  status,
  outcome,
}: {
  status: string;
  outcome: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "ALL") next.delete(key);
    else next.set(key, value);
    router.push(`/admin/conversations?${next.toString()}`);
  }

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <select
        value={status}
        onChange={(e) => update("status", e.target.value)}
        className="w-auto"
      >
        {STATUS.map((value) => (
          <option key={value} value={value}>
            Status: {value}
          </option>
        ))}
      </select>
      <select
        value={outcome}
        onChange={(e) => update("outcome", e.target.value)}
        className="w-auto"
      >
        {OUTCOMES.map((value) => (
          <option key={value} value={value}>
            Outcome: {value}
          </option>
        ))}
      </select>
    </div>
  );
}
