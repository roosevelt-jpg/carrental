import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  policyType: z.enum(["DEPOSIT", "DOCUMENTATION", "DELIVERY", "CANCELLATION"]),
  bodyText: z.string().min(1),
});

export async function GET() {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;

  const policies = await prisma.policy.findMany({
    orderBy: [{ policyType: "asc" }, { effectiveFrom: "desc" }],
  });
  return NextResponse.json({ policies });
}

export async function POST(request: NextRequest) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Policy type and body are required" }, { status: 400 });
  }

  const previous = await prisma.policy.findFirst({
    where: { policyType: parsed.data.policyType },
    orderBy: { effectiveFrom: "desc" },
  });

  const policy = await prisma.policy.create({
    data: {
      policyType: parsed.data.policyType,
      bodyText: parsed.data.bodyText.trim(),
    },
  });

  await writeAuditLog({
    actor: session,
    entityType: "Policy",
    entityId: policy.id,
    action: "create",
    summary: `Published ${policy.policyType} policy`,
    before: previous,
    after: policy,
  });

  return NextResponse.json({ policy }, { status: 201 });
}
