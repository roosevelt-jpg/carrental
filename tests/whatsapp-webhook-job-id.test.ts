import { describe, expect, it } from "vitest";
import { webhookJobId } from "@/app/api/webhooks/whatsapp/route";

describe("WhatsApp webhook BullMQ job IDs", () => {
  it("never includes BullMQ-prohibited colons", () => {
    const id = webhookJobId("database-id", "status:wamid.example:delivered");
    expect(id).not.toContain(":");
    expect(id).toMatch(/^wa-[a-f0-9]{64}$/);
  });

  it("is deterministic for normal delivery and unique for recovery", () => {
    const first = webhookJobId("database-id", "wamid.example");
    const second = webhookJobId("database-id", "wamid.example");
    const recovery = webhookJobId("database-id", "wamid.example", true);

    expect(first).toBe(second);
    expect(recovery).toContain("-recovery-");
    expect(recovery).not.toContain(":");
  });
});
