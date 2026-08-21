import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/agent/dates";
import { computeQuotePricing } from "@/lib/agent/pricing";
import { checkAvailability } from "@/lib/agent/tools/check-availability";
import { getQuoteHoldMinutes } from "@/lib/env";
import { getExpireQuotesQueue } from "@/lib/queue/queues";

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

  const startDate = parseDateOnly(input.start_date);
  const endDate = parseDateOnly(input.end_date);
  const holdMinutes = getQuoteHoldMinutes();
  const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);

  // The transaction and database exclusion constraint make the availability
  // check atomic. Never trust the model-supplied total.
  const quote = await prisma.$transaction(
    async (tx) => {
      const conflict = await tx.availabilityBlock.findFirst({
        where: {
          vehicleId: vehicle.id,
          startDate: { lt: endDate },
          endDate: { gt: startDate },
        },
      });
      if (conflict) {
        throw new Error("Vehicle became unavailable while the quote was being created");
      }
      const hold = await tx.availabilityBlock.create({
        data: { vehicleId: vehicle.id, startDate, endDate, reason: "HOLD" },
      });
      return tx.quote.create({
        data: {
          conversationId,
          vehicleId: vehicle.id,
          startDate,
          endDate,
          totalPrice: pricing.totalPrice,
          depositDue: pricing.depositDue,
          status: "PENDING",
          expiresAt,
          availabilityBlockId: hold.id,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );

  await getExpireQuotesQueue().add(
    "expire",
    {},
    { delay: holdMinutes * 60 * 1000, jobId: `expire-quote-${quote.id}` },
  );

  return {
    ok: true,
    quote_id: quote.id,
    vehicle_id: vehicle.id,
    start_date: input.start_date,
    end_date: input.end_date,
    total_price: pricing.totalPrice,
    deposit_due: pricing.depositDue,
    expires_at: quote.expiresAt.toISOString(),
    model_supplied_total: input.total_price,
    note:
      input.total_price !== pricing.totalPrice
        ? "Stored DB-computed total; model-supplied total differed and was ignored."
        : undefined,
  };
}
