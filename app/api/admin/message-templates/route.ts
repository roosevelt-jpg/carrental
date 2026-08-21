import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { getCredential } from "@/lib/settings/settings-service";
import { graphGet } from "@/lib/integrations/whatsapp-client";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;

  const templates = await prisma.messageTemplate.findMany({
    orderBy: { purpose: "asc" },
  });
  return NextResponse.json({ templates });
}

export async function POST() {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;
  const wabaId = await getCredential("whatsapp", "waba_id");
  if (!wabaId) {
    return NextResponse.json({ error: "WhatsApp Business Account ID is required" }, { status: 400 });
  }
  const response = (await graphGet(
    `${encodeURIComponent(wabaId)}/message_templates?fields=id,name,status,language,category,rejected_reason&limit=100`,
  )) as { data?: Array<{ id: string; name: string; status: string; language: string; category?: string; rejected_reason?: string }> };
  const remote = response.data ?? [];
  const local = await prisma.messageTemplate.findMany();
  let updated = 0;
  for (const template of local) {
    const match = remote.find((item) =>
      item.id === template.metaTemplateId || item.name === (template.metaTemplateName ?? template.name),
    );
    if (!match) continue;
    const status =
      match.status === "APPROVED"
        ? "APPROVED"
        : match.status === "REJECTED"
          ? "REJECTED"
          : "SUBMITTED";
    await prisma.messageTemplate.update({
      where: { id: template.id },
      data: {
        status,
        language: match.language,
        metaTemplateName: match.name,
        metaTemplateId: match.id,
        category: match.category === "MARKETING" || match.category === "AUTHENTICATION" ? match.category : "UTILITY",
        rejectionReason: match.rejected_reason ?? null,
      },
    });
    updated += 1;
  }
  await writeAuditLog({
    actor: session,
    entityType: "MessageTemplate",
    action: "sync",
    summary: `Synchronized ${updated} template statuses from Meta`,
  });
  return NextResponse.json({ ok: true, updated });
}
