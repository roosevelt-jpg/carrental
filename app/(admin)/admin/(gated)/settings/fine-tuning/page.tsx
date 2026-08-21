import { prisma } from "@/lib/db";

export default async function FineTuningReadinessPage() {
  const [conversationCount, outcomeCount, booked, escalated, dropped, messageCount] =
    await Promise.all([
      prisma.conversation.count(),
      prisma.conversationOutcome.count(),
      prisma.conversationOutcome.count({ where: { outcome: "BOOKED" } }),
      prisma.conversationOutcome.count({ where: { outcome: "ESCALATED" } }),
      prisma.conversationOutcome.count({ where: { outcome: "DROPPED" } }),
      prisma.message.count(),
    ]);

  const taggedShare =
    conversationCount === 0
      ? 0
      : Math.round((outcomeCount / conversationCount) * 100);
  const readyVolume = conversationCount >= 200 && outcomeCount >= 100;
  const readyBalance = booked > 0 && escalated > 0 && dropped > 0;

  return (
    <div>
      <h1 className="font-serif text-4xl">Fine-tuning readiness</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Human-curated only — never automatic. This page only assesses whether conversation volume
        and tagging coverage are worth a curated export later.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          { label: "Conversations", value: conversationCount },
          { label: "Tagged outcomes", value: outcomeCount },
          { label: "Messages", value: messageCount },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-line bg-panel p-6">
            <p className="text-xs uppercase tracking-widest text-muted">{card.label}</p>
            <p className="mt-3 font-serif text-4xl text-gold-2">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-line bg-panel p-6 space-y-3 text-sm">
        <p>
          Outcome mix: BOOKED {booked} · ESCALATED {escalated} · DROPPED {dropped}
        </p>
        <p>Tagged share: {taggedShare}%</p>
        <p className={readyVolume ? "text-ok" : "text-muted"}>
          Volume gate (≥200 conversations, ≥100 tagged): {readyVolume ? "met" : "not met"}
        </p>
        <p className={readyBalance ? "text-ok" : "text-muted"}>
          Outcome diversity gate: {readyBalance ? "met" : "not met"}
        </p>
        <p className="text-muted">
          When both gates pass, export curated transcripts manually. Do not fine-tune on raw
          unreviewed chats.
        </p>
      </div>
    </div>
  );
}
