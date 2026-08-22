import { prisma } from "@/lib/db";
import { resolveEscalationWithOwnerReply } from "@/lib/agent/escalation";
import { runOrchestrator } from "@/lib/agent/orchestrator";
import { deliverAgentReply } from "@/lib/agent/deliver-reply";
import { decryptPii, encryptPii } from "@/lib/privacy/pii";
import { writeAuditLog } from "@/lib/audit";
import type { SessionPayload } from "@/lib/auth/session";

export async function resolveOwnerDecision(params: {
  escalationId: string;
  ownerReply: string;
  ownerMetaMessageId?: string;
  actor?: SessionPayload | null;
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
  const existingDecision = params.ownerMetaMessageId ? await prisma.message.findUnique({ where: { metaMessageId: params.ownerMetaMessageId } }) : null;
  if (!existingDecision) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "IN",
        type: "owner_decision",
        content: encryptPii(decisionContent),
        metaMessageId: params.ownerMetaMessageId,
        deliveryStatus: "RECEIVED",
      },
    });
  }

  const reply = await runOrchestrator(conversation.id);
  await deliverAgentReply({
    conversationId: conversation.id,
    to: decryptPii(conversation.customer.whatsappId)!,
    reply,
    outsideWindowTemplate: "REENGAGEMENT",
    sourceMessageId: params.ownerMetaMessageId ?? `owner-decision:${escalation.id}`,
  });
  const result = await resolveEscalationWithOwnerReply(escalation.id, params.ownerReply);
  if (result.ok) await writeAuditLog({ actor: params.actor, entityType: "Escalation", entityId: escalation.id, action: "resolve", summary: `Resolved escalation ${escalation.referenceCode} through ${params.actor ? "admin" : "verified owner WhatsApp"}`, after: { referenceCode: escalation.referenceCode, resolvedAt: result.escalation.resolvedAt } });
  return result;
}
