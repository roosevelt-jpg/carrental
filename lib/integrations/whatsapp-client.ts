import { getCredential } from "@/lib/settings/settings-service";
import { WHATSAPP_GRAPH_VERSION } from "@/lib/integrations/constants";
import { prisma } from "@/lib/db";

async function recordMetaHealth(response: Response) {
  const retryAfterSecs = Number(response.headers.get("retry-after")) || null;
  const usageHeaders = [response.headers.get("x-app-usage"), response.headers.get("x-business-use-case-usage")].filter(Boolean);
  const percentages = usageHeaders.flatMap((header) => [...String(header).matchAll(/"(?:call_count|total_cputime|total_time)"\s*:\s*(\d+)/g)].map((match) => Number(match[1])));
  await prisma.providerHealth.upsert({ where: { id: "meta" }, create: { id: "meta", lastStatusCode: response.status, lastSuccessAt: response.ok ? new Date() : null, rateLimitedAt: response.status === 429 ? new Date() : null, retryAfterSecs, usagePercent: percentages.length ? Math.max(...percentages) : null }, update: { lastStatusCode: response.status, ...(response.ok ? { lastSuccessAt: new Date() } : {}), ...(response.status === 429 ? { rateLimitedAt: new Date(), retryAfterSecs } : {}), ...(percentages.length ? { usagePercent: Math.max(...percentages) } : {}) } });
}

export class MetaApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: number, public readonly subcode?: number) { super(message); this.name = "MetaApiError"; }
}

export function isExpiredMediaError(error: unknown) {
  return error instanceof MetaApiError && (error.code === 100 || error.code === 131052 || error.code === 131053 || error.subcode === 33);
}

async function requiredWhatsAppCreds() {
  const [accessToken, phoneNumberId] = await Promise.all([
    getCredential("whatsapp", "access_token"),
    getCredential("whatsapp", "phone_number_id"),
  ]);
  if (!accessToken || !phoneNumberId) {
    throw new Error("WhatsApp is not configured");
  }
  return { accessToken, phoneNumberId };
}

export async function graphGet(path: string) {
  const { accessToken } = await requiredWhatsAppCreds();
  const url = path.startsWith("http")
    ? path
    : `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await recordMetaHealth(res);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      (body as { error?: { message?: string } }).error?.message ??
        `WhatsApp Graph GET ${res.status}`,
    );
  }
  return body;
}

export async function graphPost(path: string, payload: unknown) {
  const { accessToken, phoneNumberId } = await requiredWhatsAppCreds();
  const resolvedPath = path.replace(/^\//, "") || `${phoneNumberId}/messages`;
  const url = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${resolvedPath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  await recordMetaHealth(res);
  const body = await res.json();
  if (!res.ok) {
    const meta = (body as { error?: { message?: string; code?: number; error_subcode?: number } }).error;
    throw new MetaApiError(meta?.message ?? `WhatsApp Graph POST ${res.status}`, res.status, meta?.code, meta?.error_subcode);
  }
  return body;
}

export async function markMessageRead(messageId: string) {
  const { phoneNumberId } = await requiredWhatsAppCreds();
  return graphPost(`${phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
    typing_indicator: { type: "text" },
  });
}

export async function sendTypingOn(to: string) {
  // Cloud API typing is tied to mark-as-read + typing_indicator on recent versions.
  // Kept as a no-op-safe helper when only a recipient is known.
  void to;
}

export async function sendTextMessage(to: string, body: string) {
  const { phoneNumberId } = await requiredWhatsAppCreds();
  return graphPost(`${phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: true, body },
  });
}

export async function sendReaction(to: string, messageId: string, emoji = "👍") {
  const { phoneNumberId } = await requiredWhatsAppCreds();
  return graphPost(`${phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "reaction",
    reaction: { message_id: messageId, emoji },
  });
}

export async function sendImageByMediaId(to: string, mediaId: string, caption?: string) {
  const { phoneNumberId } = await requiredWhatsAppCreds();
  return graphPost(`${phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "image",
    image: {
      id: mediaId,
      ...(caption ? { caption } : {}),
    },
  });
}

export async function uploadMediaFromUrl(fileUrl: string, mimeType: string) {
  const { accessToken, phoneNumberId } = await requiredWhatsAppCreds();
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) {
    throw new Error(`Failed to download media from storage: ${fileRes.status}`);
  }
  const blob = await fileRes.blob();
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  form.append("file", blob, "vehicle.jpg");

  const res = await fetch(
    `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${phoneNumberId}/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    },
  );
  const body = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !body.id) {
    throw new Error(body.error?.message ?? `Media upload failed (${res.status})`);
  }
  return body.id;
}

export type DownloadedWhatsAppMedia = {
  bytes: Buffer;
  mimeType: string;
  fileSize: number;
  sha256?: string;
};

export async function downloadWhatsAppMedia(mediaId: string, maxBytes: number): Promise<DownloadedWhatsAppMedia> {
  const { accessToken } = await requiredWhatsAppCreds();
  const metadata = await graphGet(mediaId) as {
    url?: string;
    mime_type?: string;
    file_size?: number;
    sha256?: string;
  };
  if (!metadata.url) throw new Error("Meta did not return a media download URL");
  if (metadata.file_size && metadata.file_size > maxBytes) {
    throw new Error(`Attachment exceeds the ${Math.floor(maxBytes / 1_000_000)} MB safety limit`);
  }
  const response = await fetch(metadata.url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new MetaApiError(`Meta media download failed (${response.status})`, response.status);
  const declaredLength = Number(response.headers.get("content-length")) || metadata.file_size || 0;
  if (declaredLength > maxBytes) throw new Error(`Attachment exceeds the ${Math.floor(maxBytes / 1_000_000)} MB safety limit`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw new Error(`Attachment exceeds the ${Math.floor(maxBytes / 1_000_000)} MB safety limit`);
  return {
    bytes,
    mimeType: metadata.mime_type || response.headers.get("content-type") || "application/octet-stream",
    fileSize: bytes.length,
    sha256: metadata.sha256,
  };
}

export async function sendCtaUrlMessage(params: {
  to: string;
  bodyText: string;
  displayText: string;
  url: string;
}) {
  const { phoneNumberId } = await requiredWhatsAppCreds();
  return graphPost(`${phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: { text: params.bodyText },
      action: {
        name: "cta_url",
        parameters: {
          display_text: params.displayText.slice(0, 20),
          url: params.url,
        },
      },
    },
  });
}

export async function sendTemplateMessage(params: {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: string[];
}) {
  const { phoneNumberId } = await requiredWhatsAppCreds();
  const components =
    params.bodyParameters && params.bodyParameters.length > 0
      ? [
          {
            type: "body",
            parameters: params.bodyParameters.map((text) => ({
              type: "text",
              text,
            })),
          },
        ]
      : undefined;

  return graphPost(`${phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.languageCode ?? "en" },
      ...(components ? { components } : {}),
    },
  });
}
