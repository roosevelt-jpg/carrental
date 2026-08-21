import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

const closeSchema = z.object({
  markDropped: z.boolean().optional(),
});

export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;

  const { id } = await params;
  const parsed = closeSchema.safeParse(await request.json().catch(() => ({})));
  const markDropped = parsed.success ? Boolean(parsed.data.markDropped) : false;

  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.conversation.update({
    where: { id },
    data: { status: "CLOSED" },
  });

  if (markDropped) {
    await prisma.conversationOutcome.upsert({
      where: { conversationId: id },
      create: {
        conversationId: id,
        outcome: "DROPPED",
        taggedBy: "HUMAN",
      },
      update: {
        outcome: "DROPPED",
        taggedBy: "HUMAN",
        taggedAt: new Date(),
      },
    });
  }

  await writeAuditLog({
    actor: session,
    entityType: "Conversation",
    entityId: id,
    action: "close",
    summary: markDropped
      ? `Closed conversation and marked DROPPED`
      : `Closed conversation`,
  });

  return NextResponse.json({ ok: true });
}
