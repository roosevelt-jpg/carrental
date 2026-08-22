import { prisma } from "@/lib/db";
import { getCmsSettings } from "@/lib/cms/content";
import { percentile } from "@/lib/analytics/latency";

export type AnalyticsData = Awaited<ReturnType<typeof getLiveAnalytics>>;

export async function getLiveAnalytics(days = 30) {
  const safeDays = [7, 30, 90].includes(days) ? days : 30;
  const now = new Date(); const since = startOfDay(new Date(now.getTime() - (safeDays - 1) * 86_400_000)); const previousSince = new Date(since.getTime() - safeDays * 86_400_000);
  const [cms, conversations, quotes, bookings, escalations, processing, outbound, knowledgeQueries, previous, openEscalations, pipeline] = await Promise.all([
    getCmsSettings(),
    prisma.conversation.findMany({ where: { startedAt: { gte: since } }, select: { id: true, startedAt: true, status: true } }),
    prisma.quote.findMany({ where: { createdAt: { gte: since } }, select: { id: true, conversationId: true, createdAt: true, status: true, totalPrice: true, vehicle: { select: { make: true, model: true } } } }),
    prisma.booking.findMany({ where: { confirmedAt: { gte: since }, status: "CONFIRMED" }, select: { id: true, confirmedAt: true, quote: { select: { totalPrice: true, vehicle: { select: { make: true, model: true } } } } } }),
    prisma.escalation.findMany({ where: { createdAt: { gte: since } }, select: { id: true, createdAt: true, resolvedAt: true, reasonCode: true } }),
    prisma.processingMetric.findMany({ where: { createdAt: { gte: since } }, select: { latencyMs: true, succeeded: true, createdAt: true } }),
    prisma.message.findMany({ where: { direction: "OUT", sentAt: { gte: since } }, select: { sentAt: true, deliveryStatus: true } }),
    prisma.knowledgeQueryLog.findMany({ where: { createdAt: { gte: since } }, select: { found: true, createdAt: true } }),
    getPreviousPeriod(previousSince, since),
    prisma.escalation.count({ where: { status: "OPEN" } }),
    prisma.pipelineLatencyMetric.findMany({ where: { createdAt: { gte: since } }, select: { stage: true, latencyMs: true } }),
  ]);

  const revenue = bookings.reduce((sum, item) => sum + Number(item.quote.totalPrice), 0);
  const avgLatency = processing.length ? processing.reduce((sum, item) => sum + item.latencyMs, 0) / processing.length : null;
  const delivered = outbound.filter((item) => item.deliveryStatus !== "FAILED").length;
  const coverage = knowledgeQueries.length ? (knowledgeQueries.filter((item) => item.found).length / knowledgeQueries.length) * 100 : 100;
  const series = makeSeries(since, safeDays);
  for (const item of conversations) { const day = series[indexFor(item.startedAt, since)]; if (day) day.conversations += 1; }
  for (const item of quotes) { const day = series[indexFor(item.createdAt, since)]; if (day) day.quotes += 1; }
  for (const item of bookings) { const day = item.confirmedAt ? series[indexFor(item.confirmedAt, since)] : undefined; if (day) { day.bookings++; day.revenue += Number(item.quote.totalPrice); } }
  for (const item of escalations) { const day = series[indexFor(item.createdAt, since)]; if (day) day.escalations += 1; }

  const vehicleMap = new Map<string, { quotes: number; bookings: number; revenue: number }>();
  for (const item of quotes) { const name = `${item.vehicle.make} ${item.vehicle.model}`; const row = vehicleMap.get(name) ?? { quotes: 0, bookings: 0, revenue: 0 }; row.quotes++; vehicleMap.set(name, row); }
  for (const item of bookings) { const name = `${item.quote.vehicle.make} ${item.quote.vehicle.model}`; const row = vehicleMap.get(name) ?? { quotes: 0, bookings: 0, revenue: 0 }; row.bookings++; row.revenue += Number(item.quote.totalPrice); vehicleMap.set(name, row); }
  const reasonMap = new Map<string, number>(); for (const item of escalations) reasonMap.set(item.reasonCode, (reasonMap.get(item.reasonCode) ?? 0) + 1);

  return {
    generatedAt: now.toISOString(), days: safeDays, currency: cms.currency,
    metrics: [
      metric("Revenue", revenue, previous.revenue, "currency"),
      metric("Conversations", conversations.length, previous.conversations, "number"),
      metric("Confirmed bookings", bookings.length, previous.bookings, "number"),
      metric("Lead conversion", conversations.length ? bookings.length / conversations.length * 100 : 0, previous.conversations ? previous.bookings / previous.conversations * 100 : 0, "percent"),
      metric("Average AI response", avgLatency == null ? null : avgLatency / 1000, previous.avgLatency == null ? null : previous.avgLatency / 1000, "seconds"),
      metric("Message success", outbound.length ? delivered / outbound.length * 100 : 100, previous.outbound ? (previous.outbound - previous.failed) / previous.outbound * 100 : 100, "percent"),
      metric("Escalation rate", conversations.length ? escalations.length / conversations.length * 100 : 0, previous.conversations ? previous.escalations / previous.conversations * 100 : 0, "percent", true),
      metric("Knowledge coverage", coverage, previous.knowledgeQueries ? previous.knowledgeFound / previous.knowledgeQueries * 100 : 100, "percent"),
    ],
    funnel: { conversations: conversations.length, quotedConversations: new Set(quotes.map((item) => item.conversationId)).size, quotes: quotes.length, bookings: bookings.length },
    operations: { openEscalations, resolutionRate: escalations.length ? escalations.filter((item) => item.resolvedAt).length / escalations.length * 100 : 100, aiSuccessRate: processing.length ? processing.filter((item) => item.succeeded).length / processing.length * 100 : 100, knowledgeMisses: knowledgeQueries.filter((item) => !item.found).length },
    latencySlo: latencyReport(pipeline, processing.map((item) => item.latencyMs)),
    series,
    topVehicles: [...vehicleMap.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.revenue - a.revenue || b.quotes - a.quotes).slice(0, 6),
    escalationReasons: [...reasonMap.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 6),
  };
}

