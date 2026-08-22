import { describe, expect, it } from "vitest";
import { percentile } from "@/lib/analytics/latency";

describe("latency percentile reporting", () => {
  it("calculates deterministic p50 and p95 values", () => {
    const values = Array.from({ length: 100 }, (_, index) => index + 1);
    expect(percentile(values, .5)).toBe(50);
    expect(percentile(values, .95)).toBe(95);
    expect(percentile([], .95)).toBeNull();
  });
});
