import { describe, expect, it } from "vitest";
import type { Provider } from "@/lib/integrations/constants";
import { isProviderConfigured, testConnection } from "@/lib/settings/settings-service";

describe("real provider connectivity", () => {
  for (const provider of ["whatsapp", "anthropic", "stripe"] as Provider[]) {
    it(`connects to the configured ${provider} API`, async (context) => {
      if (!(await isProviderConfigured(provider))) {
        context.skip(`No ${provider} credentials are configured in the integration_credentials table`);
      }
      const result = await testConnection(provider);
      expect(result.ok, result.detail).toBe(true);
    });
  }
});
