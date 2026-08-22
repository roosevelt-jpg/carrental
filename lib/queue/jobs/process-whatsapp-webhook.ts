import { prisma } from "@/lib/db";
import { processInboundMessage, type InboundMessageJob } from "@/lib/queue/jobs/process-inbound-message";
import { decryptPii } from "@/lib/privacy/pii";

type DeliveryPayload = { id: string; status: string; errors?: Array<{ code?: number }> };
type TemplatePayload = { event: string; message_template_id?: string; message_template_name?: string; reason?: string };

export async function processWhatsAppWebhookEvent(eventId: string) {
  const event = await prisma.whatsAppWebhookEvent.findUnique({ where: { eventId } });
  if (!event || event.status === "COMPLETE") return { skipped: true };
  try {
    const payload = JSON.parse(decryptPii(String(event.payload)) ?? "null") as unknown;
    if (event.kind === "INBOUND_MESSAGE") await processInboundMessage(payload as InboundMessageJob);
    if (event.kind === "DELIVERY_STATUS") await processDelivery(payload as DeliveryPayload);
    if (event.kind === "TEMPLATE_STATUS") await processTemplate(payload as TemplatePayload);
    await prisma.whatsAppWebhookEvent.update({ where: { id: event.id }, data: { status: "COMPLETE", processedAt: new Date(), error: null } });
    return { processed: true };
  } catch (error) {
    await prisma.whatsAppWebhookEvent.update({ where: { id: event.id }, data: { error: error instanceof Error ? error.message.slice(0, 1000) : "Unknown processing error" } });
    throw error;
  }
}

async function processDelivery(status: DeliveryPayload) {
  const deliveryStatus = mapDeliveryStatus(status.status); if (!deliveryStatus) return;
  const message = await prisma.message.findUnique({ where: { metaMessageId: status.id }, select: { id: true, deliveryStatus: true } });
  if (message && shouldAdvanceDeliveryStatus(message.deliveryStatus, deliveryStatus)) await prisma.message.update({ where: { id: message.id }, data: { deliveryStatus, statusUpdatedAt: new Date(), failureCode: status.errors?.[0]?.code?.toString() ?? null } });
}

async function processTemplate(update: TemplatePayload) {
  const status = update.event === "APPROVED" ? "APPROVED" : update.event === "REJECTED" || update.event === "DISABLED" ? "REJECTED" : "SUBMITTED";
  await prisma.messageTemplate.updateMany({ where: { OR: [...(update.message_template_id ? [{ metaTemplateId: update.message_template_id }] : []), ...(update.message_template_name ? [{ metaTemplateName: update.message_template_name }] : [])] }, data: { status, rejectionReason: status === "REJECTED" ? update.reason ?? update.event : null } });
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
