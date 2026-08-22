import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { createInvitationToken } from "@/lib/auth/invitations";
import { getAppBaseUrl } from "@/lib/env";

const createSchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "ADMIN", "STAFF"]).default("STAFF"),
});

export async function GET() {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;

  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid email and role are required" },
      { status: 400 },
    );
  }

  if (parsed.data.role === "OWNER" && session.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only an OWNER can create another OWNER" },
      { status: 403 },
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase().trim() },
  });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const { token, tokenHash } = createInvitationToken();
  await prisma.userInvitation.updateMany({ where: { email: parsed.data.email.toLowerCase().trim(), acceptedAt: null }, data: { acceptedAt: new Date() } });
  const invitation = await prisma.userInvitation.create({
    data: {
      email: parsed.data.email.toLowerCase().trim(),
      role: parsed.data.role,
      tokenHash,
      invitedByEmail: session.email,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });
  const inviteUrl = `${getAppBaseUrl()}/admin/invite/${token}`;
  return NextResponse.json({ invitation: { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt, inviteUrl } }, { status: 201 });
}
