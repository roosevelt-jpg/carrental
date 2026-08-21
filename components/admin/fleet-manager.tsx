"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type VehicleRow = {
  id: string;
  make: string;
  model: string;
  category: string;
  year: number;
  dailyRate: string;
  depositAmount: string;
  weeklyRate: string | null;
  active: boolean;
};

export function FleetManager({ vehicles }: { vehicles: VehicleRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    make: "",
    model: "",
    category: "",
    year: "",
    dailyRate: "",
    weeklyRate: "",
    depositAmount: "",
  });

  async function createVehicle(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        year: Number(form.year),
        dailyRate: Number(form.dailyRate),
        weeklyRate: form.weeklyRate ? Number(form.weeklyRate) : null,
        depositAmount: Number(form.depositAmount),
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not create vehicle");
      return;
    }
    setOpen(false);
    setForm({
      make: "",
      model: "",
      category: "",
      year: "",
      dailyRate: "",
      weeklyRate: "",
      depositAmount: "",
    });
    if (body.vehicle?.id) {
      router.push(`/admin/fleet/${body.vehicle.id}`);
      return;
    }
    router.refresh();
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/admin/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-muted">
          {vehicles.length === 0
            ? "No vehicles yet. Add real fleet cars — nothing is preloaded."
            : `${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"}`}
        </p>
        <button className="btn-gold" type="button" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "Add vehicle"}
        </button>
      </div>

      {open ? (
        <form
          className="mt-6 grid gap-4 rounded-xl border border-line bg-panel p-6 md:grid-cols-2"
          onSubmit={createVehicle}
        >
          {(
            [
              ["make", "Make"],
              ["model", "Model"],
              ["category", "Category"],
              ["year", "Year"],
              ["dailyRate", "Daily rate (AED)"],
              ["weeklyRate", "Weekly rate (optional)"],
              ["depositAmount", "Deposit (AED)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label htmlFor={key}>{label}</label>
              <input
                id={key}
                required={key !== "weeklyRate"}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          {error ? <p className="text-sm text-danger md:col-span-2">{error}</p> : null}
          <div className="md:col-span-2">
            <button className="btn-gold" disabled={busy} type="submit">
              Save vehicle
            </button>
          </div>
        </form>
      ) : null}

      {vehicles.length > 0 ? (
        <table className="mt-8 w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted">
            <tr>
              <th className="pb-3">Vehicle</th>
              <th className="pb-3">Category</th>
              <th className="pb-3">Daily</th>
              <th className="pb-3">Deposit</th>
              <th className="pb-3">Status</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id} className="border-t border-line">
                <td className="py-4">
                  <Link href={`/admin/fleet/${vehicle.id}`} className="text-gold-2 hover:underline">
                    {vehicle.make} {vehicle.model} ({vehicle.year})
                  </Link>
                </td>
                <td className="py-4">{vehicle.category}</td>
                <td className="py-4">{vehicle.dailyRate}</td>
                <td className="py-4">{vehicle.depositAmount}</td>
                <td className="py-4">
                  <button
                    type="button"
                    className="text-gold hover:underline"
                    onClick={() => toggleActive(vehicle.id, vehicle.active)}
                  >
                    {vehicle.active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="py-4 text-right">
                  <Link href={`/admin/fleet/${vehicle.id}`} className="text-muted hover:text-cream">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
