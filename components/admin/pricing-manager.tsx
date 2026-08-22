"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type VehicleOption = { id: string; label: string };
type RuleRow = {
  id: string;
  vehicleId: string;
  ruleType: string;
  adjustmentPct: string | null;
  adjustmentFlat: string | null;
  startDate: string | null;
  endDate: string | null;
  vehicleLabel: string;
};

export function PricingManager({
  vehicles,
  rules,
  currency,
}: {
  vehicles: VehicleOption[];
  rules: RuleRow[];
  currency: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    vehicleId: vehicles[0]?.id ?? "",
    ruleType: "SEASONAL",
    adjustmentPct: "",
    adjustmentFlat: "",
    startDate: "",
    endDate: "",
  });

  async function createRule(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(editingId ? `/api/admin/pricing-rules/${editingId}` : "/api/admin/pricing-rules", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId: form.vehicleId,
        ruleType: form.ruleType,
        adjustmentPct: form.adjustmentPct ? Number(form.adjustmentPct) : null,
        adjustmentFlat: form.adjustmentFlat ? Number(form.adjustmentFlat) : null,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not create rule");
      return;
    }
    setEditingId(null);
    setForm({ vehicleId: vehicles[0]?.id ?? "", ruleType: "SEASONAL", adjustmentPct: "", adjustmentFlat: "", startDate: "", endDate: "" });
    router.refresh();
  }

  async function removeRule(id: string) {
    await fetch(`/api/admin/pricing-rules/${id}`, { method: "DELETE" });
    router.refresh();
  }

  if (vehicles.length === 0) {
    return (
      <p className="mt-4 text-muted">
        Add a vehicle first, then attach pricing rules.
      </p>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      <form className="grid gap-4 rounded-xl border border-line bg-panel p-6 md:grid-cols-2" onSubmit={createRule}>
        <div>
          <label htmlFor="vehicleId">Vehicle</label>
          <select
            id="vehicleId"
            value={form.vehicleId}
            onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ruleType">Rule type</label>
          <select
            id="ruleType"
            value={form.ruleType}
            onChange={(e) => setForm((f) => ({ ...f, ruleType: e.target.value }))}
          >
            <option value="SEASONAL">Seasonal</option>
            <option value="DURATION">Duration</option>
            <option value="WEEKDAY">Weekday</option>
          </select>
        </div>
        <div>
          <label htmlFor="adjustmentPct">Adjustment %</label>
          <input
            id="adjustmentPct"
            value={form.adjustmentPct}
            onChange={(e) => setForm((f) => ({ ...f, adjustmentPct: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="adjustmentFlat">Adjustment flat{currency ? ` (${currency})` : ""}</label>
          <input
            id="adjustmentFlat"
            value={form.adjustmentFlat}
            onChange={(e) => setForm((f) => ({ ...f, adjustmentFlat: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="startDate">Start date</label>
          <input
            id="startDate"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="endDate">End date</label>
          <input
            id="endDate"
            type="date"
            value={form.endDate}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
          />
        </div>
        {error ? <p className="text-sm text-danger md:col-span-2">{error}</p> : null}
        <div className="md:col-span-2">
          <button className="btn-gold" disabled={busy} type="submit">
            {editingId ? "Save rule" : "Add rule"}
          </button>
          {editingId ? <button type="button" className="btn-ghost ml-3" onClick={() => setEditingId(null)}>Cancel</button> : null}
        </div>
      </form>

      <ul className="space-y-3">
        {rules.map((rule) => (
          <li key={rule.id} className="flex items-center justify-between rounded-xl border border-line bg-panel p-4">
            <div>
              <p className="text-gold-2">{rule.vehicleLabel}</p>
              <p className="text-sm text-muted">
                {rule.ruleType}
                {rule.adjustmentPct != null ? ` · ${rule.adjustmentPct}%` : ""}
                {rule.adjustmentFlat != null ? ` · ${rule.adjustmentFlat}${currency ? ` ${currency}` : ""}` : ""}
              </p>
            </div>
            <div className="flex gap-3"><button type="button" className="text-sm text-gold" onClick={() => { setEditingId(rule.id); setForm({ vehicleId: rule.vehicleId, ruleType: rule.ruleType, adjustmentPct: rule.adjustmentPct ?? "", adjustmentFlat: rule.adjustmentFlat ?? "", startDate: rule.startDate?.slice(0, 10) ?? "", endDate: rule.endDate?.slice(0, 10) ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button><button type="button" className="text-sm text-danger" onClick={() => removeRule(rule.id)}>Delete</button></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
