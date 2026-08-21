import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { faqCreateSchema } from "@/lib/cms/schemas";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;
  const parsed = faqCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid FAQ" }, { status: 400 });
  }
  const faq = await prisma.faqEntry.create({ data: parsed.data });
  await writeAuditLog({ actor: session, entityType: "FaqEntry", entityId: faq.id, action: "create", summary: `Created FAQ: ${faq.question}`, after: faq });
  return NextResponse.json({ faq }, { status: 201 });
}
