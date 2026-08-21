import Link from "next/link";
import type { ReactNode } from "react";
import type { SessionPayload } from "@/lib/auth/session";
import { logout } from "@/app/(admin)/admin/actions";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/go-live", label: "Go-live" },
  { href: "/admin/content", label: "Content studio" },
  { href: "/admin/digest", label: "Weekly digest" },
  { href: "/admin/fleet", label: "Fleet" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/policies", label: "Policies" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/conversations", label: "Conversations" },
  { href: "/admin/escalations", label: "Escalations" },
  { href: "/admin/settings/integrations", label: "Integrations" },
  { href: "/admin/settings/message-templates", label: "Message templates" },
  { href: "/admin/settings/escalation-rules", label: "Escalation rules" },
  { href: "/admin/settings/audit-log", label: "Audit log" },
  { href: "/admin/settings/fine-tuning", label: "Fine-tuning" },
  { href: "/admin/settings/users", label: "Users" },
];

export function AppShell({
  session,
  children,
}: {
  session: SessionPayload;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-panel px-5 py-6 lg:border-b-0 lg:border-r lg:py-8 flex flex-col">
        <p className="font-serif text-2xl tracking-wide text-gold-2">Atelier</p>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">
          Fleet admin
        </p>
        <nav className="mt-6 flex gap-1 overflow-x-auto pb-2 text-sm lg:mt-10 lg:flex-col lg:overflow-visible lg:pb-0">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-cream/80 hover:bg-panel-2 hover:text-gold-2"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 text-xs text-muted lg:mt-auto">
          <p>{session.email}</p>
          <p className="mt-1 uppercase tracking-wider">{session.role}</p>
          <form action={logout}>
            <button type="submit" className="mt-4 text-gold hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="px-5 py-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
