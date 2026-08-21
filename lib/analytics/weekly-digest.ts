import { prisma } from "@/lib/db";

function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function getWeeklyDigest(days = 7) {
  const since = daysAgo(days);

  const [
    escalationsOpened,
    escalationsResolved,
    bookingsConfirmed,
    conversationsStarted,
    outcomes,
    topEscalationReasons,
    drops,
  ] = await Promise.all([
    prisma.escalation.count({ where: { createdAt: { gte: since } } }),
    prisma.escalation.count({
      where: { status: "RESOLVED", resolvedAt: { gte: since } },
    }),
    prisma.booking.count({ where: { confirmedAt: { gte: since } } }),
    prisma.conversation.count({ where: { startedAt: { gte: since } } }),
    prisma.conversationOutcome.groupBy({
      by: ["outcome"],
      where: { taggedAt: { gte: since } },
      _count: { outcome: true },
    }),
    prisma.escalation.groupBy({
      by: ["reasonCode"],
      where: { createdAt: { gte: since } },
      _count: { reasonCode: true },
      orderBy: { _count: { reasonCode: "desc" } },
      take: 8,
    }),
    prisma.conversationOutcome.count({
      where: { outcome: "DROPPED", taggedAt: { gte: since } },
    }),
  ]);

  const outcomeMap = Object.fromEntries(
    outcomes.map((row) => [row.outcome, row._count.outcome]),
  ) as Partial<Record<"BOOKED" | "DROPPED" | "ESCALATED", number>>;

  return {
    since: since.toISOString(),
    days,
    escalationsOpened,
    escalationsResolved,
    bookingsConfirmed,
    conversationsStarted,
    drops,
    outcomes: {
      BOOKED: outcomeMap.BOOKED ?? 0,
      DROPPED: outcomeMap.DROPPED ?? 0,
      ESCALATED: outcomeMap.ESCALATED ?? 0,
    },
    topEscalationReasons: topEscalationReasons.map((row) => ({
      reasonCode: row.reasonCode,
      count: row._count.reasonCode,
    })),
  };
}
