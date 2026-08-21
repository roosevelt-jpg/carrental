import { prisma } from "@/lib/db";
import { parseDateOnly, rangesOverlap, toDateString } from "@/lib/agent/dates";
import { computeQuotePricing } from "@/lib/agent/pricing";

export async function getFleetCatalog(input: {
  start_date: string;
  end_date: string;
  category?: string;
  max_daily_budget?: number;
}) {
  const start = parseDateOnly(input.start_date);
  const end = parseDateOnly(input.end_date);

  const vehicles = await prisma.vehicle.findMany({
    where: {
      active: true,
      ...(input.category
        ? { category: { equals: input.category, mode: "insensitive" } }
        : {}),
      ...(input.max_daily_budget != null
        ? { dailyRate: { lte: input.max_daily_budget } }
        : {}),
    },
    include: { availabilityBlocks: true },
    orderBy: [{ dailyRate: "asc" }, { make: "asc" }],
  });

  const available = vehicles
    .filter(
      (v) =>
        !v.availabilityBlocks.some((b) =>
          rangesOverlap(start, end, b.startDate, b.endDate),
        ),
    )
    .map((v) => ({
      id: v.id,
      make: v.make,
      model: v.model,
      year: v.year,
      category: v.category,
      dailyRate: Number(v.dailyRate),
      weeklyRate: v.weeklyRate == null ? null : Number(v.weeklyRate),
      depositAmount: Number(v.depositAmount),
      attributes: v.attributes,
      hasPhotos: v.mediaIds.length > 0 || v.photoUrls.length > 0,
    }));

  return {
    start_date: input.start_date,
    end_date: input.end_date,
    count: available.length,
    vehicles: available,
  };
}
