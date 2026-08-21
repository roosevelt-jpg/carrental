import type { MessageTemplatePurpose } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCredential } from "@/lib/settings/settings-service";
import { sendTemplateMessage, sendTextMessage } from "@/lib/integrations/whatsapp-client";
import { prepareNotification } from "@/lib/cms/content";

const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWithinCustomerServiceWindow(
  lastInboundAt: Date | null | undefined,
  now = new Date(),
) {
  return Boolean(
    lastInboundAt &&
      lastInboundAt <= now &&
      now.getTime() - lastInboundAt.getTime() < CUSTOMER_SERVICE_WINDOW_MS,
  );
}

async function approvedTemplate(purpose: MessageTemplatePurpose) {
  const template = await prisma.messageTemplate.findFirst({
    where: { purpose, status: "APPROVED", metaTemplateName: { not: null } },
    orderBy: { updatedAt: "desc" },
  });
  if (!template?.metaTemplateName) {
    throw new Error(`No approved Meta template configured for ${purpose}`);
  }
  return { ...template, metaTemplateName: template.metaTemplateName };
}

export async function sendCustomerText(params: {
  to: string;
  text: string;
  templatePurpose?: MessageTemplatePurpose;
  templateParameters?: string[];
}) {
  const customer = await prisma.customer.findUnique({
    where: { whatsappId: params.to },
    select: { lastInboundAt: true },
  });
  if (isWithinCustomerServiceWindow(customer?.lastInboundAt)) {
    return sendTextMessage(params.to, params.text);
  }
  if (!params.templatePurpose) {
    throw new Error("Free-form WhatsApp send blocked outside the 24-hour customer service window");
  }
  const template = await approvedTemplate(params.templatePurpose);
  return sendTemplateMessage({
    to: params.to,
    templateName: template.metaTemplateName,
    languageCode: template.language,
    bodyParameters: params.templateParameters ?? [params.text],
  });
}

export async function sendOwnerOperationalMessage(params: {
  text: string;
  purpose: "OWNER_ESCALATION" | "OWNER_REMINDER" | "WEEKLY_DIGEST" | "OWNER_BOOKING";
}) {
  const ownerPhone = await getCredential("whatsapp", "owner_phone_number");
  if (!ownerPhone) throw new Error("Owner WhatsApp number is not configured");
  const notification = await prepareNotification({
    purpose: params.purpose,
    values: { message: params.text },
    fallback: params.text,
  });
  const sent = await sendCustomerText({
    to: ownerPhone,
    text: notification.text,
    templatePurpose: params.purpose,
    templateParameters: notification.parameters,
  });
  return { sent, ownerPhone };
}
