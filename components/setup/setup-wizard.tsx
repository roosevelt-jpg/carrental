"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SetupStatus } from "@/lib/setup/status";

const STEPS = [
  "Owner account",
  "WhatsApp",
  "Claude",
  "Stripe",
  "First vehicle",
  "Escalation contact",
  "Done",
];

export function SetupWizard({
  initial,
  models,
  defaultModel,
}: {
  initial: SetupStatus;
  models: string[];
  defaultModel: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const step = status.currentStep;

  async function refresh() {
    const res = await fetch("/api/admin/setup/status");
    const next = (await res.json()) as SetupStatus;
    setStatus(next);
    if (next.complete) {
      router.push("/admin/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="mt-10 rounded-2xl border border-line bg-panel p-8">
      <ol className="mb-8 flex flex-wrap gap-2 text-[11px] uppercase tracking-widest text-muted">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={index === step ? "text-gold" : index < step ? "text-cream/70" : ""}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {step === 0 ? (
        <AccountStep
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onDone={refresh}
        />
      ) : null}
      {step === 1 ? (
        <WhatsAppStep
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          webhookUrl={status.whatsappWebhookUrl}
          onDone={refresh}
        />
      ) : null}
      {step === 2 ? (
        <ClaudeStep
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          models={models}
          defaultModel={defaultModel}
          onDone={refresh}
        />
      ) : null}
      {step === 3 ? (
        <StripeStep
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          webhookUrl={status.stripeWebhookUrl}
          onDone={refresh}
        />
      ) : null}
      {step === 4 ? (
        <VehicleStep
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onDone={refresh}
        />
      ) : null}
      {step === 5 ? (
        <OwnerPhoneStep
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onDone={refresh}
        />
      ) : null}
      {step >= 6 ? (
        <div>
          <h2 className="font-serif text-3xl">Complete launch readiness</h2>
          <p className="mt-3 text-muted">
            Core onboarding is complete. {status.readinessDone}/{status.readinessTotal} required go-live checks currently pass. Finish the checklist and owner UAT before activation is marked ready.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn-gold" href="/admin/go-live">Open go-live checklist</Link>
            <Link className="btn-ghost" href="/admin/dashboard">Continue configuring</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AccountStep({
  busy,
  setBusy,
  setError,
  onDone,
}: StepProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await run(setBusy, setError, async () => {
          const res = await fetch("/api/admin/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          await assertOk(res);
          await onDone();
        });
      }}
    >
      <h2 className="font-serif text-3xl">Create the owner account</h2>
      <div>
        <label htmlFor="setup-email">Email</label>
        <input id="setup-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label htmlFor="setup-password">Password</label>
        <input
          id="setup-password"
          type="password"
          required
          minLength={10}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button className="btn-gold" disabled={busy} type="submit">
        Create account
      </button>
    </form>
  );
}

function WhatsAppStep({
  busy,
  setBusy,
  setError,
  webhookUrl,
  onDone,
}: StepProps & { webhookUrl: string }) {
  const verifyToken = useMemo(() => randomToken(), []);
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [appSecret, setAppSecret] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await run(setBusy, setError, async () => {
          await saveProvider("whatsapp", {
            access_token: accessToken,
            phone_number_id: phoneNumberId,
            waba_id: wabaId,
            app_secret: appSecret,
            webhook_verify_token: verifyToken,
          });
          await testProvider("whatsapp");
          await onDone();
        });
      }}
    >
      <h2 className="font-serif text-3xl">Connect WhatsApp</h2>
      <p className="text-sm text-muted">
        Paste this callback URL and verify token into Meta&apos;s App Dashboard,
        then enter the Cloud API credentials.
      </p>
      <CopyField label="Callback URL" value={webhookUrl} />
      <CopyField label="Verify token" value={verifyToken} />
      <Field label="Access token" value={accessToken} onChange={setAccessToken} secret />
      <Field label="Phone number ID" value={phoneNumberId} onChange={setPhoneNumberId} />
      <Field label="WhatsApp Business Account ID" value={wabaId} onChange={setWabaId} />
      <Field label="App secret" value={appSecret} onChange={setAppSecret} secret />
      <div className="flex flex-wrap gap-3">
        <button className="btn-gold" disabled={busy} type="submit">
          Save and test
        </button>
      </div>
    </form>
  );
}

function ClaudeStep({
  busy,
  setBusy,
  setError,
  models,
  defaultModel,
  onDone,
}: StepProps & { models: string[]; defaultModel: string }) {
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState(defaultModel);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await run(setBusy, setError, async () => {
          await saveProvider("anthropic", { api_key: apiKey, model_id: modelId });
          await testProvider("anthropic");
          await onDone();
        });
      }}
    >
      <h2 className="font-serif text-3xl">Connect Claude</h2>
      <Field label="API key" value={apiKey} onChange={setApiKey} secret />
      <div>
        <label htmlFor="model">Model ID</label>
        <select id="model" value={modelId} onChange={(e) => setModelId(e.target.value)}>
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="btn-gold" disabled={busy} type="submit">
          Save and test
        </button>
      </div>
    </form>
  );
}

