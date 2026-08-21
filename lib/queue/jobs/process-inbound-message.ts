import { prisma } from "@/lib/db";
import { getCredential } from "@/lib/settings/settings-service";
import { runOrchestrator } from "@/lib/agent/orchestrator";
import {
  betweenMessageDelayMs,
  sleep,
  typingDelayMs,
} from "@/lib/agent/pacing";
import {
  findOpenEscalationByReference,
  resolveEscalationWithOwnerReply,
} from "@/lib/agent/escalation";
import {
  markMessageRead,
  sendCtaUrlMessage,
  sendImageByMediaId,
  sendReaction,
  sendTextMessage,
} from "@/lib/integrations/whatsapp-client";

export type InboundMessageJob = {
  metaMessageId: string;
  from: string;
  timestamp: string;
  type: string;
  text?: string;
  payload: unknown;
};

export async function processInboundMessage(data: InboundMessageJob) {
  const existing = await prisma.message.findUnique({
    where: { metaMessageId: data.metaMessageId },
  });
  if (existing) {
    return { skipped: true, reason: "duplicate" };
  }

  const ownerPhone = await getCredential("whatsapp", "owner_phone_number");
  const normalizedFrom = data.from.replace(/\D/g, "");
  const normalizedOwner = ownerPhone?.replace(/\D/g, "") ?? "";

  if (
    normalizedOwner &&
    normalizedFrom === normalizedOwner &&
    data.text
  ) {
    const open = await findOpenEscalationByReference(data.text);
    if (open) {
      const cleaned =
        data.text.replace(/\bREF-\d{4}\b/gi, "").trim() || data.text;
      await resolveEscalationWithOwnerReply(open.id, cleaned);
      const conversation = await prisma.conversation.findUnique({
        where: { id: open.conversationId },
        include: { customer: true },
      });
      if (conversation) {
        await sendTextMessage(conversation.customer.whatsappId, cleaned);
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: "OUT",
            type: "text",
            content: cleaned,
          },
        });
      }
      return { ownerEscalationResolved: true, escalationId: open.id };
    }
  }

  const customer = await prisma.customer.upsert({
    where: { whatsappId: data.from },
    create: { whatsappId: data.from },
    update: {},
  });

  let conversation = await prisma.conversation.findFirst({
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

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "IN",
      type: data.type,
      content: data.text ?? null,
      metaMessageId: data.metaMessageId,
    },
  });
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

  let reply;
  try {
    reply = await runOrchestrator(conversation.id);
  } catch (error) {
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
    };
  }

  for (const mediaId of reply.mediaIds) {
    try {
      await sleep(1000);
      const sent = await sendImageByMediaId(data.from, mediaId);
      const metaId =
        (sent as { messages?: Array<{ id?: string }> }).messages?.[0]?.id ?? null;
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: "OUT",
          type: "image",
          mediaIds: [mediaId],
          metaMessageId: metaId,
        },
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "photo_send_failed",
          mediaId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  for (let i = 0; i < reply.texts.length; i++) {
    const text = reply.texts[i];
    await sleep(typingDelayMs(text));
    if (i > 0) {
      await sleep(betweenMessageDelayMs());
    }
    const sent = await sendTextMessage(data.from, text);
    const metaId =
      (sent as { messages?: Array<{ id?: string }> }).messages?.[0]?.id ?? null;
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "OUT",
        type: "text",
        content: text,
        metaMessageId: metaId,
      },
    });
  }

  for (const link of reply.paymentLinks) {
    await sleep(betweenMessageDelayMs());
    const bodyText = `Secure payment for ${link.amount} ${link.currency}. Tap below to pay.`;
    try {
      const sent = await sendCtaUrlMessage({
        to: data.from,
        bodyText,
        displayText: "Pay now",
        url: link.url,
      });
      const metaId =
        (sent as { messages?: Array<{ id?: string }> }).messages?.[0]?.id ?? null;
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: "OUT",
          type: "interactive",
          content: `${bodyText}\n${link.url}`,
          metaMessageId: metaId,
        },
      });
    } catch (error) {
      // Fallback to plain URL if interactive CTA is unavailable for the WABA.
      const sent = await sendTextMessage(data.from, `${bodyText}\n${link.url}`);
      const metaId =
        (sent as { messages?: Array<{ id?: string }> }).messages?.[0]?.id ?? null;
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: "OUT",
          type: "text",
          content: `${bodyText}\n${link.url}`,
          metaMessageId: metaId,
        },
      });
      console.error(
        JSON.stringify({
          msg: "cta_send_failed_fallback_text",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  return {
    conversationId: conversation.id,
    replies: reply.texts.length,
    photos: reply.mediaIds.length,
    paymentLinks: reply.paymentLinks.length,
    escalated: reply.escalated,
  };
}
