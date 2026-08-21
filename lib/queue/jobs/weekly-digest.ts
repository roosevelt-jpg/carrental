import { getWeeklyDigest } from "@/lib/analytics/weekly-digest";
import { sendOwnerOperationalMessage } from "@/lib/integrations/whatsapp-messaging";

export async function processWeeklyDigest(data: { days?: number } = {}) {
  const digest = await getWeeklyDigest(data.days ?? 7);
  const reasons = digest.topEscalationReasons
    .slice(0, 3)
    .map((item) => `${item.reasonCode}: ${item.count}`)
    .join(", ");
  const text = [
    `Weekly sales-agent report (${digest.days} days)`,
    `${digest.conversationsStarted} conversations, ${digest.bookingsConfirmed} bookings, ${digest.drops} drops.`,
    `${digest.escalationsOpened} escalations opened; ${digest.escalationsResolved} resolved.`,
    reasons ? `Top escalation reasons: ${reasons}.` : "No escalations were recorded.",
  ].join("\n");
  await sendOwnerOperationalMessage({ purpose: "WEEKLY_DIGEST", text });
  return { sent: true, days: digest.days };
}
