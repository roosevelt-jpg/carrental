import { PricingManager } from "@/components/admin/pricing-manager";
import { prisma } from "@/lib/db";
import { getCmsSettings } from "@/lib/cms/content";

export default async function PricingPage() {
  const [vehicles, rules, cms] = await Promise.all([
    prisma.vehicle.findMany({ orderBy: [{ make: "asc" }, { model: "asc" }] }),
    prisma.pricingRule.findMany({
      include: { vehicle: true },
      orderBy: { id: "desc" },
    }),
    getCmsSettings(),
  ]);

  return (
    <div>
      <h1 className="font-serif text-4xl">Pricing</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Seasonal, duration, and weekday adjustments. The agent reads these through tools — never from the prompt.
      </p>
      <PricingManager
        currency={cms.currency}
        vehicles={vehicles.map((v) => ({
          id: v.id,
          label: `${v.make} ${v.model} (${v.year})`,
        }))}
        rules={rules.map((r) => ({
          id: r.id,
          vehicleId: r.vehicleId,
          ruleType: r.ruleType,
          adjustmentPct: r.adjustmentPct?.toString() ?? null,
          adjustmentFlat: r.adjustmentFlat?.toString() ?? null,
          startDate: r.startDate?.toISOString() ?? null,
          endDate: r.endDate?.toISOString() ?? null,
          vehicleLabel: `${r.vehicle.make} ${r.vehicle.model}`,
        }))}
      />
    </div>
  );
}
