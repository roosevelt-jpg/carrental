import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { OutcomeType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  outcome: z.enum(["BOOKED", "DROPPED", "ESCALATED"]),
});

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;

  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "outcome is required" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const before = await prisma.conversationOutcome.findUnique({
    where: { conversationId: id },
  });

  const outcome = await prisma.conversationOutcome.upsert({
    where: { conversationId: id },
    create: {
      conversationId: id,
      outcome: parsed.data.outcome as OutcomeType,
      taggedBy: "HUMAN",
    },
    update: {
      outcome: parsed.data.outcome as OutcomeType,
      taggedBy: "HUMAN",
      taggedAt: new Date(),
    },
  });

  if (parsed.data.outcome === "DROPPED" && conversation.status !== "CLOSED") {
    await prisma.conversation.update({
      where: { id },
      data: { status: "CLOSED" },
    });
  }

  await writeAuditLog({
    actor: session,
    entityType: "ConversationOutcome",
    entityId: outcome.id,
    action: "tag",
    summary: `Tagged conversation ${id} as ${parsed.data.outcome}`,
    before,
    after: outcome,
  });

  return NextResponse.json({ outcome });
}
