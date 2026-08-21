import { prisma } from "@/lib/db";
import { resolveEscalationWithOwnerReply } from "@/lib/agent/escalation";
import { runOrchestrator } from "@/lib/agent/orchestrator";
import { deliverAgentReply } from "@/lib/agent/deliver-reply";

export async function resolveOwnerDecision(params: {
  escalationId: string;
  ownerReply: string;
  ownerMetaMessageId?: string;
}) {
  const escalation = await prisma.escalation.findFirst({
    where: { id: params.escalationId, status: "OPEN" },
  });
  if (!escalation) return { ok: false as const, error: "Open escalation not found" };

  const conversation = await prisma.conversation.findUnique({
    where: { id: escalation.conversationId },
    include: { customer: true },
  });
  if (!conversation) return { ok: false as const, error: "Conversation not found" };

  const decisionContent = `Verified owner decision for ${escalation.referenceCode}: ${params.ownerReply}\nRespond to the customer in the established brand voice. Do not add facts beyond this decision and tool results.`;
  const existingDecision = await prisma.message.findFirst({
    where: {
      conversationId: conversation.id,
      type: "owner_decision",
      content: decisionContent,
    },
  });
  if (!existingDecision) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "IN",
        type: "owner_decision",
        content: decisionContent,
        metaMessageId: params.ownerMetaMessageId,
        deliveryStatus: "RECEIVED",
      },
    });
  }

  const reply = await runOrchestrator(conversation.id);
  await deliverAgentReply({
    conversationId: conversation.id,
    to: conversation.customer.whatsappId,
    reply,
    outsideWindowTemplate: "REENGAGEMENT",
    sourceMessageId: params.ownerMetaMessageId ?? `owner-decision:${escalation.id}`,
  });
  return resolveEscalationWithOwnerReply(escalation.id, params.ownerReply);
}
