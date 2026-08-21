import { FleetManager } from "@/components/admin/fleet-manager";
import { prisma } from "@/lib/db";

export default async function FleetPage() {
  const vehicles = await prisma.vehicle.findMany({
    orderBy: [{ make: "asc" }, { model: "asc" }],
  });

  return (
    <div>
      <h1 className="font-serif text-4xl">Fleet</h1>
      <FleetManager
        vehicles={vehicles.map((v) => ({
          id: v.id,
          make: v.make,
          model: v.model,
          category: v.category,
          year: v.year,
          dailyRate: v.dailyRate.toString(),
          depositAmount: v.depositAmount.toString(),
          weeklyRate: v.weeklyRate?.toString() ?? null,
          active: v.active,
        }))}
      />
    </div>
  );
}
