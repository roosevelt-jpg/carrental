import { prisma } from "@/lib/db";
import { getCredential } from "@/lib/settings/settings-service";
import { runOrchestrator } from "@/lib/agent/orchestrator";
import {
  findOpenEscalationByReference,
} from "@/lib/agent/escalation";
import {
  markMessageRead,
  sendReaction,
} from "@/lib/integrations/whatsapp-client";
import { deliverAgentReply } from "@/lib/agent/deliver-reply";
import { resolveOwnerDecision } from "@/lib/agent/owner-resolution";
import type { AgentReply } from "@/lib/agent/orchestrator";
import { captureException } from "@/lib/observability/sentry";

export type InboundMessageJob = {
  metaMessageId: string;
  from: string;
  timestamp: string;
  type: string;
  text?: string;
  contextMessageId?: string;
  payload: unknown;
};

export async function processInboundMessage(data: InboundMessageJob) {
  const startedAt = Date.now();
  const existing = await prisma.message.findUnique({
    where: { metaMessageId: data.metaMessageId },
  });
  if (existing) {
    const completed = await prisma.processingMetric.findUnique({
      where: { inboundMessageId: data.metaMessageId },
      select: { id: true },
    });
    if (completed) return { skipped: true, reason: "duplicate" };
  }

  const ownerPhone = await getCredential("whatsapp", "owner_phone_number");
  const normalizedFrom = data.from.replace(/\D/g, "");
  const normalizedOwner = ownerPhone?.replace(/\D/g, "") ?? "";

  if (
    normalizedOwner &&
    normalizedFrom === normalizedOwner &&
    data.text
  ) {
    const open = await findOpenEscalationByReference(data.text, data.contextMessageId);
    if (open) {
      const cleaned =
        data.text.replace(/\bREF-\d{4}\b/gi, "").trim() || data.text;
      await resolveOwnerDecision({
        escalationId: open.id,
        ownerReply: cleaned,
        ownerMetaMessageId: data.metaMessageId,
      });
      return { ownerEscalationResolved: true, escalationId: open.id };
    }
    console.warn(JSON.stringify({
      msg: "owner_reply_unmatched",
      metaMessageId: data.metaMessageId,
      contextMessageId: data.contextMessageId,
    }));
    return { skipped: true, reason: "owner_reply_unmatched" };
  }

  const inboundAt = /^\d+$/.test(data.timestamp)
    ? new Date(Number(data.timestamp) * 1000)
    : new Date();
  const customer = await prisma.customer.upsert({
    where: { whatsappId: data.from },
    create: {
      whatsappId: data.from,
      optInAt: inboundAt,
      lastInboundAt: inboundAt,
    },
    update: {
      lastInboundAt: inboundAt,
    },
  });

  let conversation = existing
    ? await prisma.conversation.findUnique({ where: { id: existing.conversationId } })
    : await prisma.conversation.findFirst({
        where: {
          customerId: customer.id,
          status: { in: ["ACTIVE", "ESCALATED"] },
        },
        orderBy: { lastMessageAt: "desc" },
      });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { customerId: customer.id },
    });
  }

  if (!existing) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "IN",
        type: data.type,
        content: data.text ?? null,
        metaMessageId: data.metaMessageId,
      },
    });
  }
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  try {
    await markMessageRead(data.metaMessageId);
    await sendReaction(data.from, data.metaMessageId, "👀");
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "whatsapp_ack_failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  let reply = existing?.agentReply as AgentReply | null | undefined;
  let orchestrationSucceeded = true;
  if (!reply) {
    try {
      reply = await runOrchestrator(conversation.id);
    } catch (error) {
      orchestrationSucceeded = false;
      captureException(error, {
        stage: "orchestrator",
        conversationId: conversation.id,
        inboundMessageId: data.metaMessageId,
      });
      console.error(
        JSON.stringify({
          msg: "orchestrator_failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      const { escalateToOwner } = await import("@/lib/agent/tools/escalate-to-owner");
      const escalated = await escalateToOwner(conversation.id, {
        reason_code: "out_of_scope",
        conversation_summary: `Unhandled exception while processing message ${data.metaMessageId}: ${
          error instanceof Error ? error.message : "unknown"
        }`,
        urgency: "high",
      });
      reply = {
        texts: [escalated.customer_message ?? "Let me check on that and get right back to you."],
        mediaIds: [] as string[],
        escalated: true,
        paymentLinks: [],
        toolRounds: 0,
      };
    }
    await prisma.message.update({
      where: { metaMessageId: data.metaMessageId },
      data: { agentReply: JSON.parse(JSON.stringify(reply)) },
    });
  }

  const delivered = await deliverAgentReply({
    conversationId: conversation.id,
    to: data.from,
    reply,
    typingMessageId: data.metaMessageId,
    sourceMessageId: data.metaMessageId,
  });

  await prisma.processingMetric.upsert({
    where: { inboundMessageId: data.metaMessageId },
    create: {
      conversationId: conversation.id,
      inboundMessageId: data.metaMessageId,
      latencyMs: Date.now() - startedAt,
      toolRounds: reply.toolRounds,
      escalated: reply.escalated,
      succeeded: orchestrationSucceeded,
      errorCode: orchestrationSucceeded ? null : "orchestrator_failed",
    },
    update: {},
  });

  return {
    conversationId: conversation.id,
    replies: delivered.sentTexts,
    photos: delivered.sentPhotos,
    paymentLinks: delivered.paymentLinks,
    escalated: reply.escalated,
  };
}
