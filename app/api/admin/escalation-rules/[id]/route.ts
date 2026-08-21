import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  reasonCode: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;

  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const before = await prisma.escalationRule.findUnique({ where: { id } });
    const rule = await prisma.escalationRule.update({
      where: { id },
      data: parsed.data,
    });
    await writeAuditLog({
      actor: session,
      entityType: "EscalationRule",
      entityId: rule.id,
      action: "update",
      summary: `Updated escalation rule ${rule.reasonCode}`,
      before,
      after: rule,
    });
    return NextResponse.json({ rule });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
