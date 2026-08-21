import { describe, expect, it } from "vitest";
import { rangesOverlap, parseDateOnly } from "@/lib/agent/dates";

describe("availability overlap semantics", () => {
  it("treats end-exclusive ranges as non-overlapping when abutting", () => {
    expect(
      rangesOverlap(
        parseDateOnly("2026-09-01"),
        parseDateOnly("2026-09-03"),
        parseDateOnly("2026-09-03"),
        parseDateOnly("2026-09-05"),
      ),
    ).toBe(false);
  });

  it("flags partial overlaps", () => {
    expect(
      rangesOverlap(
        parseDateOnly("2026-09-01"),
        parseDateOnly("2026-09-04"),
        parseDateOnly("2026-09-03"),
        parseDateOnly("2026-09-06"),
      ),
    ).toBe(true);
  });
});
