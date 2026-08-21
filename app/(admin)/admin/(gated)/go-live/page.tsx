import { getGoLiveChecklist } from "@/lib/setup/go-live-checklist";
import {
  getAppBaseUrl,
  getStripeWebhookUrl,
  getWhatsAppWebhookUrl,
} from "@/lib/env";
import { getStorageBackend } from "@/lib/storage/object-storage";

export default async function GoLivePage() {
  const items = await getGoLiveChecklist();
  const doneCount = items.filter((i) => i.done).length;
  const storage = getStorageBackend();

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-gold">
        Launch readiness
      </p>
      <h1 className="mt-2 font-serif text-4xl">Go-live checklist</h1>
      <p className="mt-3 text-muted">
        {doneCount}/{items.length} complete. Add API keys and finish Meta
        templates before UAT.
      </p>

      <div className="mt-8 rounded-xl border border-line bg-panel p-5 text-sm">
        <p className="text-xs uppercase tracking-widest text-muted">
          End-to-end wiring
        </p>
        <dl className="mt-4 space-y-3 text-cream/90">
          <div>
            <dt className="text-muted">Public origin</dt>
            <dd className="break-all font-mono text-xs">{getAppBaseUrl()}</dd>
          </div>
          <div>
            <dt className="text-muted">WhatsApp webhook</dt>
            <dd className="break-all font-mono text-xs">
              {getWhatsAppWebhookUrl()}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Stripe webhook</dt>
            <dd className="break-all font-mono text-xs">
              {getStripeWebhookUrl()}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Photo storage</dt>
            <dd>
              {storage === "vercel-blob"
                ? "Vercel Blob"
                : storage === "s3"
                  ? "S3-compatible"
                  : "Local fallback (set BLOB_READ_WRITE_TOKEN on Vercel)"}
            </dd>
          </div>
        </dl>
      </div>

      <ul className="mt-8 space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-4 rounded-xl border border-line bg-panel p-5"
          >
            <div>
              <p className={item.done ? "text-cream" : "text-cream/80"}>
                {item.label}
              </p>
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
