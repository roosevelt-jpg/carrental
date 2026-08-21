import { IntegrationsPanel } from "@/components/admin/integrations-panel";
import {
  CLAUDE_MODEL_OPTIONS,
  DEFAULT_CLAUDE_MODEL,
} from "@/lib/integrations/constants";
import { getAppBaseUrl } from "@/lib/env";
import { isProviderConfigured, listMaskedCredentials } from "@/lib/settings/settings-service";

export default async function IntegrationsPage() {
  const base = getAppBaseUrl();
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

  return (
    <div>
      <h1 className="font-serif text-4xl">Integrations</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Keys are encrypted at rest. After save, only the last four characters are shown.
      </p>
      <IntegrationsPanel
        whatsappWebhookUrl={`${base}/api/webhooks/whatsapp`}
        stripeWebhookUrl={`${base}/api/webhooks/stripe`}
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
