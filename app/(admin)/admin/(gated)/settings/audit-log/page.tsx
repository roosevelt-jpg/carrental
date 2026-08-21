import { prisma } from "@/lib/db";

export default async function AuditLogPage() {
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="font-serif text-4xl">Audit log</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Who changed policies, escalation rules, integration credentials, and outcome tags.
      </p>
      <ul className="mt-8 space-y-3">
        {entries.length === 0 ? (
          <li className="text-muted">No audited changes yet.</li>
        ) : (
          entries.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-line bg-panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-gold-2">{entry.summary}</p>
                <span className="text-xs text-muted">
                  {entry.createdAt.toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-xs uppercase tracking-widest text-muted">
                {entry.entityType} · {entry.action}
                {entry.actorEmail ? ` · ${entry.actorEmail}` : " · system"}
              </p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
