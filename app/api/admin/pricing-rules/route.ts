import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";

export const pricingRuleSchema = z.object({
  vehicleId: z.string().min(1),
  ruleType: z.enum(["SEASONAL", "DURATION", "WEEKDAY"]),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  adjustmentPct: z.coerce.number().optional().nullable(),
  adjustmentFlat: z.coerce.number().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;

  const vehicleId = request.nextUrl.searchParams.get("vehicleId");
  const rules = await prisma.pricingRule.findMany({
    where: vehicleId ? { vehicleId } : undefined,
    include: { vehicle: { select: { make: true, model: true, year: true } } },
    orderBy: { id: "desc" },
  });
  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;

  const parsed = pricingRuleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid pricing rule" }, { status: 400 });
  }
  if (
    parsed.data.adjustmentPct == null &&
    parsed.data.adjustmentFlat == null
  ) {
    return NextResponse.json(
      { error: "Provide adjustmentPct or adjustmentFlat" },
      { status: 400 },
    );
  }

  const rule = await prisma.pricingRule.create({
    data: {
      vehicleId: parsed.data.vehicleId,
      ruleType: parsed.data.ruleType,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      adjustmentPct: parsed.data.adjustmentPct ?? null,
      adjustmentFlat: parsed.data.adjustmentFlat ?? null,
    },
  });
  return NextResponse.json({ rule }, { status: 201 });
}
