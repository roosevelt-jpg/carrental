import Link from "next/link";
import { getWeeklyDigest } from "@/lib/analytics/weekly-digest";

export default async function DigestPage() {
  const digest = await getWeeklyDigest(7);

  const cards = [
    { label: "Conversations started", value: digest.conversationsStarted },
    { label: "Bookings confirmed", value: digest.bookingsConfirmed },
    { label: "Escalations opened", value: digest.escalationsOpened },
    { label: "Escalations resolved", value: digest.escalationsResolved },
    { label: "Drops tagged", value: digest.drops },
  ];

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Last {digest.days} days</p>
      <h1 className="mt-2 font-serif text-4xl">Weekly digest</h1>
      <p className="mt-3 text-muted">
        Patterns from real activity since {new Date(digest.since).toLocaleDateString()}.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-line bg-panel p-6">
            <p className="text-xs uppercase tracking-widest text-muted">{card.label}</p>
            <p className="mt-3 font-serif text-4xl text-gold-2">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-line bg-panel p-6">
          <h2 className="font-serif text-2xl">Outcomes</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {Object.entries(digest.outcomes).map(([key, value]) => (
              <li key={key} className="flex justify-between border-b border-line py-2">
                <span>{key}</span>
                <span className="text-gold-2">{value}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-line bg-panel p-6">
          <h2 className="font-serif text-2xl">Top escalation reasons</h2>
          {digest.topEscalationReasons.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No escalations in this window.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {digest.topEscalationReasons.map((row) => (
                <li key={row.reasonCode} className="flex justify-between border-b border-line py-2">
                  <span className="font-mono text-xs">{row.reasonCode}</span>
                  <span className="text-gold-2">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-8 text-sm text-muted">
        Also see{" "}
        <Link href="/admin/settings/audit-log" className="text-gold hover:underline">
          audit log
        </Link>{" "}
        for policy and rule edits.
      </p>
    </div>
  );
}
