import { describe, expect, it } from "vitest";
import { computeQuotePricing } from "@/lib/agent/pricing";
import { daysBetween, parseDateOnly, rangesOverlap } from "@/lib/agent/dates";
import type { PricingRule, Vehicle } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "v1",
    make: "Test",
    model: "Car",
    category: "SUV",
    year: 2024,
    dailyRate: new Decimal(1000),
    weeklyRate: null,
    depositAmount: new Decimal(2000),
    mediaIds: [],
    photoUrls: [],
    active: true,
    attributes: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

function rule(overrides: Partial<PricingRule>): PricingRule {
  return {
    id: "r1",
    vehicleId: "v1",
    ruleType: "SEASONAL",
    startDate: null,
    endDate: null,
    adjustmentPct: null,
    adjustmentFlat: null,
    ...overrides,
  };
}

describe("dates", () => {
  it("counts nights between dates", () => {
    expect(daysBetween(parseDateOnly("2026-09-01"), parseDateOnly("2026-09-04"))).toBe(3);
  });

  it("detects overlapping ranges", () => {
    const a1 = parseDateOnly("2026-09-01");
    const a2 = parseDateOnly("2026-09-05");
    const b1 = parseDateOnly("2026-09-04");
    const b2 = parseDateOnly("2026-09-08");
    expect(rangesOverlap(a1, a2, b1, b2)).toBe(true);
    expect(
      rangesOverlap(
        parseDateOnly("2026-09-01"),
        parseDateOnly("2026-09-03"),
        parseDateOnly("2026-09-03"),
        parseDateOnly("2026-09-05"),
      ),
    ).toBe(false);
  });
});

describe("computeQuotePricing", () => {
  it("multiplies daily rate by nights with no rules", () => {
    const result = computeQuotePricing(vehicle(), [], "2026-09-01", "2026-09-04");
    expect(result.nights).toBe(3);
    expect(result.totalPrice).toBe(3000);
    expect(result.depositDue).toBe(2000);
  });

  it("applies seasonal percent adjustment when dates overlap", () => {
    const seasonal = rule({
      ruleType: "SEASONAL",
      startDate: parseDateOnly("2026-09-01"),
      endDate: parseDateOnly("2026-09-30"),
      adjustmentPct: new Decimal(10),
    });
    const result = computeQuotePricing(vehicle(), [seasonal], "2026-09-01", "2026-09-04");
    expect(result.totalPrice).toBe(3300);
    expect(result.appliedRules).toHaveLength(1);
  });

  it("applies duration rule only for 7+ night rentals", () => {
    const duration = rule({
      ruleType: "DURATION",
      adjustmentPct: new Decimal(-10),
    });
    const short = computeQuotePricing(vehicle(), [duration], "2026-09-01", "2026-09-04");
    const long = computeQuotePricing(vehicle(), [duration], "2026-09-01", "2026-09-09");
    expect(short.appliedRules).toHaveLength(0);
    expect(long.totalPrice).toBe(7200);
  });
});
