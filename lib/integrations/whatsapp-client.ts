import { getCredential } from "@/lib/settings/settings-service";
import { WHATSAPP_GRAPH_VERSION } from "@/lib/integrations/constants";

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
  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      (body as { error?: { message?: string } }).error?.message ??
        `WhatsApp Graph POST ${res.status}`,
    );
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
