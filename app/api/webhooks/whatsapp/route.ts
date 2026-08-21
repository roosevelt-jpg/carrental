import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCredential } from "@/lib/settings/settings-service";
import { getInboundMessageQueue } from "@/lib/queue/queues";

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

  const messages = extractInboundMessages(payload);
  const queue = getInboundMessageQueue();

  for (const message of messages) {
    const existing = await prisma.message.findUnique({
      where: { metaMessageId: message.id },
    });
    if (existing) {
      continue;
    }
    await queue.add(
      "inbound",
      {
        metaMessageId: message.id,
        from: message.from,
        timestamp: message.timestamp,
        type: message.type,
        text: message.text?.body,
        payload: message,
      },
      { jobId: message.id },
    );
  }

  return NextResponse.json({ ok: true });
}

function verifyMetaSignature(
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

type WhatsAppInbound = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
};

type WhatsAppWebhook = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WhatsAppInbound[];
      };
    }>;
  }>;
};

function extractInboundMessages(payload: WhatsAppWebhook): WhatsAppInbound[] {
  const out: WhatsAppInbound[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        if (message.id && message.from) {
          out.push(message);
        }
      }
    }
  }
  return out;
}