function latencyReport(rows: Array<{ stage: string; latencyMs: number }>, endToEnd: number[]) {
  const stages = [
    { key: "webhook_to_queue", label: "Webhook → queue", targetMs: 200 },
    { key: "context_assembly", label: "Context assembly", targetMs: 500 },
    { key: "db_tool", label: "Database tool", targetMs: 100 },
    { key: "end_to_end", label: "Complete processing", targetMs: 5000 },
  ];
  return stages.map((stage) => { const values = stage.key === "end_to_end" ? endToEnd : rows.filter((row) => row.stage === stage.key).map((row) => row.latencyMs); const p50 = percentile(values, .5); const p95 = percentile(values, .95); return { ...stage, samples: values.length, p50, p95, passing: p95 != null && p95 <= stage.targetMs }; });
}

async function getPreviousPeriod(from: Date, to: Date) {
  const [conversations, bookings, bookingRows, escalations, processing, outbound, failed, knowledgeQueries, knowledgeFound] = await Promise.all([
    prisma.conversation.count({ where: { startedAt: { gte: from, lt: to } } }), prisma.booking.count({ where: { confirmedAt: { gte: from, lt: to }, status: "CONFIRMED" } }),
    prisma.booking.findMany({ where: { confirmedAt: { gte: from, lt: to }, status: "CONFIRMED" }, select: { quote: { select: { totalPrice: true } } } }),
    prisma.escalation.count({ where: { createdAt: { gte: from, lt: to } } }), prisma.processingMetric.aggregate({ where: { createdAt: { gte: from, lt: to } }, _avg: { latencyMs: true } }),
    prisma.message.count({ where: { direction: "OUT", sentAt: { gte: from, lt: to } } }), prisma.message.count({ where: { direction: "OUT", deliveryStatus: "FAILED", sentAt: { gte: from, lt: to } } }),
    prisma.knowledgeQueryLog.count({ where: { createdAt: { gte: from, lt: to } } }), prisma.knowledgeQueryLog.count({ where: { createdAt: { gte: from, lt: to }, found: true } }),
  ]);
  return { conversations, bookings, revenue: bookingRows.reduce((sum, item) => sum + Number(item.quote.totalPrice), 0), escalations, avgLatency: processing._avg.latencyMs, outbound, failed, knowledgeQueries, knowledgeFound };
}
function metric(label: string, value: number | null, previous: number | null, format: "currency" | "number" | "percent" | "seconds", inverse = false) { const change = value == null || previous == null || previous === 0 ? null : ((value - previous) / Math.abs(previous)) * 100; return { label, value, format, change, positive: change == null ? null : inverse ? change <= 0 : change >= 0 }; }
function startOfDay(date: Date) { date.setUTCHours(0, 0, 0, 0); return date; }
function indexFor(date: Date, since: Date) { return Math.floor((startOfDay(new Date(date)).getTime() - since.getTime()) / 86_400_000); }
function makeSeries(since: Date, days: number) { return Array.from({ length: days }, (_, index) => { const date = new Date(since.getTime() + index * 86_400_000); return { date: date.toISOString().slice(0, 10), conversations: 0, quotes: 0, bookings: 0, escalations: 0, revenue: 0 }; }); }
