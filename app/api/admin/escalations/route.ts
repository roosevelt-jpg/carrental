import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { resolveOwnerDecision } from "@/lib/agent/owner-resolution";
import { decryptPii } from "@/lib/privacy/pii";

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
  return NextResponse.json({ escalations: escalations.map((item) => ({ ...item, contextSummary: decryptPii(item.contextSummary), suggestedReply: decryptPii(item.suggestedReply), ownerReply: decryptPii(item.ownerReply), conversation: { ...item.conversation, customer: { ...item.conversation.customer, name: decryptPii(item.conversation.customer.name), whatsappId: decryptPii(item.conversation.customer.whatsappId) } } })) });
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

  const result = await resolveOwnerDecision({
    escalationId: parsed.data.escalationId,
    ownerReply: parsed.data.ownerReply,
    actor: session,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, escalation: result.escalation });
}
