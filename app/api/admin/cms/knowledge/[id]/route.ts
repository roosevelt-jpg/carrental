import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { knowledgePatchSchema } from "@/lib/cms/schemas";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;
  const { id } = await params;
  const parsed = knowledgePatchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid knowledge entry" }, { status: 400 });
  const before = await prisma.knowledgeEntry.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Knowledge entry not found" }, { status: 404 });
  const entry = await prisma.knowledgeEntry.update({ where: { id }, data: parsed.data });
  await writeAuditLog({ actor: session, entityType: "KnowledgeEntry", entityId: id, action: "update", summary: `Updated knowledge entry: ${entry.title}`, before, after: entry });
  return NextResponse.json({ entry });
}
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;
  const { id } = await params;
  const before = await prisma.knowledgeEntry.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Knowledge entry not found" }, { status: 404 });
  await prisma.knowledgeEntry.delete({ where: { id } });
  await writeAuditLog({ actor: session, entityType: "KnowledgeEntry", entityId: id, action: "delete", summary: `Deleted knowledge entry: ${before.title}`, before });
  return NextResponse.json({ ok: true });
}
