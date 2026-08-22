import { prisma } from "@/lib/db";
import { getCredential } from "@/lib/settings/settings-service";
import { runOrchestrator } from "@/lib/agent/orchestrator";
import {
  findOpenEscalationByReference,
} from "@/lib/agent/escalation";
import {
  markMessageRead,
  sendReaction,
  downloadWhatsAppMedia,
} from "@/lib/integrations/whatsapp-client";
import { deliverAgentReply } from "@/lib/agent/deliver-reply";
import { resolveOwnerDecision } from "@/lib/agent/owner-resolution";
import type { AgentReply } from "@/lib/agent/orchestrator";
import { captureException } from "@/lib/observability/sentry";
import { selectContextualReaction } from "@/lib/agent/contextual-reaction";
import { decryptPii, encryptPii, piiLookupHash } from "@/lib/privacy/pii";
import { getCmsSettings } from "@/lib/cms/content";
import { getRedisConnection } from "@/lib/queue/connection";
import { sleep } from "@/lib/agent/pacing";
import { uploadInboundMessageMedia } from "@/lib/storage/object-storage";

export type InboundMessageJob = {
  metaMessageId: string;
  from: string;
  timestamp: string;
  type: string;
  text?: string;
  contextMessageId?: string;
  media?: {
    id: string;
    mediaType: string;
    mimeType?: string;
    sha256?: string;
    caption?: string;
    fileName?: string;
  };
  payload: unknown;
};

const MEDIA_LIMITS: Record<string, number> = {
  image: 10_000_000,
  sticker: 2_000_000,
  video: 25_000_000,
  audio: 16_000_000,
  document: 25_000_000,
};

