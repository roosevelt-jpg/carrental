import { beforeAll, describe, expect, it } from "vitest";
import { decryptPii, encryptPii, piiLookupHash } from "@/lib/privacy/pii";

describe("PII encryption envelopes", () => {
  beforeAll(() => { process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64"); });
  it("stores randomized ciphertext while preserving deterministic lookup hashes", () => {
    const value = "+971500000000";
    const first = encryptPii(value); const second = encryptPii(value);
    expect(first).toMatch(/^enc:v1:/); expect(second).not.toBe(first);
    expect(first).not.toContain(value); expect(decryptPii(first)).toBe(value);
    expect(piiLookupHash(value)).toBe(piiLookupHash(value));
  });
});
