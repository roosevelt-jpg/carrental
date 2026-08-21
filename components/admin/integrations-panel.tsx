"use client";

import { useState } from "react";
import type { Provider } from "@/lib/integrations/constants";

type FieldState = { configured: boolean; masked: string | null };

export function IntegrationsPanel({
  providers,
  whatsappWebhookUrl,
  stripeWebhookUrl,
  models,
  defaultModel,
}: {
  providers: Record<
    Provider,
    { configured: boolean; fields: Record<string, FieldState> }
  >;
  whatsappWebhookUrl: string;
  stripeWebhookUrl: string;
  models: string[];
  defaultModel: string;
}) {
  return (
    <div className="mt-8 grid gap-6">
      <ProviderCard
        provider="whatsapp"
        title="WhatsApp Business Cloud API"
        configured={providers.whatsapp.configured}
        fields={[
          { key: "access_token", label: "Access token", secret: true },
          { key: "phone_number_id", label: "Phone number ID" },
          { key: "waba_id", label: "WhatsApp Business Account ID" },
          { key: "app_secret", label: "App secret", secret: true },
          { key: "webhook_verify_token", label: "Webhook verify token" },
        ]}
        masked={providers.whatsapp.fields}
        extra={
          <CopyField label="Webhook callback URL" value={whatsappWebhookUrl} />
        }
      />
      <ProviderCard
        provider="anthropic"
        title="Anthropic (Claude)"
        configured={providers.anthropic.configured}
        fields={[
          { key: "api_key", label: "API key", secret: true },
          {
            key: "model_id",
            label: "Model ID",
            options: models,
            placeholder: defaultModel,
          },
        ]}
        masked={providers.anthropic.fields}
      />
      <ProviderCard
        provider="stripe"
        title="Stripe"
        configured={providers.stripe.configured}
        fields={[
          { key: "secret_key", label: "Secret key", secret: true },
          { key: "webhook_signing_secret", label: "Webhook signing secret", secret: true },
        ]}
        masked={providers.stripe.fields}
        extra={<CopyField label="Stripe webhook URL" value={stripeWebhookUrl} />}
      />
    </div>
  );
}

function ProviderCard({
  provider,
  title,
  configured,
  fields,
  masked,
  extra,
}: {
  provider: Provider;
  title: string;
  configured: boolean;
  fields: Array<{
    key: string;
    label: string;
    secret?: boolean;
    options?: string[];
    placeholder?: string;
  }>;
  masked: Record<string, FieldState>;
  extra?: React.ReactNode;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/admin/integrations/save", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, values }),
    });
    const body = await res.json();
    setBusy(false);
    setStatus(res.ok ? "Saved" : body.error ?? "Save failed");
  }

  async function test() {
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/admin/integrations/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const body = await res.json();
    setBusy(false);
    setStatus(body.detail ?? (res.ok ? "Connected" : "Test failed"));
  }

  return (
    <section className="rounded-xl border border-line bg-panel p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl">{title}</h2>
        <span className={`text-xs uppercase tracking-widest ${configured ? "text-ok" : "text-danger"}`}>
          {configured ? "Connected" : "Not connected"}
        </span>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key}>
            <label htmlFor={`${provider}-${field.key}`}>{field.label}</label>
            {field.options ? (
              <select
                id={`${provider}-${field.key}`}
                value={values[field.key] ?? ""}
                onChange={(e) =>
                  setValues((current) => ({ ...current, [field.key]: e.target.value }))
                }
              >
                <option value="">{field.placeholder ?? "Select"}</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`${provider}-${field.key}`}
                type={field.secret ? "password" : "text"}
                autoComplete="off"
                placeholder={masked[field.key]?.masked ?? ""}
                value={values[field.key] ?? ""}
                onChange={(e) =>
                  setValues((current) => ({ ...current, [field.key]: e.target.value }))
                }
              />
            )}
          </div>
        ))}
      </div>
      {extra ? <div className="mt-4">{extra}</div> : null}
      <div className="mt-6 flex items-center gap-3">
        <button className="btn-gold" type="button" disabled={busy} onClick={save}>
          Save
        </button>
        <button className="btn-ghost" type="button" disabled={busy} onClick={test}>
          Test connection
        </button>
        {status ? <p className="text-sm text-muted">{status}</p> : null}
      </div>
    </section>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label>{label}</label>
      <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} />
    </div>
  );
}
