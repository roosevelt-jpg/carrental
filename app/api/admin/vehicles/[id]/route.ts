import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";

const updateSchema = z.object({
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  year: z.coerce.number().int().min(1990).max(2100).optional(),
  dailyRate: z.coerce.number().positive().optional(),
  weeklyRate: z.coerce.number().positive().nullable().optional(),
  depositAmount: z.coerce.number().nonnegative().optional(),
  active: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;

  const { id } = await params;
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      pricingRules: true,
      availabilityBlocks: { orderBy: { startDate: "asc" } },
    },
  });
  if (!vehicle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ vehicle });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ vehicle });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;

  const { id } = await params;
  try {
    await prisma.vehicle.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