export async function processInboundMessage(data: InboundMessageJob) {
  const startedAt = Date.now();
  const typingStartedAt = Date.now();
  const existing = await prisma.message.findUnique({
    where: { metaMessageId: data.metaMessageId },
    include: { attachments: true },
  });
  const completed = existing
    ? await prisma.processingMetric.findUnique({
      where: { inboundMessageId: data.metaMessageId },
      select: { id: true },
    })
    : null;
  if (existing && completed && (!data.media || existing.attachments.some((item) => item.status === "READY"))) {
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
  const whatsappIdHash = piiLookupHash(data.from);
  const customer = await prisma.customer.upsert({
    where: { whatsappIdHash },
    create: {
      whatsappId: encryptPii(data.from)!,
      whatsappIdHash,
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

  let storedMessageId = existing?.id;
  if (!storedMessageId) {
    const createdMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "IN",
        type: data.type,
        content: encryptPii(data.text),
        metaMessageId: data.metaMessageId,
      },
    });
    storedMessageId = createdMessage.id;
  }
  if (data.media && (!existing || !existing.attachments.some((item) => item.status === "READY"))) {
    await persistInboundAttachment(storedMessageId, data);
  }
  if (existing && completed) {
    return { recoveredMedia: true, messageId: existing.id };
  }
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  try {
    await markMessageRead(data.metaMessageId);
    const reaction = selectContextualReaction({ type: data.type, text: data.text });
    if (reaction) {
      await sendReaction(data.from, data.metaMessageId, reaction);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "whatsapp_ack_failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  // Give short message bursts a moment to settle. Earlier messages are retained in
  // the conversation, but only the newest one triggers a reply.
  await sleep(350);
  const latestInboundId = await getRedisConnection().get(
    `latest-inbound:${piiLookupHash(data.from)}`,
  );
  if (latestInboundId && latestInboundId !== data.metaMessageId) {
    await prisma.processingMetric.upsert({
      where: { inboundMessageId: data.metaMessageId },
      create: {
        conversationId: conversation.id,
        inboundMessageId: data.metaMessageId,
        latencyMs: Date.now() - startedAt,
        toolRounds: 0,
        escalated: false,
        succeeded: true,
        errorCode: "coalesced_newer_message",
      },
      update: {},
    });
    return { skipped: true, reason: "coalesced_newer_message" };
  }

  let reply = existing?.agentReply ? JSON.parse(decryptPii(String(existing.agentReply)) ?? "null") as AgentReply | null : null;
  let orchestrationSucceeded = true;
  if (!reply) {
    const greeting = data.text && isSimpleGreeting(data.text)
      ? (await getCmsSettings()).agentGreeting.trim()
      : "";
    if (greeting) {
      reply = {
        texts: [greeting],
        mediaIds: [],
        escalated: false,
        paymentLinks: [],
        toolRounds: 0,
      };
    } else if (data.type !== "text" && data.type !== "image" && data.type !== "reaction") {
      const { escalateToOwner } = await import("@/lib/agent/tools/escalate-to-owner");
      const escalated = await escalateToOwner(conversation.id, {
        reason_code: "out_of_scope",
        conversation_summary: `Customer sent a ${data.type} attachment. It is stored for owner review, but the AI cannot safely interpret this media type.`,
        urgency: "normal",
      });
      reply = {
        texts: [escalated.customer_message ?? "I’ve shared that attachment with the team for review."],
        mediaIds: [],
        escalated: true,
        paymentLinks: [],
        toolRounds: 0,
      };
    } else try {
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
      data: { agentReply: encryptPii(JSON.stringify(reply))! },
    });
  }

  const delivered = await deliverAgentReply({
    conversationId: conversation.id,
    to: data.from,
    reply,
    typingMessageId: data.metaMessageId,
    sourceMessageId: data.metaMessageId,
    typingStartedAt,
  });

  if (!existing && data.text) {
    const priorInbound = await prisma.message.findMany({ where: { conversationId: conversation.id, direction: "IN", metaMessageId: { not: data.metaMessageId } }, orderBy: { sentAt: "desc" }, take: 3, select: { content: true } });
    const nextCount = nextMisunderstandingCount(data.text, priorInbound.map((row) => decryptPii(row.content) ?? ""), conversation.misunderstandingCount);
    conversation = await prisma.conversation.update({ where: { id: conversation.id }, data: { misunderstandingCount: nextCount } });
  }

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

async function persistInboundAttachment(messageId: string, data: InboundMessageJob) {
  if (!data.media) return;
  await prisma.messageAttachment.deleteMany({ where: { messageId, status: { not: "READY" } } });
  const maxBytes = MEDIA_LIMITS[data.media.mediaType];
  if (!maxBytes) {
    await prisma.messageAttachment.create({
      data: {
        messageId,
        mediaType: data.media.mediaType,
        metaMediaId: encryptPii(data.media.id),
        mimeType: data.media.mimeType,
        fileName: encryptPii(data.media.fileName),
        sha256: data.media.sha256,
        status: "UNSUPPORTED",
        errorMessage: encryptPii("Unsupported WhatsApp attachment type"),
      },
    });
    return;
  }
  try {
    const downloaded = await downloadWhatsAppMedia(data.media.id, maxBytes);
    if (!isAllowedInboundMime(data.media.mediaType, downloaded.mimeType)) {
      throw new Error(`Unsupported ${data.media.mediaType} MIME type`);
    }
    const stored = await uploadInboundMessageMedia({
      metaMessageId: data.metaMessageId,
      bytes: downloaded.bytes,
      contentType: downloaded.mimeType,
      originalName: data.media.fileName || `attachment-${data.metaMessageId}`,
    });
    await prisma.messageAttachment.create({
      data: {
        messageId,
        mediaType: data.media.mediaType,
        metaMediaId: encryptPii(data.media.id),
        storageKey: stored.key,
        storageUrl: stored.url,
        mimeType: downloaded.mimeType,
        fileName: encryptPii(data.media.fileName),
        fileSize: downloaded.fileSize,
        sha256: downloaded.sha256 || data.media.sha256,
      },
    });
  } catch (error) {
    await prisma.messageAttachment.create({
      data: {
        messageId,
        mediaType: data.media.mediaType,
        metaMediaId: encryptPii(data.media.id),
        mimeType: data.media.mimeType,
        fileName: encryptPii(data.media.fileName),
        sha256: data.media.sha256,
        status: "FAILED",
        errorMessage: encryptPii(error instanceof Error ? error.message.slice(0, 500) : "Media download failed"),
      },
    });
    console.error(JSON.stringify({
      msg: "inbound_media_download_failed",
      metaMessageId: data.metaMessageId,
      mediaType: data.media.mediaType,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

export function isAllowedInboundMime(mediaType: string, mimeType: string) {
  const normalized = mimeType.split(";", 1)[0].trim().toLowerCase();
  const allowed: Record<string, Set<string>> = {
    image: new Set(["image/jpeg", "image/png", "image/webp"]),
    sticker: new Set(["image/webp"]),
    video: new Set(["video/mp4", "video/3gpp", "video/quicktime"]),
    audio: new Set(["audio/aac", "audio/amr", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/opus"]),
    document: new Set([
      "application/pdf", "text/plain", "text/csv",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]),
  };
  return allowed[mediaType]?.has(normalized) ?? false;
}

export function isSimpleGreeting(value: string) {
  return /^\s*(?:hi|hello|hey|greetings|good\s+(?:morning|afternoon|evening))(?:\s+there)?[!.?\s]*$/i.test(value);
}

function normalizeIntent(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\b(please|thanks|thank you|hi|hello)\b/g, " ").replace(/\s+/g, " ").trim();
}

export function nextMisunderstandingCount(currentText: string, priorInbound: string[], currentCount: number) {
  const current = normalizeIntent(currentText);
  const explicitlyMisunderstood = /\b(you (still )?do not understand|you don't understand|not what i (asked|meant)|already (said|asked))\b/i.test(currentText);
  const repeated = Boolean(current) && priorInbound.some((value) => normalizeIntent(value) === current);
  return explicitlyMisunderstood || repeated ? currentCount + 1 : 0;
}
