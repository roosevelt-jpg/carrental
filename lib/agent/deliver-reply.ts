import type { MessageTemplatePurpose } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AgentReply } from "@/lib/agent/orchestrator";
import { betweenMessageDelayMs, remainingTypingDelayMs, sleep } from "@/lib/agent/pacing";
import {
  markMessageRead,
  sendCtaUrlMessage,
  sendImageByMediaId,
  isExpiredMediaError,
} from "@/lib/integrations/whatsapp-client";
import { processMediaReupload } from "@/lib/queue/jobs/media-reupload";
import {
  isWithinCustomerServiceWindow,
  sendCustomerText,
} from "@/lib/integrations/whatsapp-messaging";
import { getCmsSettings, prepareNotification } from "@/lib/cms/content";
import { encryptPii, piiLookupHash } from "@/lib/privacy/pii";

function sentMessageId(result: unknown) {
  return (result as { messages?: Array<{ id?: string }> }).messages?.[0]?.id ?? null;
}

async function recordOutbound(params: {
  conversationId: string;
  type: string;
  content?: string;
  mediaIds?: string[];
  result: unknown;
  sourceMessageId: string;
  sequence: number;
}) {
  await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      direction: "OUT",
      type: params.type,
      content: encryptPii(params.content),
      mediaIds: params.mediaIds ?? [],
      metaMessageId: sentMessageId(params.result),
      deliveryStatus: "ACCEPTED",
      sourceMessageId: params.sourceMessageId,
      sequence: params.sequence,
    },
  });
}

export async function deliverAgentReply(params: {
  conversationId: string;
  to: string;
  reply: AgentReply;
  typingMessageId?: string;
  outsideWindowTemplate?: MessageTemplatePurpose;
  sourceMessageId: string;
  typingStartedAt?: number;
}) {
  const customer = await prisma.customer.findUnique({
    where: { whatsappIdHash: piiLookupHash(params.to) },
    select: { lastInboundAt: true },
  });
  const inWindow = isWithinCustomerServiceWindow(customer?.lastInboundAt);
  let sentTexts = 0;
  let sentPhotos = 0;
  let sequence = 0;

  const alreadyDelivered = (currentSequence: number) =>
    prisma.message.findUnique({
      where: {
        sourceMessageId_sequence: {
          sourceMessageId: params.sourceMessageId,
          sequence: currentSequence,
        },
      },
      select: { id: true },
    });

  const sendText = async (text: string) => {
    const currentSequence = sequence++;
    if (await alreadyDelivered(currentSequence)) {
      sentTexts += 1;
      return;
    }
    if (params.typingMessageId && inWindow) {
      await markMessageRead(params.typingMessageId);
      const delay = remainingTypingDelayMs(
        text,
        params.typingStartedAt ?? Date.now(),
      );
      if (delay > 0) await sleep(delay);
    }
    const notification = !inWindow && params.outsideWindowTemplate
      ? await prepareNotification({
          purpose: params.outsideWindowTemplate,
          values: {
            message: text,
            business_name: (await getCmsSettings()).businessName,
          },
          fallback: text,
        })
      : { text, parameters: [text] };
    const result = await sendCustomerText({
      to: params.to,
      text: notification.text,
      templatePurpose: inWindow ? undefined : params.outsideWindowTemplate,
      templateParameters: notification.parameters,
    });
    await recordOutbound({
      conversationId: params.conversationId,
      type: inWindow ? "text" : "template",
      content: notification.text,
      result,
      sourceMessageId: params.sourceMessageId,
      sequence: currentSequence,
    });
    sentTexts += 1;
  };

  if (params.reply.texts[0]) {
    await sendText(params.reply.texts[0]);
  }

  if (params.reply.mediaIds.length > 0 && !inWindow) {
    console.warn(JSON.stringify({
      msg: "media_send_blocked_outside_customer_service_window",
      conversationId: params.conversationId,
      count: params.reply.mediaIds.length,
    }));
  }
  for (const mediaId of inWindow ? params.reply.mediaIds : []) {
    const currentSequence = sequence++;
    if (await alreadyDelivered(currentSequence)) {
      sentPhotos += 1;
      continue;
    }
    await sleep(1000);
    let result;
    try {
      result = await sendImageByMediaId(params.to, mediaId);
    } catch (error) {
      if (!isExpiredMediaError(error)) throw error;
      const vehicle = await prisma.vehicle.findFirst({ where: { mediaIds: { has: mediaId } }, select: { id: true, mediaIds: true } });
      if (!vehicle) throw error;
      const refreshed = await processMediaReupload({ vehicleId: vehicle.id });
      const replacement = Array.isArray(refreshed.mediaIds) ? refreshed.mediaIds[vehicle.mediaIds.indexOf(mediaId)] : undefined;
      if (typeof replacement !== "string") throw error;
      result = await sendImageByMediaId(params.to, replacement);
    }
    await recordOutbound({
      conversationId: params.conversationId,
      type: "image",
      mediaIds: [mediaId],
      result,
      sourceMessageId: params.sourceMessageId,
      sequence: currentSequence,
    });
    sentPhotos += 1;
  }

  for (const text of params.reply.texts.slice(1)) {
    await sleep(betweenMessageDelayMs());
    await sendText(text);
  }

  for (const link of params.reply.paymentLinks) {
    const currentSequence = sequence++;
    if (await alreadyDelivered(currentSequence)) continue;
    const paymentSummary = `Secure payment for ${link.amount} ${link.currency}.`;
    const paymentNotification = await prepareNotification({
      purpose: "PAYMENT_REMINDER",
      values: { payment_summary: paymentSummary, payment_url: link.url },
      fallback: `${paymentSummary}\n${link.url}`,
    });
    const bodyText = paymentNotification.text;
    await sleep(betweenMessageDelayMs());
    if (!inWindow) {
      const result = await sendCustomerText({
        to: params.to,
        text: paymentNotification.text,
        templatePurpose: "PAYMENT_REMINDER",
        templateParameters: paymentNotification.parameters,
      });
      await recordOutbound({
        conversationId: params.conversationId,
        type: "template",
        content: paymentNotification.text,
        result,
        sourceMessageId: params.sourceMessageId,
        sequence: currentSequence,
      });
      continue;
    }
    try {
      const result = await sendCtaUrlMessage({
        to: params.to,
        bodyText,
        displayText: "Pay now",
        url: link.url,
      });
      await recordOutbound({
        conversationId: params.conversationId,
        type: "interactive",
        content: `${bodyText}\n${link.url}`,
        result,
        sourceMessageId: params.sourceMessageId,
        sequence: currentSequence,
      });
    } catch (error) {
      const result = await sendCustomerText({ to: params.to, text: `${bodyText}\n${link.url}` });
      await recordOutbound({
        conversationId: params.conversationId,
        type: "text",
        content: `${bodyText}\n${link.url}`,
        result,
        sourceMessageId: params.sourceMessageId,
        sequence: currentSequence,
      });
      console.error(JSON.stringify({
        msg: "cta_send_failed_fallback_text",
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  return { sentTexts, sentPhotos, paymentLinks: params.reply.paymentLinks.length };
}
