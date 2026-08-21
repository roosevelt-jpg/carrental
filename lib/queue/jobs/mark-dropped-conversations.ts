import { prisma } from "@/lib/db";

export type MarkDroppedConversationsJob = {
  idleHours?: number;
};

export async function processMarkDroppedConversations(
  data: MarkDroppedConversationsJob = {},
) {
  const idleHours = data.idleHours ?? 72;
  const cutoff = new Date(Date.now() - idleHours * 60 * 60 * 1000);

  const stale = await prisma.conversation.findMany({
    where: {
      status: "ACTIVE",
      lastMessageAt: { lt: cutoff },
      outcome: null,
      quotes: { none: { status: "CONFIRMED" } },
    },
    select: { id: true },
    take: 200,
  });

  let closed = 0;
  for (const conversation of stale) {
    await prisma.$transaction([
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: "CLOSED" },
      }),
      prisma.conversationOutcome.create({
        data: {
          conversationId: conversation.id,
          outcome: "DROPPED",
          taggedBy: "SYSTEM",
        },
      }),
    ]);
    closed += 1;
  }

  return { scanned: stale.length, closed, idleHours };
}
