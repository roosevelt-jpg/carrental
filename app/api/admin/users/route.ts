import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { isSession, requireSession } from "@/lib/auth/guards";

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
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
      { error: "Valid email, password (10+ chars), and role are required" },
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

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase().trim(),
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
    },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
