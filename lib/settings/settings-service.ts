import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/settings/encryption";
import {
  DEFAULT_CLAUDE_MODEL,
  PROVIDER_KEYS,
  REQUIRED_KEYS_FOR_CONFIGURED,
  WHATSAPP_GRAPH_VERSION,
  type Provider,
} from "@/lib/integrations/constants";

const CACHE_TTL_MS = 60_000;

type CacheEntry = { value: string | null; expiresAt: number };

const cache = new Map<string, CacheEntry>();

function cacheKey(provider: Provider, key: string) {
  return `${provider}:${key}`;
}

function readCache(provider: Provider, key: string): string | null | undefined {
  const entry = cache.get(cacheKey(provider, key));
  if (!entry) {
    return undefined;
  }
  if (Date.now() > entry.expiresAt) {
    cache.delete(cacheKey(provider, key));
    return undefined;
  }
  return entry.value;
}

function writeCache(provider: Provider, key: string, value: string | null) {
  cache.set(cacheKey(provider, key), {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function invalidateCredentialCache(provider?: Provider) {
  if (!provider) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${provider}:`)) {
      cache.delete(key);
    }
  }
}

export async function getCredential(
  provider: Provider,
  key: string,
): Promise<string | null> {
  const cached = readCache(provider, key);
  if (cached !== undefined) {
    return cached;
  }
  const row = await prisma.integrationCredential.findUnique({
    where: { provider_key: { provider, key } },
  });
  if (!row) {
    writeCache(provider, key, null);
    return null;
  }
  const value = decryptSecret(row.valueEncrypted);
  writeCache(provider, key, value);
  return value;
}

export async function setCredential(
  provider: Provider,
  key: string,
  value: string,
): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Credential value cannot be empty");
  }
  await prisma.integrationCredential.upsert({
    where: { provider_key: { provider, key } },
    create: {
      provider,
      key,
      valueEncrypted: encryptSecret(trimmed),
    },
    update: {
      valueEncrypted: encryptSecret(trimmed),
    },
  });
  writeCache(provider, key, trimmed);
}

export async function isProviderConfigured(provider: Provider): Promise<boolean> {
  const keys = REQUIRED_KEYS_FOR_CONFIGURED[provider];
  for (const key of keys) {
    const value = await getCredential(provider, key);
    if (!value) {
      return false;
    }
  }
  return true;
}

export async function listMaskedCredentials(provider: Provider) {
  const keys = PROVIDER_KEYS[provider];
  const result: Record<string, { configured: boolean; masked: string | null }> =
    {};
  for (const key of keys) {
    const value = await getCredential(provider, key);
    result[key] = {
      configured: Boolean(value),
      masked: value ? maskSecret(value) : null,
    };
  }
  return result;
}

export async function testConnection(
  provider: Provider,
): Promise<{ ok: boolean; detail: string }> {
  let result: { ok: boolean; detail: string };
  try {
    if (provider === "whatsapp") {
      result = await testWhatsApp();
    } else if (provider === "anthropic") {
      result = await testAnthropic();
    } else {
      result = await testStripe();
    }
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown connection error";
    result = { ok: false, detail };
  }
  await prisma.integrationTestResult.upsert({ where: { provider }, create: { provider, ...result }, update: { ...result, testedAt: new Date() } });
  return result;
}

async function testWhatsApp(): Promise<{ ok: boolean; detail: string }> {
  const token = await getCredential("whatsapp", "access_token");
  const phoneNumberId = await getCredential("whatsapp", "phone_number_id");
  if (!token || !phoneNumberId) {
    return { ok: false, detail: "Access token and phone number ID are required" };
  }
  const res = await fetch(
    `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const body = (await res.json()) as { error?: { message?: string }; display_phone_number?: string };
  if (!res.ok) {
    return {
      ok: false,
      detail: body.error?.message ?? `Graph API returned ${res.status}`,
    };
  }
  return {
    ok: true,
    detail: body.display_phone_number
      ? `Connected as ${body.display_phone_number}`
      : "WhatsApp phone number reachable",
  };
}

async function testAnthropic(): Promise<{ ok: boolean; detail: string }> {
  const apiKey = await getCredential("anthropic", "api_key");
  const model =
    (await getCredential("anthropic", "model_id")) ?? DEFAULT_CLAUDE_MODEL;
  if (!apiKey) {
    return { ok: false, detail: "API key is required" };
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    }),
  });
  const body = (await res.json()) as { error?: { message?: string }; id?: string };
  if (!res.ok) {
    return {
      ok: false,
      detail: body.error?.message ?? `Anthropic returned ${res.status}`,
    };
  }
  return { ok: true, detail: `Claude reachable (${model})` };
}

async function testStripe(): Promise<{ ok: boolean; detail: string }> {
  const secretKey = await getCredential("stripe", "secret_key");
  if (!secretKey) {
    return { ok: false, detail: "Secret key is required" };
  }
  const res = await fetch("https://api.stripe.com/v1/balance", {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const body = (await res.json()) as { error?: { message?: string }; object?: string };
  if (!res.ok) {
    return {
      ok: false,
      detail: body.error?.message ?? `Stripe returned ${res.status}`,
    };
  }
  return { ok: true, detail: "Stripe balance endpoint reachable" };
}
