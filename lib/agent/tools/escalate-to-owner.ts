import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendOwnerOperationalMessage } from "@/lib/integrations/whatsapp-messaging";
import { getEscalationReminderQueue } from "@/lib/queue/queues";

function makeReferenceCode() {
  return `REF-${randomInt(1000, 9999)}`;
}

export async function escalateToOwner(
  conversationId: string,
  input: {
    reason_code: string;
    conversation_summary: string;
    urgency?: string;
    suggested_reply?: string;
  },
) {
  const rule = await prisma.escalationRule.findUnique({
    where: { reasonCode: input.reason_code },
  });
  if (rule && !rule.enabled) {
    return {
      ok: false,
      error: `Escalation rule ${input.reason_code} is disabled`,
    };
  }

  let referenceCode = makeReferenceCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.escalation.findUnique({
      where: { referenceCode },
    });
    if (!clash) break;
    referenceCode = makeReferenceCode();
  }

  const urgency = input.urgency === "high" ? "high" : "normal";
  const escalation = await prisma.$transaction(async (tx) => {
    const created = await tx.escalation.create({
      data: {
        conversationId,
        reasonCode: input.reason_code,
        contextSummary: input.conversation_summary,
        referenceCode,
        urgency,
        status: "OPEN",
      },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { status: "ESCALATED" },
    });
    await tx.conversationOutcome.upsert({
      where: { conversationId },
      create: {
        conversationId,
        outcome: "ESCALATED",
        taggedBy: "SYSTEM",
      },
      update: {
        outcome: "ESCALATED",
        taggedBy: "SYSTEM",
        taggedAt: new Date(),
      },
    });
    return created;
  });

  const body = `[${referenceCode}] Escalation (${input.reason_code}, ${urgency})\n\n${input.conversation_summary}${input.suggested_reply ? `\n\nSuggested response: ${input.suggested_reply}` : ""}\n\nReply to this message or include ${referenceCode} with your decision.`;
  let notificationError: string | undefined;
  try {
    const notification = await sendOwnerOperationalMessage({
      text: body,
      purpose: "OWNER_ESCALATION",
    });
    const ownerNotificationMessageId = (
      notification.sent as { messages?: Array<{ id?: string }> }
    ).messages?.[0]?.id;
    if (ownerNotificationMessageId) {
      await prisma.escalation.update({
        where: { id: escalation.id },
        data: { ownerNotificationMessageId },
      });
    }
  } catch (error) {
    notificationError = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({
      msg: "owner_escalation_notification_failed",
      escalationId: escalation.id,
      error: notificationError,
    }));
  }

  await getEscalationReminderQueue().add(
    "remind",
    { escalationId: escalation.id },
    {
      delay: 30 * 60 * 1000,
      jobId: `escalation-reminder-${escalation.id}`,
    },
  );

  return {
    ok: true,
    escalation_id: escalation.id,
    reference_code: referenceCode,
    customer_message:
      "Let me check on that and get right back to you.",
    notification_error: notificationError,
  };
}

export async function resolveEscalationWithOwnerReply(
  escalationIdOrRef: string,
  ownerReply: string,
) {
  const escalation = await prisma.escalation.findFirst({
    where: {
      OR: [
        { id: escalationIdOrRef },
        { referenceCode: escalationIdOrRef.toUpperCase() },
      ],
      status: "OPEN",
    },
  });
  if (!escalation) {
    return { ok: false as const, error: "Open escalation not found" };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.escalation.update({
      where: { id: escalation.id },
      data: {
        status: "RESOLVED",
        ownerReply,
        resolvedAt: new Date(),
      },
    });
    await tx.conversation.update({
      where: { id: escalation.conversationId },
      data: { status: "ACTIVE" },
    });
    return row;
  });

  return { ok: true as const, escalation: updated };
}

export async function findOpenEscalationByReference(text: string, contextMessageId?: string) {
  const match = text.match(/\bREF-\d{4}\b/i);
  if (!match && !contextMessageId) return null;
  return prisma.escalation.findFirst({
    where: {
      OR: [
        ...(match ? [{ referenceCode: match[0].toUpperCase() }] : []),
        ...(contextMessageId ? [{ ownerNotificationMessageId: contextMessageId }] : []),
      ],
      status: "OPEN",
    },
  });
}
