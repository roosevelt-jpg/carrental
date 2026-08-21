import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSession, requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

const profileSchema = z.object({
  name: z.string().trim().max(100).nullable(),
  avatarUrl: z.string().url().max(2_000).nullable(),
});

export async function GET() {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { email: true, name: true, avatarUrl: true, role: true, updatedAt: true },
  });
  return NextResponse.json({ ...user, updatedAt: user.updatedAt.toISOString() });
}

export async function PATCH(request: NextRequest) {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid profile" }, { status: 400 });
  const before = await prisma.user.findUniqueOrThrow({ where: { id: session.userId }, select: { name: true, avatarUrl: true } });
  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { name: parsed.data.name || null, avatarUrl: parsed.data.avatarUrl },
    select: { email: true, name: true, avatarUrl: true, role: true, updatedAt: true },
  });
  await writeAuditLog({ actor: session, entityType: "UserProfile", entityId: session.userId, action: "update", summary: "Updated own profile", before, after: { name: user.name, avatarUrl: user.avatarUrl } });
  return NextResponse.json({ ...user, updatedAt: user.updatedAt.toISOString() });
}
