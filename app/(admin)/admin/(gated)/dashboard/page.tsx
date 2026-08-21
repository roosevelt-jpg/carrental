import Link from "next/link";
import { prisma } from "@/lib/db";
import { isProviderConfigured } from "@/lib/settings/settings-service";
import { getWeeklyDigest } from "@/lib/analytics/weekly-digest";
import { getGoLiveChecklist } from "@/lib/setup/go-live-checklist";

function startOfWeek(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getUTCDay();
  const diff = (day + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - diff);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export default async function DashboardPage() {
  const [
    openEscalations,
    activeConversations,
    bookingsThisWeek,
    whatsapp,
    anthropic,
    stripe,
    digest,
    checklist,
    templates,
  ] = await Promise.all([
    prisma.escalation.count({ where: { status: "OPEN" } }),
    prisma.conversation.count({ where: { status: "ACTIVE" } }),
    prisma.booking.count({
      where: { confirmedAt: { gte: startOfWeek() } },
    }),
    isProviderConfigured("whatsapp"),
    isProviderConfigured("anthropic"),
    isProviderConfigured("stripe"),
    getWeeklyDigest(7),
    getGoLiveChecklist(),
    prisma.messageTemplate.findMany(),
  ]);

  const cards = [
    { label: "Open escalations", value: openEscalations },
    { label: "Active conversations", value: activeConversations },
    { label: "Bookings this week", value: bookingsThisWeek },
  ];

  const providers = [
    { label: "WhatsApp", ok: whatsapp },
    { label: "Claude", ok: anthropic },
    { label: "Stripe", ok: stripe },
  ];

  const approvedTemplates = templates.filter((t) => t.status === "APPROVED").length;
  const checklistDone = checklist.filter((i) => i.done).length;

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Overview</p>
      <h1 className="mt-2 font-serif text-4xl">Dashboard</h1>
      <div className="mt-8 grid grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-line bg-panel p-6">
            <p className="text-xs uppercase tracking-widest text-muted">{card.label}</p>
            <p className="mt-3 font-serif text-4xl text-gold-2">{card.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-xl border border-line bg-panel p-6">
        <p className="text-xs uppercase tracking-widest text-muted">Providers</p>
        <ul className="mt-4 flex gap-6 text-sm">
          {providers.map((provider) => (
            <li key={provider.label} className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${provider.ok ? "bg-ok" : "bg-danger"}`}
              />
              {provider.label}
              <span className="text-muted">
                {provider.ok ? "Connected" : "Not connected"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted">
          Message templates approved: {approvedTemplates}/{templates.length || 3}.{" "}
          <Link href="/admin/settings/message-templates" className="text-gold hover:underline">
            Manage templates
          </Link>
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-6">
          <p className="text-xs uppercase tracking-widest text-muted">7-day snapshot</p>
          <p className="mt-2 text-sm text-cream/80">
            {digest.conversationsStarted} conversations · {digest.escalationsOpened} escalations ·{" "}
            {digest.bookingsConfirmed} bookings · {digest.drops} drops
          </p>
          <Link href="/admin/digest" className="mt-4 inline-block text-sm text-gold hover:underline">
            Open digest
          </Link>
        </div>
        <div className="rounded-xl border border-line bg-panel p-6">
          <p className="text-xs uppercase tracking-widest text-muted">Go-live</p>
          <p className="mt-2 text-sm text-cream/80">
            {checklistDone}/{checklist.length} checklist items ready
          </p>
          <Link href="/admin/go-live" className="mt-4 inline-block text-sm text-gold hover:underline">
            Open checklist
          </Link>
        </div>
      </div>
    </div>
  );
}
