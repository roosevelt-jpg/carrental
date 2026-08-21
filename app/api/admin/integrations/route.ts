import { NextResponse } from "next/server";
import {
  isProviderConfigured,
  listMaskedCredentials,
} from "@/lib/settings/settings-service";
import { isSession, requireSession } from "@/lib/auth/guards";
import type { Provider } from "@/lib/integrations/constants";

const PROVIDERS: Provider[] = ["whatsapp", "anthropic", "stripe"];

export async function GET() {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) {
    return session;
  }

  const providers = await Promise.all(
    PROVIDERS.map(async (provider) => ({
      provider,
      configured: await isProviderConfigured(provider),
      fields: await listMaskedCredentials(provider),
    })),
  );

  return NextResponse.json({ providers });
}
