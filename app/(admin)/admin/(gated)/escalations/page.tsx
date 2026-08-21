import { EscalationsManager } from "@/components/admin/escalations-manager";
import { prisma } from "@/lib/db";

export default async function EscalationsPage() {
  const escalations = await prisma.escalation.findMany({
    include: {
      conversation: { include: { customer: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="font-serif text-4xl">Escalations</h1>
      <EscalationsManager
        escalations={escalations.map((e) => ({
          id: e.id,
          referenceCode: e.referenceCode,
          reasonCode: e.reasonCode,
          contextSummary: e.contextSummary,
          status: e.status,
          urgency: e.urgency,
          createdAt: e.createdAt.toISOString(),
          customerWhatsappId: e.conversation.customer.whatsappId,
        }))}
      />
    </div>
  );
}
