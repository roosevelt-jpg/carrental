function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getAppBaseUrl(): string {
  const configuredUrl = validHttpUrl(process.env.APP_BASE_URL);
  if (configuredUrl) {
    return configuredUrl;
  }
  // Vercel production / preview fallbacks when APP_BASE_URL is not set yet
  const productionUrl = validHttpUrl(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
  );
  if (productionUrl) {
    return productionUrl;
  }
  const previewUrl = validHttpUrl(
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  );
  if (previewUrl) {
    return previewUrl;
  }
  return "http://localhost:3000";
}

function validHttpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getWhatsAppWebhookUrl(): string {
  return `${getAppBaseUrl()}/api/webhooks/whatsapp`;
}

export function getStripeWebhookUrl(): string {
  return `${getAppBaseUrl()}/api/webhooks/stripe`;
}

export function getSessionSecret(): string {
  return required("SESSION_SECRET");
}

export function getEncryptionKey(): Buffer {
  const raw = required("ENCRYPTION_KEY");
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const fromBase64 = Buffer.from(raw, "base64");
  if (fromBase64.length === 32) {
    return fromBase64;
  }
  throw new Error(
    "ENCRYPTION_KEY must be 32 bytes (64 hex characters or base64)",
  );
}

export function getDatabaseUrl(): string {
  return required("DATABASE_URL");
}

export function getRedisUrl(): string {
  return required("REDIS_URL");
}
