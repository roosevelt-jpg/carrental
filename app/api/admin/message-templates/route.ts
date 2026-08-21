import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";

export async function GET() {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;

  const templates = await prisma.messageTemplate.findMany({
    orderBy: { purpose: "asc" },
  });
  return NextResponse.json({ templates });
}
