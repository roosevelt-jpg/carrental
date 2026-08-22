import { prisma } from "@/lib/db";
import { getDataRetentionDays } from "@/lib/settings/business-controls";
import { encryptPii, piiLookupHash } from "@/lib/privacy/pii";

export async function processRetentionSweep() {
  const retentionDays = await getDataRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const customers = await prisma.customer.findMany({
    where: {
      anonymizedAt: null,
      conversations: {
        some: {},
        every: { status: "CLOSED", lastMessageAt: { lt: cutoff } },
      },
    },
    select: { id: true },
    take: 100,
  });

  for (const customer of customers) {
    await prisma.$transaction(async (tx) => {
      const conversations = await tx.conversation.findMany({
        where: { customerId: customer.id },
        select: { id: true },
      });
      const conversationIds = conversations.map((item) => item.id);
      await tx.message.updateMany({
        where: { conversationId: { in: conversationIds } },
        data: { content: null, mediaIds: [] },
      });
      await tx.escalation.updateMany({
        where: { conversationId: { in: conversationIds } },
        data: { contextSummary: encryptPii("Removed by retention policy")!, ownerReply: null, suggestedReply: null },
      });
      await tx.conversation.updateMany({
        where: { id: { in: conversationIds } },
        data: { summary: null },
      });
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          whatsappId: encryptPii(`deleted:${customer.id}`)!,
          whatsappIdHash: piiLookupHash(`deleted:${customer.id}`),
          name: null,
          verifiedDocs: false,
          anonymizedAt: new Date(),
        },
      });
    });
  }

  if (customers.length > 0) {
    await prisma.auditLog.create({
      data: {
        entityType: "RetentionPolicy",
        action: "anonymize",
        summary: `Anonymized ${customers.length} customers after ${retentionDays} days`,
      },
    });
  }

  return { anonymized: customers.length, retentionDays };
}
