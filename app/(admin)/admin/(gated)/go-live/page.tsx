import { getGoLiveChecklist, isGoLiveReady } from "@/lib/setup/go-live-checklist";
import {
  getAppBaseUrl,
  getStripeWebhookUrl,
  getWhatsAppWebhookUrl,
} from "@/lib/env";
import { getStorageBackend } from "@/lib/storage/object-storage";
import { prisma } from "@/lib/db";
import { ActivationConfirmations } from "@/components/admin/activation-confirmations";

export default async function GoLivePage() {
  const [items, review] = await Promise.all([
    getGoLiveChecklist(),
    prisma.activationReview.upsert({ where: { id: "primary" }, create: { id: "primary" }, update: {} }),
  ]);
  const doneCount = items.filter((i) => i.done).length;
  const requiredItems = items.filter((item) => item.required !== false);
  const requiredDone = requiredItems.filter((item) => item.done).length;
  const activationReady = isGoLiveReady(items);
  const storage = getStorageBackend();

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-gold">
        Launch readiness
      </p>
      <h1 className="mt-2 font-serif text-4xl">Go-live checklist</h1>
      <p className="mt-3 text-muted">
        {requiredDone}/{requiredItems.length} required checks complete{doneCount !== requiredDone ? ` · ${doneCount}/${items.length} including optional checks` : ""}. Activation is ready only when every required check and owner confirmation passes.
      </p>

      {activationReady ? (
        <div className="mt-6 rounded-xl border border-ok/40 bg-ok/10 p-5 text-ok">
          Activation ready — every automated check and owner confirmation is complete.
        </div>
      ) : null}

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
              {storage === "s3"
                ? "S3-compatible"
                : "Local fallback (configure S3 before launch)"}
            </dd>
          </div>
        </dl>
      </div>

      <ActivationConfirmations confirmations={[
        { field: "metaWebhookConfirmed", label: "Meta webhook works", detail: "Meta accepted the callback URL and a signed test webhook reached this deployment.", confirmed: review.metaWebhookConfirmed },
        { field: "stripeWebhookConfirmed", label: "Stripe webhook works", detail: "Stripe accepted the endpoint and its signing secret was saved and tested.", confirmed: review.stripeWebhookConfirmed },
        { field: "escalationRulesReviewed", label: "Escalation rules reviewed", detail: "The owner reviewed every enabled rule and its intended handling.", confirmed: review.escalationRulesReviewed },
        { field: "stripeModeReviewed", label: "Stripe mode reviewed", detail: "The owner deliberately selected test mode for UAT or live mode for launch.", confirmed: review.stripeModeReviewed },
        { field: "sentryTestConfirmed", label: "Sentry test received", detail: "After triggering /api/admin/sentry-test, the owner verified that the deliberate error appeared in Sentry.", confirmed: review.sentryTestConfirmed },
        { field: "ownerUatSignedOff", label: "End-to-end UAT signed off", detail: "A real WhatsApp test covered tool answers, escalation, quote, Stripe payment, and confirmed booking.", confirmed: review.ownerUatSignedOff },
      ]} />

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
              {item.required === false ? <p className="mt-1 text-xs uppercase tracking-widest text-muted">Optional</p> : null}
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
