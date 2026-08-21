import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/agent/dates";
import { computeQuotePricing } from "@/lib/agent/pricing";
import { checkAvailability } from "@/lib/agent/tools/check-availability";

export async function createQuote(
  conversationId: string,
  input: {
    vehicle_id: string;
    start_date: string;
    end_date: string;
    total_price: number;
  },
) {
  const availability = await checkAvailability({
    vehicle_id: input.vehicle_id,
    start_date: input.start_date,
    end_date: input.end_date,
  });
  if (!availability.available) {
    return { ok: false, error: "Vehicle is not available for those dates", availability };
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: input.vehicle_id },
    include: { pricingRules: true },
  });
  if (!vehicle || !vehicle.active) {
    return { ok: false, error: "Vehicle not found or inactive" };
  }

  const pricing = computeQuotePricing(
    vehicle,
    vehicle.pricingRules,
    input.start_date,
    input.end_date,
  );

  // Never trust the model-supplied total — recompute from DB.
  const quote = await prisma.quote.create({
    data: {
      conversationId,
      vehicleId: vehicle.id,
      startDate: parseDateOnly(input.start_date),
      endDate: parseDateOnly(input.end_date),
      totalPrice: pricing.totalPrice,
      depositDue: pricing.depositDue,
      status: "PENDING",
    },
  });

  return {
    ok: true,
    quote_id: quote.id,
    vehicle_id: vehicle.id,
    start_date: input.start_date,
    end_date: input.end_date,
    total_price: pricing.totalPrice,
    deposit_due: pricing.depositDue,
    model_supplied_total: input.total_price,
    note:
      input.total_price !== pricing.totalPrice
        ? "Stored DB-computed total; model-supplied total differed and was ignored."
        : undefined,
  };
}
