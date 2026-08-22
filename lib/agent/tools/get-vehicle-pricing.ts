import { prisma } from "@/lib/db";
import { computeQuotePricing } from "@/lib/agent/pricing";
import { getCmsSettings } from "@/lib/cms/content";

export async function getVehiclePricing(input: {
  vehicle_id: string;
  start_date: string;
  end_date: string;
}) {
  const [vehicle, cms] = await Promise.all([prisma.vehicle.findUnique({
    where: { id: input.vehicle_id },
    include: { pricingRules: true },
  }), getCmsSettings()]);
  if (!vehicle || !vehicle.active) {
    return { ok: false, error: "Vehicle not found or inactive" };
  }
  if (!cms.currency.trim()) {
    return { ok: false, error: "Business currency is not configured" };
  }

  const pricing = computeQuotePricing(
    vehicle,
    vehicle.pricingRules,
    input.start_date,
    input.end_date,
  );

  return {
    ok: true,
    vehicle_id: vehicle.id,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    start_date: input.start_date,
    end_date: input.end_date,
    currency: cms.currency,
    ...pricing,
  };
}
