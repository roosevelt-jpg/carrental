import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
});

export async function POST(request: NextRequest) {
  const existing = await prisma.user.count();
  if (existing > 0) {
    return NextResponse.json(
      { error: "Owner account already exists" },
      { status: 409 },
    );
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Valid email and a password of at least 10 characters are required" },
      { status: 400 },
    );
  }

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase().trim(),
      passwordHash: await hashPassword(parsed.data.password),
      role: "OWNER",
    },
  });

  await setSessionCookie({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
}
