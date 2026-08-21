import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  bodyText: z.string().min(1),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;

  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "bodyText is required" }, { status: 400 });
  }

  try {
    const before = await prisma.policy.findUnique({ where: { id } });
    const policy = await prisma.policy.update({
      where: { id },
      data: { bodyText: parsed.data.bodyText.trim() },
    });
    await writeAuditLog({
      actor: session,
      entityType: "Policy",
      entityId: policy.id,
      action: "update",
      summary: `Updated ${policy.policyType} policy text`,
      before,
      after: policy,
    });
    return NextResponse.json({ policy });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;

  const { id } = await params;
  try {
    const before = await prisma.policy.findUnique({ where: { id } });
    await prisma.policy.delete({ where: { id } });
    await writeAuditLog({
      actor: session,
      entityType: "Policy",
      entityId: id,
      action: "delete",
      summary: `Deleted ${before?.policyType ?? "policy"}`,
      before,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
