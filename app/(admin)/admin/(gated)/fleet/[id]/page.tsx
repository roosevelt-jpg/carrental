import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityManager } from "@/components/admin/availability-manager";
import { PhotoUploader } from "@/components/admin/photo-uploader";
import { VehicleEditor } from "@/components/admin/vehicle-editor";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export default async function VehicleDetailPage({ params }: Params) {
  const { id } = await params;
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      availabilityBlocks: { orderBy: { startDate: "asc" } },
    },
  });
  if (!vehicle) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/fleet" className="text-sm text-gold hover:underline">
          ← Fleet
        </Link>
        <h1 className="mt-3 font-serif text-4xl">
          {vehicle.make} {vehicle.model}
        </h1>
        <p className="mt-2 text-muted">
          {vehicle.year} · {vehicle.category} · {vehicle.active ? "Active" : "Inactive"}
        </p>
      </div>

      <VehicleEditor
        vehicle={{
          id: vehicle.id,
          make: vehicle.make,
          model: vehicle.model,
          category: vehicle.category,
          year: vehicle.year,
          dailyRate: vehicle.dailyRate.toString(),
          weeklyRate: vehicle.weeklyRate?.toString() ?? null,
          depositAmount: vehicle.depositAmount.toString(),
          active: vehicle.active,
        }}
      />

      <PhotoUploader vehicleId={vehicle.id} photoUrls={vehicle.photoUrls} />

      <AvailabilityManager
        vehicleId={vehicle.id}
        blocks={vehicle.availabilityBlocks.map((b) => ({
          id: b.id,
          startDate: b.startDate.toISOString(),
          endDate: b.endDate.toISOString(),
          reason: b.reason,
        }))}
      />
    </div>
  );
}
