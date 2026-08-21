import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";

const createSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  category: z.string().min(1),
  year: z.coerce.number().int().min(1990).max(2100),
  dailyRate: z.coerce.number().positive(),
  weeklyRate: z.coerce.number().positive().optional().nullable(),
  depositAmount: z.coerce.number().nonnegative(),
  active: z.boolean().optional(),
});

export async function GET() {
  const session = await requireSession("STAFF");
  if (!isSession(session)) {
    return session;
  }

  const vehicles = await prisma.vehicle.findMany({
    orderBy: [{ make: "asc" }, { model: "asc" }],
  });
  return NextResponse.json({ vehicles });
}

export async function POST(request: NextRequest) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) {
    return session;
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Make, model, category, year, daily rate, and deposit are required" },
      { status: 400 },
    );
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      make: parsed.data.make.trim(),
      model: parsed.data.model.trim(),
      category: parsed.data.category.trim(),
      year: parsed.data.year,
      dailyRate: parsed.data.dailyRate,
      weeklyRate: parsed.data.weeklyRate ?? null,
      depositAmount: parsed.data.depositAmount,
      active: parsed.data.active ?? true,
    },
  });

  return NextResponse.json({ vehicle }, { status: 201 });
}
