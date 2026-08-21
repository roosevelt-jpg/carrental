import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { faqPatchSchema } from "@/lib/cms/schemas";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;
  const { id } = await params;
  const parsed = faqPatchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid FAQ" }, { status: 400 });
  const before = await prisma.faqEntry.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
  const faq = await prisma.faqEntry.update({ where: { id }, data: parsed.data });
  await writeAuditLog({ actor: session, entityType: "FaqEntry", entityId: id, action: "update", summary: `Updated FAQ: ${faq.question}`, before, after: faq });
  return NextResponse.json({ faq });
}
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;
  const { id } = await params;
  const before = await prisma.faqEntry.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
  await prisma.faqEntry.delete({ where: { id } });
  await writeAuditLog({ actor: session, entityType: "FaqEntry", entityId: id, action: "delete", summary: `Deleted FAQ: ${before.question}`, before });
  return NextResponse.json({ ok: true });
}
