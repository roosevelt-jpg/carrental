"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Block = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
};

const REASON_COLOR: Record<string, string> = {
  BOOKED: "bg-gold/80",
  MAINTENANCE: "bg-danger/70",
  HOLD: "bg-ok/70",
};

function toDateKey(iso: string) {
  return iso.slice(0, 10);
}

function monthMatrix(anchor: Date) {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const startPad = (first.getUTCDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<{ key: string; day: number | null }> = [];
  for (let i = 0; i < startPad; i++) cells.push({ key: `pad-${i}`, day: null });
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ key, day });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `tail-${cells.length}`, day: null });
  }
  return cells;
}

export function AvailabilityManager({
  vehicleId,
  blocks,
}: {
  vehicleId: string;
  blocks: Block[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const [form, setForm] = useState({
    startDate: "",
    endDate: "",
    reason: "MAINTENANCE",
  });

  const cells = useMemo(() => monthMatrix(month), [month]);
  const blockedByDay = useMemo(() => {
    const map = new Map<string, string>();
    for (const block of blocks) {
      const start = new Date(`${toDateKey(block.startDate)}T00:00:00.000Z`);
      const end = new Date(`${toDateKey(block.endDate)}T00:00:00.000Z`);
      for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
        map.set(d.toISOString().slice(0, 10), block.reason);
      }
    }
    return map;
  }, [blocks]);

  async function createBlock(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId,
        startDate: new Date(`${form.startDate}T00:00:00.000Z`).toISOString(),
        endDate: new Date(`${form.endDate}T00:00:00.000Z`).toISOString(),
        reason: form.reason,
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not create block");
      return;
    }
    setForm({ startDate: "", endDate: "", reason: "MAINTENANCE" });
    router.refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/admin/availability/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const label = month.toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <section className="rounded-xl border border-line bg-panel p-6">
      <h2 className="font-serif text-2xl">Availability calendar</h2>
      <p className="mt-2 text-sm text-muted">
        Block dates for maintenance, holds, or bookings. The agent reads these via check_availability.
      </p>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          className="btn-ghost text-sm"
          onClick={() =>
            setMonth(
              new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)),
            )
          }
        >
          Previous
        </button>
        <p className="font-serif text-xl text-gold-2">{label}</p>
        <button
          type="button"
          className="btn-ghost text-sm"
          onClick={() =>
            setMonth(
              new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)),
            )
          }
        >
          Next
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-widest text-muted">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const reason = cell.day ? blockedByDay.get(cell.key) : undefined;
          return (
            <button
              key={cell.key}
              type="button"
              disabled={!cell.day}
              className={`aspect-square rounded-md border border-line text-sm ${
                cell.day
                  ? reason
                    ? `${REASON_COLOR[reason] ?? "bg-panel-2"} text-ink`
                    : "bg-panel-2 hover:border-gold/50"
                  : "opacity-20"
              }`}
              onClick={() => {
                if (!cell.day) return;
                setForm((f) => ({
                  ...f,
                  startDate: cell.key,
                  endDate: f.endDate || cell.key,
                }));
              }}
            >
              {cell.day ?? ""}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-gold/80" /> Booked
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-danger/70" /> Maintenance
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-ok/70" /> Hold
        </span>
      </div>

      <form className="mt-6 grid gap-4 md:grid-cols-4" onSubmit={createBlock}>
        <div>
          <label htmlFor="startDate">Start</label>
          <input
            id="startDate"
            type="date"
            required
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="endDate">End</label>
          <input
            id="endDate"
            type="date"
            required
            value={form.endDate}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="reason">Reason</label>
          <select
            id="reason"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          >
            <option value="MAINTENANCE">Maintenance</option>
            <option value="HOLD">Hold</option>
            <option value="BOOKED">Booked</option>
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-gold w-full" disabled={busy} type="submit">
            Add block
          </button>
        </div>
      </form>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <ul className="mt-6 space-y-2">
        {blocks.length === 0 ? (
          <li className="text-sm text-muted">No blocks — vehicle is free unless booked.</li>
        ) : (
          blocks.map((block) => (
            <li
              key={block.id}
              className="flex items-center justify-between rounded-lg border border-line px-4 py-3 text-sm"
            >
              <span>
                {block.startDate.slice(0, 10)} → {block.endDate.slice(0, 10)} · {block.reason}
              </span>
              <button type="button" className="text-danger" onClick={() => remove(block.id)}>
                Remove
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
