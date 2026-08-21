import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCredential } from "@/lib/settings/settings-service";
import { getInboundMessageQueue } from "@/lib/queue/queues";
import { captureException } from "@/lib/observability/sentry";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const expected = await getCredential("whatsapp", "webhook_verify_token");

  if (mode === "subscribe" && token && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const appSecret = await getCredential("whatsapp", "app_secret");
  const signature = request.headers.get("x-hub-signature-256");

  if (!appSecret || !verifyMetaSignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: WhatsAppWebhook;
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, statuses, templateUpdates } = extractWebhookData(payload);
  const queue = getInboundMessageQueue();

  try {
    for (const message of messages) {
    await queue.add(
      "inbound",
      {
        metaMessageId: message.id,
        from: message.from,
        timestamp: message.timestamp,
        type: message.type,
        text:
          message.text?.body ??
          (message.reaction?.emoji ? `[Customer reacted ${message.reaction.emoji}]` : undefined),
        contextMessageId: message.context?.id,
        payload: message,
      },
      { jobId: message.id },
    );
    }

    for (const status of statuses) {
    const deliveryStatus = mapDeliveryStatus(status.status);
    if (!deliveryStatus) continue;
    const message = await prisma.message.findUnique({
      where: { metaMessageId: status.id },
      select: { id: true, deliveryStatus: true },
    });
    if (message && shouldAdvanceDeliveryStatus(message.deliveryStatus, deliveryStatus)) {
      await prisma.message.update({
        where: { id: message.id },
        data: {
          deliveryStatus,
          statusUpdatedAt: new Date(),
          failureCode: status.errors?.[0]?.code?.toString() ?? null,
        },
      });
    }

    for (const update of templateUpdates) {
      const status =
        update.event === "APPROVED"
          ? "APPROVED"
          : update.event === "REJECTED" || update.event === "DISABLED"
            ? "REJECTED"
            : "SUBMITTED";
      await prisma.messageTemplate.updateMany({
        where: {
          OR: [
            ...(update.message_template_id ? [{ metaTemplateId: update.message_template_id }] : []),
            ...(update.message_template_name ? [{ metaTemplateName: update.message_template_name }] : []),
          ],
        },
        data: {
          status,
          rejectionReason: status === "REJECTED" ? update.reason ?? update.event : null,
        },
      });
    }
    }
  } catch (error) {
    captureException(error, { webhook: "whatsapp" });
    return NextResponse.json({ error: "Webhook enqueue failed" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}

export function verifyMetaSignature(
  rawBody: string,
  header: string | null,
  appSecret: string,
): boolean {
  if (!header?.startsWith("sha256=")) {
    return false;
  }
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const received = header.slice("sha256=".length);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export type WhatsAppInbound = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  reaction?: { emoji?: string; message_id?: string };
  context?: { id?: string; from?: string };
};

export type WhatsAppStatus = {
  id: string;
  status: string;
  errors?: Array<{ code?: number }>;
};

export type WhatsAppWebhook = {
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        messages?: WhatsAppInbound[];
        statuses?: WhatsAppStatus[];
        event?: string;
        message_template_id?: string;
        message_template_name?: string;
        reason?: string;
      };
    }>;
  }>;
};

export function extractWebhookData(payload: WhatsAppWebhook) {
  const messages: WhatsAppInbound[] = [];
  const statuses: WhatsAppStatus[] = [];
  const templateUpdates: Array<{
    event: string;
    message_template_id?: string;
    message_template_name?: string;
    reason?: string;
  }> = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        if (message.id && message.from) {
          messages.push(message);
        }
      }
      statuses.push(...(change.value?.statuses ?? []).filter((status) => status.id));
      if (change.field === "message_template_status_update" && change.value?.event) {
        templateUpdates.push({
          event: change.value.event,
          message_template_id: change.value.message_template_id,
          message_template_name: change.value.message_template_name,
          reason: change.value.reason,
        });
      }
    }
  }
  return { messages, statuses, templateUpdates };
}

export function mapDeliveryStatus(status: string) {
  const statuses = {
    sent: "SENT",
    delivered: "DELIVERED",
    read: "READ",
    failed: "FAILED",
  } as const;
  return statuses[status as keyof typeof statuses];
}

export function shouldAdvanceDeliveryStatus(current: string, next: string) {
  if (next === "FAILED") return current !== "READ";
  const rank: Record<string, number> = {
    RECEIVED: 0,
    ACCEPTED: 1,
    SENT: 2,
    DELIVERED: 3,
    READ: 4,
    FAILED: 5,
  };
  return (rank[next] ?? -1) > (rank[current] ?? -1);
}
