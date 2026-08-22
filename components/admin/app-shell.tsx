"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { UserRole } from "@prisma/client";
import { logout } from "@/app/(admin)/admin/actions";
import { PreferencesControls } from "@/components/preferences/preferences-controls";
import { usePreferences } from "@/components/preferences/preferences-provider";

type AdminProfile = { email: string; name: string | null; avatarUrl: string | null; role: UserRole };

const NAV_GROUPS = [
  { label: "Overview", items: [
    { href: "/admin/dashboard", label: "Dashboard", icon: "grid" },
    { href: "/admin/go-live", label: "Go-live", icon: "spark" },
  ] },
  { label: "Operations", items: [
    { href: "/admin/conversations", label: "Conversations", icon: "chat" },
    { href: "/admin/bookings", label: "Bookings", icon: "calendar" },
    { href: "/admin/escalations", label: "Escalations", icon: "alert" },
  ] },
  { label: "Fleet & sales", items: [
    { href: "/admin/fleet", label: "Fleet", icon: "car" },
    { href: "/admin/pricing", label: "Pricing", icon: "tag" },
    { href: "/admin/policies", label: "Policies", icon: "file" },
  ] },
  { label: "Intelligence", items: [
    { href: "/admin/analytics", label: "Analytics", icon: "chart" },
    { href: "/admin/digest", label: "Weekly digest", icon: "chart" },
    { href: "/admin/knowledge", label: "Knowledge base", icon: "book" },
    { href: "/admin/content", label: "Content studio", icon: "pen" },
  ] },
  { label: "System", items: [
    { href: "/admin/settings/integrations", label: "Integrations", icon: "plug" },
    { href: "/admin/settings/message-templates", label: "Message templates", icon: "template" },
    { href: "/admin/settings/escalation-rules", label: "Escalation rules", icon: "rules" },
    { href: "/admin/settings/fine-tuning", label: "Fine-tuning", icon: "tune" },
    { href: "/admin/settings/audit-log", label: "Audit log", icon: "history" },
    { href: "/admin/settings/users", label: "Users", icon: "users" },
  ] },
] as const;

