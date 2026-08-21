import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { getCredential } from "@/lib/settings/settings-service";
import { graphPost } from "@/lib/integrations/whatsapp-client";
import { buildMetaTemplatePayload } from "@/lib/integrations/meta-template-publisher";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;
  const { id } = await params;
  const [template, wabaId] = await Promise.all([
    prisma.messageTemplate.findUnique({ where: { id } }),
    getCredential("whatsapp", "waba_id"),
  ]);
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (!wabaId) return NextResponse.json({ error: "Connect WhatsApp and add the WABA ID first" }, { status: 400 });

  try {
    const payload = buildMetaTemplatePayload(template);
    const response = template.metaTemplateId
      ? await graphPost(template.metaTemplateId, {
          category: payload.category,
          components: payload.components,
        })
      : await graphPost(`${encodeURIComponent(wabaId)}/message_templates`, payload);
    const remote = response as { id?: string; status?: string; category?: string };
    const updated = await prisma.messageTemplate.update({
      where: { id },
      data: {
        metaTemplateName: payload.name,
        metaTemplateId: remote.id ?? template.metaTemplateId,
        category: remote.category === "MARKETING" || remote.category === "AUTHENTICATION" ? remote.category : template.category,
        status: remote.status === "APPROVED" ? "APPROVED" : remote.status === "REJECTED" ? "REJECTED" : "SUBMITTED",
        rejectionReason: null,
        lastSubmittedAt: new Date(),
      },
    });
    await writeAuditLog({
      actor: session,
      entityType: "MessageTemplate",
      entityId: id,
      action: template.metaTemplateId ? "resubmit" : "submit",
      summary: `${template.metaTemplateId ? "Resubmitted" : "Submitted"} ${payload.name} to Meta`,
      before: template,
      after: updated,
    });
    return NextResponse.json({ template: updated, response });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Meta template submission failed" },
      { status: 502 },
    );
  }
}
