import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";

const patchSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "STAFF"]).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await requireSession("OWNER");
  if (!isSession(session)) return session;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (id === session.userId && parsed.data.role && parsed.data.role !== "OWNER") {
    return NextResponse.json(
      { error: "You cannot demote your own OWNER account" },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: parsed.data,
      select: { id: true, email: true, role: true, createdAt: true },
    });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await requireSession("OWNER");
  if (!isSession(session)) return session;

  const { id } = await params;
  if (id === session.userId) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const owners = await prisma.user.count({ where: { role: "OWNER" } });
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (target.role === "OWNER" && owners <= 1) {
    return NextResponse.json({ error: "Cannot delete the last OWNER" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
