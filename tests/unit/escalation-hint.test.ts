import { describe, expect, it } from "vitest";
import { matchEscalationHint } from "@/lib/agent/escalation-hint";

describe("matchEscalationHint", () => {
  it("detects refund language", () => {
    expect(matchEscalationHint("Can I get my deposit back?")).toBe("refund_request");
  });

  it("detects human request", () => {
    expect(matchEscalationHint("Let me speak to someone")).toBe("explicit_human_request");
  });

  it("returns null for normal fleet inquiry", () => {
    expect(
      matchEscalationHint("Do you have an SUV available next weekend?"),
    ).toBeNull();
  });
});
