"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardData } from "@/lib/admin/dashboard";
import { usePreferences } from "@/components/preferences/preferences-provider";

export function DashboardOverview({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState(initialData);
  const [connected, setConnected] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const next = await response.json() as DashboardData;
        if (!cancelled) { setData(next); setConnected(true); }
      } catch { if (!cancelled) setConnected(false); }
    };
    const timer = setInterval(refresh, 10_000);
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs uppercase tracking-[0.22em] text-gold">Command centre</p><h2 className="mt-2 max-w-3xl font-serif text-4xl sm:text-5xl">The business, at a glance.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Live operational performance, sales activity, and readiness from the connected production data.</p></div>
        <LiveState connected={connected} generatedAt={data.generatedAt} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.cards.map((card, index) => <article key={card.label} className="admin-card group relative overflow-hidden rounded-3xl p-6"><span className={`absolute inset-x-0 top-0 h-px ${card.tone === "warning" ? "bg-danger" : card.tone === "positive" ? "bg-ok" : "bg-gold"}`} /><div className="flex items-start justify-between"><p className="text-xs uppercase tracking-[0.18em] text-muted">{card.label}</p><span className="font-serif text-xl text-gold/40">0{index + 1}</span></div><p className="mt-7 font-serif text-5xl text-gold-2" data-no-translate>{card.value}</p><p className="mt-2 text-xs text-muted">{card.detail}</p></article>)}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="admin-card rounded-3xl p-6 sm:p-8">
          <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-gold">Live signals</p><h3 className="mt-2 font-serif text-3xl">Open escalations</h3></div><Link href="/admin/escalations" className="text-sm text-gold hover:text-gold-2">View all →</Link></div>
          {data.recentEscalations.length ? <div className="mt-6 divide-y divide-line">{data.recentEscalations.map((item) => <Link key={item.id} href="/admin/escalations" className="flex items-center justify-between gap-4 py-4 transition hover:pl-1"><div className="min-w-0"><p className="truncate text-sm font-medium" data-no-translate>{item.customerName}</p><p className="mt-1 truncate text-xs text-muted">{humanize(item.reasonCode)} · <span data-no-translate>{item.referenceCode}</span></p></div><div className="shrink-0 text-right"><span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-wider ${item.urgency === "high" ? "bg-danger/10 text-danger" : "bg-gold/10 text-gold-2"}`}>{item.urgency}</span><RelativeTime value={item.createdAt} now={data.generatedAt} /></div></Link>)}</div> : <div className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">No open escalations. The operation is clear.</div>}
        </section>
        <div className="space-y-6">
          <section className="admin-card rounded-3xl p-6"><p className="text-xs uppercase tracking-[0.2em] text-gold">Infrastructure</p><h3 className="mt-2 font-serif text-2xl">Connected services</h3><div className="mt-5 space-y-3">{data.providers.map((provider) => <div key={provider.label} className="flex items-center justify-between rounded-2xl bg-panel-2/60 px-4 py-3"><span className="text-sm">{provider.label}</span><span className={`flex items-center gap-2 text-xs ${provider.ok ? "text-ok" : "text-danger"}`}><span className={`h-2 w-2 rounded-full ${provider.ok ? "bg-ok" : "bg-danger"}`} />{provider.ok ? "Connected" : "Not connected"}</span></div>)}</div><p className="mt-5 text-xs text-muted">Meta templates approved: <span className="text-cream" data-no-translate>{data.templates.approved}/{data.templates.total || 3}</span>. <Link href="/admin/settings/message-templates" className="text-gold">Manage</Link></p></section>
          <section className="admin-card rounded-3xl p-6"><p className="text-xs uppercase tracking-[0.2em] text-gold">Meta messaging capacity</p><h3 className="mt-2 font-serif text-2xl">Rate limits & tiering</h3><p className="mt-3 text-sm text-muted">Meta assigns and upgrades messaging tiers from account quality and usage. The platform respects HTTP 429 responses with exponential retry backoff.</p><p className={`mt-4 text-sm ${data.metaRateLimit.lastRateLimitedAt ? "text-danger" : "text-ok"}`}>{data.metaRateLimit.lastRateLimitedAt ? `Last limited ${new Date(data.metaRateLimit.lastRateLimitedAt).toLocaleString()}${data.metaRateLimit.retryAfterSecs ? ` · retry after ${data.metaRateLimit.retryAfterSecs}s` : ""}` : "No rate-limit event recorded"}</p>{data.metaRateLimit.usagePercent != null ? <p className="mt-2 text-xs text-muted">Latest reported API usage: <span className="text-cream">{data.metaRateLimit.usagePercent}%</span></p> : null}</section>
          <section className="admin-card rounded-3xl p-6"><p className="text-xs uppercase tracking-[0.2em] text-gold">Readiness</p><Progress label="Go-live checklist" value={data.checklist.done} total={data.checklist.total} href="/admin/go-live" /><Progress label="7-day bookings" value={data.digest.bookingsConfirmed} total={Math.max(data.digest.conversationsStarted, 1)} href="/admin/digest" /></section>
        </div>
      </div>
    </div>
  );
}

function LiveState({ connected, generatedAt }: { connected: boolean; generatedAt: string }) { const { locale } = usePreferences(); return <div className="flex items-center gap-3 rounded-full border border-line bg-panel px-4 py-2 text-xs" data-no-translate><span className={`relative h-2 w-2 rounded-full ${connected ? "bg-ok" : "bg-danger"}`}>{connected ? <span className="absolute inset-0 animate-ping rounded-full bg-ok opacity-50" /> : null}</span><span>{connected ? "Live" : "Reconnecting"}</span><span className="text-muted">· {new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(generatedAt))}</span></div>; }
function RelativeTime({ value, now }: { value: string; now: string }) { const minutes = Math.max(0, Math.floor((new Date(now).getTime() - new Date(value).getTime()) / 60_000)); return <p className="mt-2 text-[10px] text-muted" data-no-translate>{minutes < 1 ? "now" : `${minutes}m ago`}</p>; }
function Progress({ label, value, total, href }: { label: string; value: number; total: number; href: string }) { const percentage = total ? Math.min(100, Math.round((value / total) * 100)) : 0; return <Link href={href} className="mt-5 block"><div className="flex justify-between text-xs"><span>{label}</span><span className="text-muted" data-no-translate>{value}/{total}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2"><div className="h-full rounded-full bg-gold" style={{ width: `${percentage}%` }} /></div></Link>; }
function humanize(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
