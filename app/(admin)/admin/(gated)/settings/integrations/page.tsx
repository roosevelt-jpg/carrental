import { IntegrationsPanel } from "@/components/admin/integrations-panel";
import {
  CLAUDE_MODEL_OPTIONS,
  DEFAULT_CLAUDE_MODEL,
} from "@/lib/integrations/constants";
import {
  getAppBaseUrl,
  getStripeWebhookUrl,
  getWhatsAppWebhookUrl,
} from "@/lib/env";
import {
  isProviderConfigured,
  listMaskedCredentials,
} from "@/lib/settings/settings-service";
import { getStorageBackend } from "@/lib/storage/object-storage";

export default async function IntegrationsPage() {
  const [whatsapp, anthropic, stripe] = await Promise.all([
    listMaskedCredentials("whatsapp"),
    listMaskedCredentials("anthropic"),
    listMaskedCredentials("stripe"),
  ]);
  const [whatsappOk, anthropicOk, stripeOk] = await Promise.all([
    isProviderConfigured("whatsapp"),
    isProviderConfigured("anthropic"),
    isProviderConfigured("stripe"),
  ]);
  const storage = getStorageBackend();
  const storageLabel = storage === "vercel-blob"
    ? "Vercel Blob"
    : storage === "s3"
      ? "S3-compatible object storage"
      : "local development disk";

  return (
    <div>
      <h1 className="font-serif text-4xl">Integrations</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Keys are encrypted at rest in Postgres. After save, only the last four
        characters are shown. Photos use {storageLabel}.
      </p>
      <p className="mt-2 text-xs text-muted">Public origin: {getAppBaseUrl()}</p>
      <IntegrationsPanel
        whatsappWebhookUrl={getWhatsAppWebhookUrl()}
        stripeWebhookUrl={getStripeWebhookUrl()}
        models={[...CLAUDE_MODEL_OPTIONS]}
        defaultModel={DEFAULT_CLAUDE_MODEL}
        providers={{
          whatsapp: { configured: whatsappOk, fields: whatsapp },
          anthropic: { configured: anthropicOk, fields: anthropic },
          stripe: { configured: stripeOk, fields: stripe },
        }}
      />
    </div>
  );
}
