import Link from "next/link";
import { Suspense } from "react";
import type { ConversationStatus, OutcomeType, Prisma } from "@prisma/client";
import { ConversationFilters } from "@/components/admin/conversation-filters";
import { prisma } from "@/lib/db";
import { LiveRefresh } from "@/components/admin/live-refresh";
import { decryptPii } from "@/lib/privacy/pii";

type SearchParams = Promise<{ status?: string; outcome?: string }>;

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const status = params.status?.toUpperCase() ?? "ALL";
  const outcome = params.outcome?.toUpperCase() ?? "ALL";

  const where: Prisma.ConversationWhereInput = {};
  if (status === "ACTIVE" || status === "ESCALATED" || status === "CLOSED") {
    where.status = status as ConversationStatus;
  }
  if (outcome === "BOOKED" || outcome === "DROPPED" || outcome === "ESCALATED") {
    where.outcome = { outcome: outcome as OutcomeType };
  } else if (outcome === "UNTAGGED") {
    where.outcome = null;
  }

  const conversations = await prisma.conversation.findMany({
    where,
    include: {
      customer: true,
      outcome: true,
      _count: { select: { messages: true } },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="flex items-center justify-between"><h1 className="font-serif text-4xl">Conversations</h1><LiveRefresh /></div>
      <p className="mt-3 text-muted">
        {conversations.length === 0
          ? "No conversations match these filters."
          : `${conversations.length} conversation${conversations.length === 1 ? "" : "s"}`}
      </p>
      <Suspense fallback={null}>
        <ConversationFilters status={status} outcome={outcome} />
      </Suspense>
      <ul className="mt-8 space-y-3">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <Link
              href={`/admin/conversations/${conversation.id}`}
              className="block rounded-xl border border-line bg-panel p-5 hover:border-gold/40"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-gold-2">{decryptPii(conversation.customer.whatsappId)}</p>
                <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted">
                  {conversation.outcome ? (
                    <span className="text-gold">{conversation.outcome.outcome}</span>
                  ) : null}
                  <span>{conversation.status}</span>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted">
                {conversation._count.messages} messages · last{" "}
                {conversation.lastMessageAt.toLocaleString()}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
