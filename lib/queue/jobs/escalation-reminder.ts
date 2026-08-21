import { prisma } from "@/lib/db";
import { getCredential } from "@/lib/settings/settings-service";
import { sendTextMessage } from "@/lib/integrations/whatsapp-client";

export type EscalationReminderJob = {
  escalationId: string;
};

export async function processEscalationReminder(data: EscalationReminderJob) {
  const escalation = await prisma.escalation.findUnique({
    where: { id: data.escalationId },
  });
  if (!escalation || escalation.status !== "OPEN") {
    return { skipped: true };
  }

  const ownerPhone = await getCredential("whatsapp", "owner_phone_number");
  if (!ownerPhone) {
    return { skipped: true, reason: "no_owner_phone" };
  }

  await sendTextMessage(
    ownerPhone,
    `[${escalation.referenceCode}] Reminder: still waiting on your reply.\n\n${escalation.contextSummary}`,
  );
  await prisma.escalation.update({
    where: { id: escalation.id },
    data: { remindedAt: new Date() },
  });
  return { reminded: true };
}
