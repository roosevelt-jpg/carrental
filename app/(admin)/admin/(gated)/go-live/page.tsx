import { getGoLiveChecklist } from "@/lib/setup/go-live-checklist";

export default async function GoLivePage() {
  const items = await getGoLiveChecklist();
  const doneCount = items.filter((i) => i.done).length;

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Launch readiness</p>
      <h1 className="mt-2 font-serif text-4xl">Go-live checklist</h1>
      <p className="mt-3 text-muted">
        {doneCount}/{items.length} complete. Add API keys and finish Meta templates before UAT.
      </p>
      <ul className="mt-8 space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-4 rounded-xl border border-line bg-panel p-5"
          >
            <div>
              <p className={item.done ? "text-cream" : "text-cream/80"}>{item.label}</p>
              {item.detail ? (
                <p className="mt-2 text-sm text-muted">{item.detail}</p>
              ) : null}
            </div>
            <span
              className={`text-xs uppercase tracking-widest ${
                item.done ? "text-ok" : "text-danger"
              }`}
            >
              {item.done ? "Done" : "Todo"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
