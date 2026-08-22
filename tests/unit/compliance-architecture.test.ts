import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  requiredAuthoritativeTools,
  requiresAuthoritativeTool,
} from "@/lib/agent/orchestrator";
import { isGoLiveReady } from "@/lib/setup/go-live-checklist";

describe("build-contract compliance", () => {
  it("seeds only structural escalation rules", () => {
    const seed = readFileSync("prisma/seed.ts", "utf8");
    expect(seed).toContain("ESCALATION_RULES");
    expect(seed).not.toContain("MESSAGE_TEMPLATES");
    expect(seed).not.toContain("cmsSettings");
    expect(seed).not.toMatch(/vehicle\.(create|upsert)|customer\.(create|upsert)|quote\.(create|upsert)/i);
  });

  it("starts CMS business fields empty", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    for (const field of [
      "businessName", "businessDescription", "city", "country", "timezone", "currency",
      "seoTitle", "heroTitle", "agentTone", "salesScript", "agentGreeting",
    ]) {
      expect(schema).toMatch(new RegExp(`${field}\\s+String\\s+@default\\(\"\"\\)`));
    }
  });

  it("routes each factual category to a relevant database-backed tool", () => {
    expect(requiredAuthoritativeTools("What is the price?")).toContain("get_vehicle_pricing");
    expect(requiredAuthoritativeTools("How many seats and what transmission?")).toContain("get_fleet_catalog");
    expect(requiredAuthoritativeTools("Where is your business located?")).toContain("get_business_profile");
    expect(requiredAuthoritativeTools("What time do you close today?")).toContain("get_business_time");
    expect(requiredAuthoritativeTools("What is the cancellation policy?")).toContain("get_policy");
    expect(requiresAuthoritativeTool("What color is that model?")).toBe(true);
  });

  it("contains no shipped fake-mode switch", () => {
    const productionFiles = [
      "lib/integrations/whatsapp-client.ts",
      "lib/integrations/claude-client.ts",
      "lib/integrations/stripe-client.ts",
    ];
    for (const file of productionFiles) {
      expect(readFileSync(file, "utf8")).not.toMatch(/mock_mode|fake_mode|stub_response/i);
    }
  });

  it("requires every mandatory launch check but does not block on optional observability", () => {
    expect(isGoLiveReady([
      { id: "required", label: "Required", done: true },
      { id: "optional", label: "Optional", done: false, required: false },
    ])).toBe(true);
    expect(isGoLiveReady([{ id: "required", label: "Required", done: false }])).toBe(false);
  });
});
