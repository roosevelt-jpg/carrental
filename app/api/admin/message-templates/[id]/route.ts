import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit";

const patchSchema = z.object({
  metaTemplateName: z.string().trim().min(1).max(512).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  language: z.string().trim().min(2).max(20).optional(),
  category: z.enum(["UTILITY", "MARKETING", "AUTHENTICATION"]).optional(),
  bodyText: z.string().trim().min(1).max(1024).optional(),
  sampleValues: z.array(z.string().trim().max(500)).max(20).optional(),
  headerText: z.string().trim().max(60).optional().nullable(),
  footerText: z.string().trim().max(60).optional().nullable(),
  buttonType: z.enum(["NONE", "QUICK_REPLY", "URL", "PHONE_NUMBER"]).optional(),
  buttonText: z.string().trim().max(25).optional().nullable(),
  buttonValue: z.string().trim().max(2000).optional().nullable(),
}).strict();

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

  const bodyVariables = parsed.data.bodyText
    ? Array.from(parsed.data.bodyText.matchAll(/{{\s*([a-z][a-z0-9_]*)\s*}}/gi))
        .map((match) => match[1].toLowerCase())
        .filter((name, index, all) => all.indexOf(name) === index)
    : before.bodyVariables;
  const samples = parsed.data.sampleValues ?? before.sampleValues;
  if (samples.length !== bodyVariables.length) {
    return NextResponse.json(
      { error: `Provide one sample value for each variable (${bodyVariables.join(", ") || "none"})` },
      { status: 400 },
    );
  }
  const contentChanged = ["metaTemplateName", "language", "category", "bodyText", "sampleValues", "headerText", "footerText", "buttonType", "buttonText", "buttonValue"]
    .some((key) => key in parsed.data);
  const template = await prisma.messageTemplate.update({
    where: { id },
    data: {
      ...parsed.data,
      bodyVariables,
      ...(contentChanged ? { status: "DRAFT", rejectionReason: null } : {}),
    },
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