export function AppShell({ profile, businessName, businessLogoUrl, children }: {
  profile: AdminProfile;
  businessName: string;
  businessLogoUrl: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const title = useMemo(() => pageTitle(pathname), [pathname]);

  return (
    <div data-i18n className="min-h-screen bg-ink text-cream">
      <div className="pointer-events-none fixed inset-0 admin-luxury-grid opacity-30" aria-hidden="true" />
      {mobileOpen ? <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 cursor-default bg-black/60 backdrop-blur-sm lg:hidden" /> : null}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[278px] flex-col border-r border-line bg-panel/95 shadow-2xl backdrop-blur-xl transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-24 items-center gap-3 border-b border-line px-6">
          <BrandMark name={businessName} logoUrl={businessLogoUrl} />
          <div className="min-w-0">
            <p className="truncate font-serif text-xl text-gold-2">{businessName}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.24em] text-muted">Executive console</p>
          </div>
        </div>
        <nav className="admin-scrollbar flex-1 overflow-y-auto px-4 py-5" aria-label="Administration">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-6">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted/80">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return <Link onClick={() => setMobileOpen(false)} key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-gold text-ink shadow-[0_10px_30px_rgba(198,163,106,.18)]" : "text-cream/70 hover:bg-panel-2 hover:text-cream"}`}><NavIcon name={item.icon} /><span>{item.label}</span></Link>;
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          <Link onClick={() => setMobileOpen(false)} href="/admin/settings/profile" className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-panel-2">
            <Avatar profile={profile} />
            <div className="min-w-0" data-no-translate>
              <p className="truncate text-sm font-medium">{profile.name || "Account profile"}</p>
              <p className="truncate text-xs text-muted">{profile.email}</p>
            </div>
          </Link>
        </div>
      </aside>

      <div className="relative lg:pl-[278px]">
        <header className="sticky top-0 z-[60] flex h-20 items-center justify-between border-b border-line bg-ink/82 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-4">
            <button type="button" onClick={() => setMobileOpen(true)} className="grid h-10 w-10 place-items-center rounded-full border border-line lg:hidden" aria-label="Open menu"><MenuIcon /></button>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.24em] text-gold">Administration</p>
              <h1 className="truncate font-serif text-2xl leading-tight sm:text-3xl">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LiveClock />
            <div className="hidden sm:block"><PreferencesControls compact /></div>
            <div className="relative">
              <button type="button" onClick={() => setProfileOpen((open) => !open)} className="flex items-center gap-2 rounded-full border border-line bg-panel p-1.5 pr-2 transition hover:border-gold" aria-haspopup="menu" aria-expanded={profileOpen}>
                <Avatar profile={profile} small /><span className="hidden text-xs text-muted xl:block">⌄</span>
              </button>
              {profileOpen ? (
                <div role="menu" className="absolute right-0 z-[70] mt-3 w-72 overflow-hidden rounded-2xl border border-line bg-panel p-2 shadow-2xl">
                  <div className="border-b border-line px-3 py-3" data-no-translate>
                    <p className="font-medium">{profile.name || "Account profile"}</p>
                    <p className="mt-1 truncate text-xs text-muted">{profile.email}</p>
                    <span className="mt-2 inline-flex rounded-full bg-gold/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gold-2">{profile.role}</span>
                  </div>
                  <Link onClick={() => setProfileOpen(false)} role="menuitem" href="/admin/settings/profile" className="mt-2 block rounded-xl px-3 py-2.5 text-sm hover:bg-panel-2">Profile & picture</Link>
                  <Link onClick={() => setProfileOpen(false)} role="menuitem" href="/admin/content" className="block rounded-xl px-3 py-2.5 text-sm hover:bg-panel-2">Brand & public site</Link>
                  <Link onClick={() => setProfileOpen(false)} role="menuitem" href="/admin/settings/integrations" className="block rounded-xl px-3 py-2.5 text-sm hover:bg-panel-2">Integration settings</Link>
                  <div className="border-t border-line px-3 pt-3 sm:hidden"><PreferencesControls compact /></div>
                  <form action={logout} className="mt-2 border-t border-line pt-2"><button role="menuitem" type="submit" className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-danger hover:bg-danger/10">Sign out</button></form>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="relative px-4 py-7 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

function LiveClock() {
  const { locale } = usePreferences();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { const immediate = setTimeout(() => setNow(new Date()), 0); const timer = setInterval(() => setNow(new Date()), 1_000); return () => { clearTimeout(immediate); clearInterval(timer); }; }, []);
  if (!now) return <div className="hidden h-10 w-40 animate-pulse rounded-xl bg-panel md:block" />;
  return <div className="hidden border-r border-line pr-4 text-right md:block" data-no-translate>
    <p className="text-xs font-medium">{new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(now)}</p>
    <p className="mt-0.5 text-[11px] tabular-nums text-muted">{new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now)}</p>
  </div>;
}

function BrandMark({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) return <Image unoptimized src={logoUrl} alt={`${name} logo`} width={44} height={44} className="h-11 w-11 rounded-xl object-contain" />;
  return <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold font-serif text-xl font-semibold text-ink">{name.charAt(0).toUpperCase()}</span>;
}
function Avatar({ profile, small = false }: { profile: AdminProfile; small?: boolean }) {
  const size = small ? "h-8 w-8" : "h-10 w-10";
  if (profile.avatarUrl) return <Image unoptimized src={profile.avatarUrl} alt="Profile picture" width={40} height={40} className={`${size} shrink-0 rounded-full object-cover ring-1 ring-gold/30`} />;
  const initials = (profile.name || profile.email).split(/[\s@]+/).slice(0, 2).map((value) => value.charAt(0)).join("").toUpperCase();
  return <span className={`${size} grid shrink-0 place-items-center rounded-full bg-gold/15 text-xs font-semibold text-gold-2 ring-1 ring-gold/30`} data-no-translate>{initials}</span>;
}
function pageTitle(pathname: string) {
  if (pathname.startsWith("/admin/settings/profile")) return "Profile settings";
  let matched: { href: string; label: string } | undefined;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if ((pathname === item.href || pathname.startsWith(`${item.href}/`)) && (!matched || item.href.length > matched.href.length)) {
        matched = item;
      }
    }
  }
  return matched?.label ?? "Administration";
}
function MenuIcon() { return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 7h16M4 12h16M4 17h16" /></svg>; }
function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z", spark: "m12 3 1.3 5.7L19 10l-5.7 1.3L12 17l-1.3-5.7L5 10l5.7-1.3L12 3Z", chat: "M5 5h14v10H9l-4 4V5Z", calendar: "M5 6h14v14H5zM8 3v6M16 3v6M5 10h14", alert: "M12 3 2.5 20h19L12 3Zm0 6v5m0 3v.1", car: "M4 16V9l2-4h12l2 4v7M4 12h16M7 16v3m10-3v3M7.5 9h9", tag: "M4 4h7l9 9-7 7-9-9V4Zm4 4h.1", file: "M6 3h8l4 4v14H6V3Zm8 0v5h5M9 13h6M9 17h6", chart: "M4 20V10M10 20V4M16 20v-7M22 20H2", book: "M4 5a3 3 0 0 1 3-2h5v17H7a3 3 0 0 0-3 2V5Zm16 0a3 3 0 0 0-3-2h-5v17h5a3 3 0 0 1 3 2V5Z", pen: "m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Zm9-12 3.5 3.5", plug: "M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-6 6v4", template: "M4 5h16v14H4zM4 10h16M9 10v9", rules: "M4 6h8M4 12h12M4 18h5M16 6h4M20 12h0M13 18h7", tune: "M4 7h4m4 0h8M4 17h10m4 0h2M8 4v6M14 14v6", history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2", users: "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-1a3 3 0 1 0 0-6m5 17v-2a4 4 0 0 0-3-3.9",
  };
  return <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.grid} /></svg>;
}
