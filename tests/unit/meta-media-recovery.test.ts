import { describe, expect, it } from "vitest";
import { isExpiredMediaError, MetaApiError } from "@/lib/integrations/whatsapp-client";

describe("Meta media expiry classification", () => {
  it("retries only known expired or unavailable media responses", () => {
    expect(isExpiredMediaError(new MetaApiError("media expired", 400, 131053))).toBe(true);
    expect(isExpiredMediaError(new MetaApiError("not found", 400, 100, 33))).toBe(true);
    expect(isExpiredMediaError(new MetaApiError("rate limited", 429, 4))).toBe(false);
  });
});
