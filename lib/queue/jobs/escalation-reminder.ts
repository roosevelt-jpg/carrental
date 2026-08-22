import { prisma } from "@/lib/db";
import { sendOwnerOperationalMessage } from "@/lib/integrations/whatsapp-messaging";
import { decryptPii } from "@/lib/privacy/pii";

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

  await sendOwnerOperationalMessage({
    purpose: "OWNER_REMINDER",
    text: `[${escalation.referenceCode}] Reminder: still waiting on your reply.\n\n${decryptPii(escalation.contextSummary)}`,
  });
  await prisma.escalation.update({
    where: { id: escalation.id },
    data: { remindedAt: new Date() },
  });
  return { reminded: true };
}
