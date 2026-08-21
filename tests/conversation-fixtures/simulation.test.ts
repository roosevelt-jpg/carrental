import { describe, expect, it } from "vitest";
import {
  CONVERSATION_FIXTURES,
  expectedEscalationReason,
} from "../conversation-fixtures";
import { matchEscalationHint } from "@/lib/agent/escalation-hint";

describe("fixture / hint alignment", () => {
  it("escalation fixtures have matching deterministic hints where language is clear", () => {
    for (const fixture of CONVERSATION_FIXTURES) {
      if (!fixture.expect.mustEscalate || !fixture.expect.reasonCode) continue;
      const customerText = fixture.turns.find((t) => t.role === "customer")?.text;
      if (!customerText) continue;
      const hint = matchEscalationHint(customerText);
      if (hint) {
        expect(hint).toBe(expectedEscalationReason(fixture.id));
      }
    }
  });

  it("fleet inquiry must not invent price and must call catalog tool", () => {
    const fleet = CONVERSATION_FIXTURES.find((f) => f.id === "fleet-inquiry");
    expect(fleet?.expect.mustNotInventPrice).toBe(true);
    expect(fleet?.expect.requiredTools).toContain("get_fleet_catalog");
  });
});
