import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { resolveEscalationWithOwnerReply } from "@/lib/agent/escalation";
import { sendTextMessage } from "@/lib/integrations/whatsapp-client";

export async function GET(request: NextRequest) {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;

  const status = request.nextUrl.searchParams.get("status");
  const escalations = await prisma.escalation.findMany({
    where: status === "OPEN" || status === "RESOLVED" ? { status } : undefined,
    include: {
      conversation: {
        include: {
          customer: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ escalations });
}

const replySchema = z.object({
  escalationId: z.string().min(1),
  ownerReply: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;

  const parsed = replySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "escalationId and ownerReply required" }, { status: 400 });
  }

  const result = await resolveEscalationWithOwnerReply(
    parsed.data.escalationId,
    parsed.data.ownerReply,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: result.escalation.conversationId },
    include: { customer: true },
  });
  if (conversation) {
    await sendTextMessage(conversation.customer.whatsappId, parsed.data.ownerReply);
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "OUT",
        type: "text",
        content: parsed.data.ownerReply,
      },
    });
  }

  return NextResponse.json({ ok: true, escalation: result.escalation });
}
