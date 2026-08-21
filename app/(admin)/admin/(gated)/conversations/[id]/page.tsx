import { notFound } from "next/navigation";
import { ConversationActions } from "@/components/admin/conversation-actions";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export default async function ConversationDetailPage({ params }: Params) {
  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      customer: true,
      messages: { orderBy: { sentAt: "asc" } },
      escalations: { orderBy: { createdAt: "desc" } },
      outcome: true,
    },
  });
  if (!conversation) notFound();

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Conversation</p>
      <h1 className="mt-2 font-serif text-4xl">{conversation.customer.whatsappId}</h1>
      <p className="mt-2 text-sm text-muted">
        {conversation.status} · started {conversation.startedAt.toLocaleString()}
      </p>

      <div className="mt-6 max-w-xl">
        <ConversationActions
          conversationId={conversation.id}
          status={conversation.status}
          currentOutcome={conversation.outcome?.outcome ?? null}
        />
      </div>

      <div className="mt-8 space-y-3">
        {conversation.messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-2xl rounded-xl border border-line p-4 ${
              message.direction === "IN" ? "bg-panel-2" : "bg-panel ml-auto"
            }`}
          >
            <p className="text-[11px] uppercase tracking-widest text-muted">
              {message.direction} · {message.type} · {message.sentAt.toLocaleString()}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm">
              {message.content ?? (message.mediaIds.length ? "[media]" : "")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
