import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { hashInvitationToken } from "@/lib/auth/invitations";
import { setSessionCookie } from "@/lib/auth/session";

const schema = z.object({ token: z.string().min(20), password: z.string().min(10), name: z.string().trim().max(100).optional() });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "A valid invitation and password of at least 10 characters are required" }, { status: 400 });
  const tokenHash = hashInvitationToken(parsed.data.token);
  const invitation = await prisma.userInvitation.findUnique({ where: { tokenHash } });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) return NextResponse.json({ error: "This invitation is invalid or has expired" }, { status: 410 });
  const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existing) return NextResponse.json({ error: "An account already exists for this email" }, { status: 409 });
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { email: invitation.email, passwordHash: await hashPassword(parsed.data.password), role: invitation.role, name: parsed.data.name || null } });
    await tx.userInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    return created;
  });
  await setSessionCookie({ userId: user.id, email: user.email, role: user.role });
  return NextResponse.json({ ok: true });
}
