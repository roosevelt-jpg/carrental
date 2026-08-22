import { EscalationsManager } from "@/components/admin/escalations-manager";
import { prisma } from "@/lib/db";
import { decryptPii } from "@/lib/privacy/pii";

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
          contextSummary: decryptPii(e.contextSummary) ?? "",
          suggestedReply: decryptPii(e.suggestedReply),
          status: e.status,
          urgency: e.urgency,
          createdAt: e.createdAt.toISOString(),
          customerWhatsappId: decryptPii(e.conversation.customer.whatsappId) ?? "",
        }))}
      />
    </div>
  );
}
