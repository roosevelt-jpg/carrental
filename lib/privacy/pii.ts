import { createHash } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/settings/encryption";

const PREFIX = "enc:v1:";

export function encryptPii(value: string | null | undefined) {
  if (value == null || value === "") return value ?? null;
  if (value.startsWith(PREFIX)) return value;
  return `${PREFIX}${encryptSecret(value)}`;
}

export function decryptPii(value: string | null | undefined) {
  if (value == null || value === "") return value ?? null;
  if (!value.startsWith(PREFIX)) return value;
  return decryptSecret(value.slice(PREFIX.length));
}

export function piiLookupHash(value: string) {
  return createHash("sha256").update(value.trim()).digest("hex");
}
