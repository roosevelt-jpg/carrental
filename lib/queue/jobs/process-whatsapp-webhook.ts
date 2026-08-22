import { prisma } from "@/lib/db";
import { processInboundMessage, type InboundMessageJob } from "@/lib/queue/jobs/process-inbound-message";
import { decryptPii } from "@/lib/privacy/pii";
import { piiLookupHash } from "@/lib/privacy/pii";
import { getInboundMessageQueue } from "@/lib/queue/queues";
import { getRedisConnection } from "@/lib/queue/connection";
import { createHash } from "node:crypto";

type DeliveryPayload = { id: string; status: string; errors?: Array<{ code?: number }> };
type TemplatePayload = { event: string; message_template_id?: string | number; message_template_name?: string; reason?: string };

export async function processWhatsAppWebhookEvent(eventId: string) {
  const event = await prisma.whatsAppWebhookEvent.findUnique({ where: { eventId } });
  if (!event || event.status === "COMPLETE") return { skipped: true };
  try {
    const payload = JSON.parse(decryptPii(String(event.payload)) ?? "null") as unknown;
    if (event.kind === "INBOUND_MESSAGE") {
      await enqueueInbound(event.eventId, payload as InboundMessageJob);
    }
    if (event.kind === "DELIVERY_STATUS") await processDelivery(payload as DeliveryPayload);
    if (event.kind === "TEMPLATE_STATUS") await processTemplate(payload as TemplatePayload);
    await prisma.whatsAppWebhookEvent.update({ where: { id: event.id }, data: { status: "COMPLETE", processedAt: new Date(), error: null } });
    return { processed: true };
  } catch (error) {
    await prisma.whatsAppWebhookEvent.update({ where: { id: event.id }, data: { error: error instanceof Error ? error.message.slice(0, 1000) : "Unknown processing error" } });
    throw error;
  }
}

async function enqueueInbound(eventId: string, payload: InboundMessageJob) {
  const senderHash = piiLookupHash(payload.from);
  await getRedisConnection().set(
    `latest-inbound:${senderHash}`,
    payload.metaMessageId,
    "EX",
    300,
  );
  const jobId = `in-${createHash("sha256").update(payload.metaMessageId).digest("hex")}`;
  await getInboundMessageQueue().add("process", { eventId, senderHash }, { jobId });
}

export async function processInboundWebhookEvent(eventId: string) {
  const event = await prisma.whatsAppWebhookEvent.findUnique({
    where: { eventId },
    select: { kind: true, payload: true },
  });
  if (!event || event.kind !== "INBOUND_MESSAGE") {
    return { skipped: true, reason: "inbound_event_not_found" };
  }
  const payload = hydrateInboundMedia(JSON.parse(
    decryptPii(String(event.payload)) ?? "null",
  ) as InboundMessageJob);
  return processInboundMessage(payload);
}

export async function recoverRecentInboundMedia() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const messages = await prisma.message.findMany({
    where: {
      direction: "IN",
      type: { in: ["image", "video", "audio", "document", "sticker"] },
      metaMessageId: { not: null },
      sentAt: { gte: since },
      attachments: { none: { status: "READY" } },
    },
    select: { metaMessageId: true },
    take: 100,
  });
  let enqueued = 0;
  for (const message of messages) {
    if (!message.metaMessageId) continue;
    const event = await prisma.whatsAppWebhookEvent.findUnique({
      where: { eventId: message.metaMessageId },
      select: { eventId: true, payload: true },
    });
    if (!event) continue;
    const parsed = JSON.parse(decryptPii(String(event.payload)) ?? "null") as InboundMessageJob | null;
    const payload = parsed ? hydrateInboundMedia(parsed) : null;
    if (!payload?.media?.id || !payload.from) continue;
    const senderHash = piiLookupHash(payload.from);
    await getInboundMessageQueue().add(
      "recover-media",
      { eventId: event.eventId, senderHash },
      { jobId: `media-recovery-${createHash("sha256").update(event.eventId).digest("hex")}-${Date.now()}` },
    );
    enqueued += 1;
  }
  return { enqueued };
}

function hydrateInboundMedia(payload: InboundMessageJob): InboundMessageJob {
  if (payload.media?.id) return payload;
  const raw = payload.payload as Record<string, unknown> | null;
  if (!raw) return payload;
  const candidate = (raw.image ?? raw.video ?? raw.audio ?? raw.document ?? raw.sticker) as Record<string, unknown> | undefined;
  if (!candidate || typeof candidate.id !== "string") return payload;
  return {
    ...payload,
    text: payload.text ?? (typeof candidate.caption === "string" ? candidate.caption : undefined),
    media: {
      id: candidate.id,
      mediaType: payload.type,
      mimeType: typeof candidate.mime_type === "string" ? candidate.mime_type : undefined,
      sha256: typeof candidate.sha256 === "string" ? candidate.sha256 : undefined,
      caption: typeof candidate.caption === "string" ? candidate.caption : undefined,
      fileName: typeof candidate.filename === "string" ? candidate.filename : undefined,
    },
  };
}

async function processDelivery(status: DeliveryPayload) {
  const deliveryStatus = mapDeliveryStatus(status.status); if (!deliveryStatus) return;
  const message = await prisma.message.findUnique({ where: { metaMessageId: status.id }, select: { id: true, deliveryStatus: true } });
  if (message && shouldAdvanceDeliveryStatus(message.deliveryStatus, deliveryStatus)) await prisma.message.update({ where: { id: message.id }, data: { deliveryStatus, statusUpdatedAt: new Date(), failureCode: status.errors?.[0]?.code?.toString() ?? null } });
}

async function processTemplate(update: TemplatePayload) {
  const status = update.event === "APPROVED" ? "APPROVED" : update.event === "REJECTED" || update.event === "DISABLED" ? "REJECTED" : "SUBMITTED";
  const metaTemplateId = update.message_template_id == null
    ? null
    : String(update.message_template_id);
  await prisma.messageTemplate.updateMany({ where: { OR: [...(metaTemplateId ? [{ metaTemplateId }] : []), ...(update.message_template_name ? [{ metaTemplateName: update.message_template_name }] : [])] }, data: { status, rejectionReason: status === "REJECTED" ? update.reason ?? update.event : null } });
}

function mapDeliveryStatus(status: string) {
  const statuses = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" } as const;
  return statuses[status as keyof typeof statuses];
}

function shouldAdvanceDeliveryStatus(current: string, next: string) {
  if (next === "FAILED") return current !== "READ";
  const rank: Record<string, number> = { RECEIVED: 0, ACCEPTED: 1, SENT: 2, DELIVERED: 3, READ: 4, FAILED: 5 };
  return (rank[next] ?? -1) > (rank[current] ?? -1);
}
