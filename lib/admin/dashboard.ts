import { prisma } from "@/lib/db";
import { isProviderConfigured } from "@/lib/settings/settings-service";
import { getWeeklyDigest } from "@/lib/analytics/weekly-digest";
import { getGoLiveChecklist } from "@/lib/setup/go-live-checklist";

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export async function getDashboardData() {
  const metricsSince = startOfWeek();
  const [openEscalations, activeConversations, bookingsThisWeek, whatsapp, anthropic, stripe, digest, checklist, templateCounts, processing, outboundMessages, failedMessages, recentEscalations] = await Promise.all([
    prisma.escalation.count({ where: { status: "OPEN" } }),
    prisma.conversation.count({ where: { status: "ACTIVE" } }),
    prisma.booking.count({ where: { confirmedAt: { gte: metricsSince } } }),
    isProviderConfigured("whatsapp"),
    isProviderConfigured("anthropic"),
    isProviderConfigured("stripe"),
    getWeeklyDigest(7),
    getGoLiveChecklist(),
    prisma.messageTemplate.groupBy({ by: ["status"], _count: true }),
    prisma.processingMetric.aggregate({ where: { createdAt: { gte: metricsSince } }, _avg: { latencyMs: true }, _count: true }),
    prisma.message.count({ where: { direction: "OUT", sentAt: { gte: metricsSince } } }),
    prisma.message.count({ where: { direction: "OUT", deliveryStatus: "FAILED", sentAt: { gte: metricsSince } } }),
    prisma.escalation.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, referenceCode: true, reasonCode: true, urgency: true, createdAt: true, conversation: { select: { customer: { select: { name: true } } } } } }),
  ]);
  const totalTemplates = templateCounts.reduce((total, row) => total + row._count, 0);
  const approvedTemplates = templateCounts.find((row) => row.status === "APPROVED")?._count ?? 0;
  return {
    generatedAt: new Date().toISOString(),
    cards: [
      { label: "Open escalations", value: String(openEscalations), detail: "Requires human attention", tone: openEscalations > 0 ? "warning" : "positive" },
      { label: "Active conversations", value: String(activeConversations), detail: "Live WhatsApp threads", tone: "neutral" },
      { label: "Bookings this week", value: String(bookingsThisWeek), detail: "Confirmed since Monday", tone: "positive" },
      { label: "Average response", value: processing._avg.latencyMs == null ? "—" : `${(processing._avg.latencyMs / 1000).toFixed(1)}s`, detail: "AI processing time", tone: "neutral" },
      { label: "Message success", value: outboundMessages === 0 ? "—" : `${(((outboundMessages - failedMessages) / outboundMessages) * 100).toFixed(2)}%`, detail: `${outboundMessages} outbound this week`, tone: failedMessages > 0 ? "warning" : "positive" },
      { label: "Measured turns", value: String(processing._count), detail: "Observed this week", tone: "neutral" },
    ],
    providers: [{ label: "WhatsApp", ok: whatsapp }, { label: "Claude", ok: anthropic }, { label: "Stripe", ok: stripe }],
    templates: { approved: approvedTemplates, total: totalTemplates },
    digest: { conversationsStarted: digest.conversationsStarted, escalationsOpened: digest.escalationsOpened, bookingsConfirmed: digest.bookingsConfirmed, drops: digest.drops },
    checklist: { done: checklist.filter((item) => item.done).length, total: checklist.length },
    recentEscalations: recentEscalations.map((item) => ({ id: item.id, referenceCode: item.referenceCode, reasonCode: item.reasonCode, urgency: item.urgency, customerName: item.conversation.customer.name || "Unknown customer", createdAt: item.createdAt.toISOString() })),
  };
}

function startOfWeek(date = new Date()) {
  const copy = new Date(date);
  const diff = (copy.getUTCDay() + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - diff);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}
