import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSession, requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { deleteStoredObject } from "@/lib/storage/object-storage";

type Params = { params: Promise<{ id: string }> };
const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(), category: z.string().trim().min(1).max(80).optional(),
  keywords: z.array(z.string().trim().min(1).max(60)).max(30).optional(), content: z.string().trim().min(1).max(120_000).optional(),
  status: z.enum(["DRAFT", "VERIFIED", "ARCHIVED"]).optional(), expiresAt: z.string().datetime().nullable().optional(),
}).strict();

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await requireSession("ADMIN"); if (!isSession(session)) return session;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid document" }, { status: 400 });
  const { id } = await params;
  const before = await prisma.knowledgeDocument.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (parsed.data.status === "VERIFIED" && !(parsed.data.content ?? before.content).trim()) return NextResponse.json({ error: "A document must contain reviewed text before verification" }, { status: 400 });
  const document = await prisma.knowledgeDocument.update({ where: { id }, data: {
    ...parsed.data,
    expiresAt: parsed.data.expiresAt === undefined ? undefined : parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    verifiedAt: parsed.data.status === "VERIFIED" ? new Date() : parsed.data.status ? null : undefined,
    verifiedBy: parsed.data.status === "VERIFIED" ? session.email : parsed.data.status ? null : undefined,
    errorMessage: parsed.data.content ? null : undefined,
  } });
  await writeAuditLog({ actor: session, entityType: "KnowledgeDocument", entityId: id, action: parsed.data.status === "VERIFIED" ? "verify" : "update", summary: `${parsed.data.status === "VERIFIED" ? "Verified" : "Updated"} training document: ${document.title}`, before, after: document });
  return NextResponse.json({ document });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await requireSession("ADMIN"); if (!isSession(session)) return session;
  const { id } = await params;
  const before = await prisma.knowledgeDocument.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  await prisma.knowledgeDocument.delete({ where: { id } });
  if (before.fileUrl) await deleteStoredObject(before.fileUrl);
  await writeAuditLog({ actor: session, entityType: "KnowledgeDocument", entityId: id, action: "delete", summary: `Deleted training document: ${before.title}`, before });
  return NextResponse.json({ ok: true });
}
