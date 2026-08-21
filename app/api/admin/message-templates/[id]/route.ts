import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit";

const patchSchema = z.object({
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).optional(),
  metaTemplateName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  language: z.string().min(2).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const before = await prisma.messageTemplate.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const template = await prisma.messageTemplate.update({
    where: { id },
    data: parsed.data,
  });

  await writeAuditLog({
    actor: session,
    entityType: "MessageTemplate",
    entityId: template.id,
    action: "update",
    summary: `Updated template ${template.name} → ${template.status}`,
    before,
    after: template,
  });

  return NextResponse.json({ template });
}
