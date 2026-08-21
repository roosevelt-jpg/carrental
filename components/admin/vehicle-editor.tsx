"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Vehicle = {
  id: string;
  make: string;
  model: string;
  category: string;
  year: number;
  dailyRate: string;
  weeklyRate: string | null;
  depositAmount: string;
  active: boolean;
};

export function VehicleEditor({ vehicle }: { vehicle: Vehicle }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    make: vehicle.make,
    model: vehicle.model,
    category: vehicle.category,
    year: String(vehicle.year),
    dailyRate: vehicle.dailyRate,
    weeklyRate: vehicle.weeklyRate ?? "",
    depositAmount: vehicle.depositAmount,
    active: vehicle.active,
  });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/vehicles/${vehicle.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        make: form.make,
        model: form.model,
        category: form.category,
        year: Number(form.year),
        dailyRate: Number(form.dailyRate),
        weeklyRate: form.weeklyRate ? Number(form.weeklyRate) : null,
        depositAmount: Number(form.depositAmount),
        active: form.active,
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Save failed");
      return;
    }
    router.refresh();
  }

  return (
    <form className="grid gap-4 rounded-xl border border-line bg-panel p-6 md:grid-cols-2" onSubmit={save}>
      {(
        [
          ["make", "Make"],
          ["model", "Model"],
          ["category", "Category"],
          ["year", "Year"],
          ["dailyRate", "Daily rate"],
          ["weeklyRate", "Weekly rate"],
          ["depositAmount", "Deposit"],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <label htmlFor={`edit-${key}`}>{label}</label>
          <input
            id={`edit-${key}`}
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            required={key !== "weeklyRate"}
          />
        </div>
      ))}
      <div className="flex items-center gap-3 md:col-span-2">
        <input
          id="active"
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          className="h-4 w-4"
        />
        <label htmlFor="active" className="!mb-0 !normal-case !tracking-normal !text-sm !text-cream">
          Active in catalog
        </label>
      </div>
      {error ? <p className="text-sm text-danger md:col-span-2">{error}</p> : null}
      <div className="md:col-span-2">
        <button className="btn-gold" disabled={busy} type="submit">
          Save changes
        </button>
      </div>
    </form>
  );
}
