import { prisma } from "@/lib/db";

export async function getVehiclePhotos(input: { vehicle_id: string }) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: input.vehicle_id },
    select: { id: true, mediaIds: true, photoUrls: true, make: true, model: true },
  });
  if (!vehicle) {
    return { ok: false, error: "Vehicle not found" };
  }
  return {
    ok: true,
    vehicle_id: vehicle.id,
    make: vehicle.make,
    model: vehicle.model,
    media_ids: vehicle.mediaIds,
    photo_urls: vehicle.photoUrls,
  };
}
