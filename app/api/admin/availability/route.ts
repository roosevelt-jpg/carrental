import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";

const createSchema = z.object({
  vehicleId: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.enum(["BOOKED", "MAINTENANCE", "HOLD"]),
});

export async function GET(request: NextRequest) {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;

  const vehicleId = request.nextUrl.searchParams.get("vehicleId");
  if (!vehicleId) {
    return NextResponse.json({ error: "vehicleId is required" }, { status: 400 });
  }

  const blocks = await prisma.availabilityBlock.findMany({
    where: { vehicleId },
    orderBy: { startDate: "asc" },
  });
  return NextResponse.json({ blocks });
}

export async function POST(request: NextRequest) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid availability block" }, { status: 400 });
  }

  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);
  if (endDate <= startDate) {
    return NextResponse.json({ error: "endDate must be after startDate" }, { status: 400 });
  }

  const block = await prisma.availabilityBlock.create({
    data: {
      vehicleId: parsed.data.vehicleId,
      startDate,
      endDate,
      reason: parsed.data.reason,
    },
  });
  return NextResponse.json({ block }, { status: 201 });
}
