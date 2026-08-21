import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { knowledgeCreateSchema } from "@/lib/cms/schemas";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;
  const parsed = knowledgeCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid knowledge entry" }, { status: 400 });
  }
  const entry = await prisma.knowledgeEntry.create({ data: parsed.data });
  await writeAuditLog({ actor: session, entityType: "KnowledgeEntry", entityId: entry.id, action: "create", summary: `Created knowledge entry: ${entry.title}`, after: entry });
  return NextResponse.json({ entry }, { status: 201 });
}