function StripeStep({
  busy,
  setBusy,
  setError,
  webhookUrl,
  onDone,
}: StepProps & { webhookUrl: string }) {
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await run(setBusy, setError, async () => {
          await saveProvider("stripe", {
            secret_key: secretKey,
            webhook_signing_secret: webhookSecret,
          });
          await testProvider("stripe");
          await onDone();
        });
      }}
    >
      <h2 className="font-serif text-3xl">Connect Stripe</h2>
      <CopyField label="Stripe webhook URL" value={webhookUrl} />
      <Field label="Secret key" value={secretKey} onChange={setSecretKey} secret />
      <Field
        label="Webhook signing secret"
        value={webhookSecret}
        onChange={setWebhookSecret}
        secret
      />
      <div className="flex flex-wrap gap-3">
        <button className="btn-gold" disabled={busy} type="submit">
          Save and test
        </button>
      </div>
    </form>
  );
}

function VehicleStep({ busy, setBusy, setError, onDone }: StepProps) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [category, setCategory] = useState("");
  const [year, setYear] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [depositAmount, setDepositAmount] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await run(setBusy, setError, async () => {
          const res = await fetch("/api/admin/vehicles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              make,
              model,
              category,
              year,
              dailyRate,
              depositAmount,
            }),
          });
          await assertOk(res);
          await onDone();
        });
      }}
    >
      <h2 className="font-serif text-3xl">Add your first vehicle</h2>
      <p className="text-sm text-muted">
        Enter a real active vehicle from the fleet. This is required before the sales agent can operate.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Make" value={make} onChange={setMake} />
        <Field label="Model" value={model} onChange={setModel} />
        <Field label="Category" value={category} onChange={setCategory} />
        <Field label="Year" value={year} onChange={setYear} />
        <Field label="Daily rate" value={dailyRate} onChange={setDailyRate} />
        <Field label="Deposit amount" value={depositAmount} onChange={setDepositAmount} />
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="btn-gold" disabled={busy} type="submit">
          Add vehicle
        </button>
      </div>
    </form>
  );
}

function OwnerPhoneStep({ busy, setBusy, setError, onDone }: StepProps) {
  const [phone, setPhone] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await run(setBusy, setError, async () => {
          await saveProvider("whatsapp", { owner_phone_number: phone });
          await onDone();
        });
      }}
    >
      <h2 className="font-serif text-3xl">Escalation contact</h2>
      <p className="text-sm text-muted">
        The owner WhatsApp number that receives REF-coded escalation messages.
      </p>
      <Field label="Owner WhatsApp number" value={phone} onChange={setPhone} />
      <div className="flex flex-wrap gap-3">
        <button className="btn-gold" disabled={busy} type="submit">
          Finish setup
        </button>
      </div>
    </form>
  );
}

type StepProps = {
  busy: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
  onDone: () => Promise<void>;
};

function Field({
  label,
  value,
  onChange,
  secret,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  secret?: boolean;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={secret ? "password" : "text"}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
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

async function saveProvider(provider: string, values: Record<string, string>) {
  const res = await fetch("/api/admin/integrations/save", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, values }),
  });
  await assertOk(res);
}

async function testProvider(provider: string) {
  const res = await fetch("/api/admin/integrations/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider }),
  });
  await assertOk(res);
}

async function assertOk(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? body.detail ?? "Request failed");
  }
}

async function run(
  setBusy: (value: boolean) => void,
  setError: (value: string | null) => void,
  fn: () => Promise<void>,
) {
  setBusy(true);
  setError(null);
  try {
    await fn();
  } catch (error) {
    setError(error instanceof Error ? error.message : "Something went wrong");
  } finally {
    setBusy(false);
  }
}

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
