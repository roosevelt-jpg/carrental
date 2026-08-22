import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { pricingRuleSchema } from "@/app/api/admin/pricing-rules/route";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;
  const parsed = pricingRuleSchema.safeParse(await request.json());
  if (!parsed.success || (parsed.data.adjustmentPct == null && parsed.data.adjustmentFlat == null)) {
    return NextResponse.json({ error: "A valid percentage or flat adjustment is required" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const rule = await prisma.pricingRule.update({
      where: { id },
      data: {
        vehicleId: parsed.data.vehicleId,
        ruleType: parsed.data.ruleType,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        adjustmentPct: parsed.data.adjustmentPct ?? null,
        adjustmentFlat: parsed.data.adjustmentFlat ?? null,
      },
    });
    return NextResponse.json({ rule });
  } catch {
    return NextResponse.json({ error: "Pricing rule not found" }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;

  const { id } = await params;
  try {
    await prisma.pricingRule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
