export type Provider = "whatsapp" | "anthropic" | "stripe";

export const WHATSAPP_GRAPH_VERSION = "v25.0";
export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-5";

export const CLAUDE_MODEL_OPTIONS = [
  "claude-sonnet-5",
  "claude-opus-5",
  "claude-sonnet-4-6",
  "claude-opus-4-8",
  "claude-haiku-4-5",
] as const;

export const PROVIDER_KEYS = {
  whatsapp: [
    "access_token",
    "phone_number_id",
    "waba_id",
    "app_secret",
    "webhook_verify_token",
    "owner_phone_number",
  ],
  anthropic: ["api_key", "model_id"],
  stripe: ["secret_key", "webhook_signing_secret"],
} as const;

export const REQUIRED_KEYS_FOR_CONFIGURED = {
  whatsapp: [
    "access_token",
    "phone_number_id",
    "waba_id",
    "app_secret",
    "webhook_verify_token",
  ],
  anthropic: ["api_key"],
  stripe: ["secret_key", "webhook_signing_secret"],
} as const;
