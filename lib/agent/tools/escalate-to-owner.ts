import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { getCredential } from "@/lib/settings/settings-service";
import { sendTextMessage } from "@/lib/integrations/whatsapp-client";
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

  const ownerPhone = await getCredential("whatsapp", "owner_phone_number");
  if (ownerPhone) {
    const body = `[${referenceCode}] Escalation (${input.reason_code}, ${urgency})\n\n${input.conversation_summary}\n\nReply to this chat including ${referenceCode} with your decision.`;
    await sendTextMessage(ownerPhone, body);
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

export async function findOpenEscalationByReference(text: string) {
  const match = text.match(/\bREF-\d{4}\b/i);
  if (!match) return null;
  return prisma.escalation.findFirst({
    where: {
      referenceCode: match[0].toUpperCase(),
      status: "OPEN",
    },
  });
}
