import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  extractWebhookData,
  mapDeliveryStatus,
  shouldAdvanceDeliveryStatus,
  verifyMetaSignature,
} from "@/app/api/webhooks/whatsapp/route";
import { validatePaidCheckout } from "@/lib/agent/tools/create-booking";
import { isWithinCustomerServiceWindow } from "@/lib/integrations/whatsapp-messaging";

describe("production safety contracts", () => {
  it("accepts only correctly signed Meta webhook bodies", () => {
    const body = JSON.stringify({ object: "whatsapp_business_account" });
    const secret = "app-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(verifyMetaSignature(body, signature, secret)).toBe(true);
    expect(verifyMetaSignature(`${body}x`, signature, secret)).toBe(false);
  });

  it("extracts messages and delivery statuses from one webhook", () => {
    const result = extractWebhookData({
      entry: [{
        changes: [{
          value: {
            messages: [{ id: "wamid.in", from: "971500000000", timestamp: "1", type: "text" }],
            statuses: [{ id: "wamid.out", status: "delivered" }],
          },
        }],
      }],
    });
    expect(result.messages).toHaveLength(1);
    expect(result.statuses).toHaveLength(1);
    expect(mapDeliveryStatus("delivered")).toBe("DELIVERED");
    expect(shouldAdvanceDeliveryStatus("READ", "DELIVERED")).toBe(false);
    expect(shouldAdvanceDeliveryStatus("SENT", "DELIVERED")).toBe(true);
  });

  it("enforces the WhatsApp 24-hour customer service window", () => {
    const now = new Date("2026-08-22T12:00:00.000Z");
    expect(isWithinCustomerServiceWindow(new Date("2026-08-21T12:00:01.000Z"), now)).toBe(true);
    expect(isWithinCustomerServiceWindow(new Date("2026-08-21T11:59:59.000Z"), now)).toBe(false);
    expect(isWithinCustomerServiceWindow(null, now)).toBe(false);
  });

  it("rejects unverified, mismatched, or unpaid checkout fulfillment", () => {
    const valid = {
      expectedSessionId: "cs_123",
      actualSessionId: "cs_123",
      expectedAmountMinor: 250000,
      actualAmountMinor: 250000,
      currency: "aed",
      paymentStatus: "paid",
    };
    expect(validatePaidCheckout(valid)).toBeNull();
    expect(validatePaidCheckout({ ...valid, actualSessionId: "cs_other" })).toMatch(/belong/);
    expect(validatePaidCheckout({ ...valid, actualAmountMinor: 1 })).toMatch(/amount/);
    expect(validatePaidCheckout({ ...valid, paymentStatus: "unpaid" })).toMatch(/not paid/);
  });
});
