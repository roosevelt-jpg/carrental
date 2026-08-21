import { prisma } from "@/lib/db";
import { parseDateOnly, rangesOverlap, toDateString } from "@/lib/agent/dates";

export async function checkAvailability(input: {
  vehicle_id: string;
  start_date: string;
  end_date: string;
}) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: input.vehicle_id },
    include: {
      availabilityBlocks: { orderBy: { startDate: "asc" } },
    },
  });
  if (!vehicle || !vehicle.active) {
    return { available: false, error: "Vehicle not found or inactive" };
  }

  const start = parseDateOnly(input.start_date);
  const end = parseDateOnly(input.end_date);
  const conflicts = vehicle.availabilityBlocks.filter((b) =>
    rangesOverlap(start, end, b.startDate, b.endDate),
  );

  if (conflicts.length === 0) {
    return {
      available: true,
      vehicle_id: vehicle.id,
      start_date: input.start_date,
      end_date: input.end_date,
    };
  }

  const nightMs = 24 * 60 * 60 * 1000;
  const duration = end.getTime() - start.getTime();
  let cursor = end;
  let nextWindow: { start_date: string; end_date: string } | null = null;

  for (let attempt = 0; attempt < 90; attempt++) {
    const candidateStart = cursor;
    const candidateEnd = new Date(candidateStart.getTime() + duration);
    const clash = vehicle.availabilityBlocks.some((b) =>
      rangesOverlap(candidateStart, candidateEnd, b.startDate, b.endDate),
    );
    if (!clash) {
      nextWindow = {
        start_date: toDateString(candidateStart),
        end_date: toDateString(candidateEnd),
      };
      break;
    }
    cursor = new Date(cursor.getTime() + nightMs);
  }

  return {
    available: false,
    vehicle_id: vehicle.id,
    conflicts: conflicts.map((c) => ({
      reason: c.reason,
      start_date: toDateString(c.startDate),
      end_date: toDateString(c.endDate),
    })),
    next_available_window: nextWindow,
  };
}
