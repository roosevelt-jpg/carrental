import { describe, expect, it } from "vitest";
import {
  CONVERSATION_FIXTURES,
  expectedEscalationReason,
} from "../conversation-fixtures";

describe("conversation fixtures", () => {
  it("covers the core escalation red-team cases", () => {
    const ids = CONVERSATION_FIXTURES.map((f) => f.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "refund-request",
        "price-negotiation",
        "explicit-human",
        "out-of-scope",
        "fee-dispute",
        "fleet-inquiry",
      ]),
    );
  });

  it("maps escalation fixtures to reason codes", () => {
    expect(expectedEscalationReason("refund-request")).toBe("refund_request");
    expect(expectedEscalationReason("explicit-human")).toBe("explicit_human_request");
    expect(expectedEscalationReason("fleet-inquiry")).toBeNull();
  });

  it("requires tool use for pricing inquiries", () => {
    const fleet = CONVERSATION_FIXTURES.find((f) => f.id === "fleet-inquiry");
    expect(fleet?.expect.mustNotInventPrice).toBe(true);
    expect(fleet?.expect.requiredTools).toContain("get_fleet_catalog");
  });
});
