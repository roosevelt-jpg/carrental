import { describe, expect, it } from "vitest";

/** Pure validation mirrored from generate_payment_link amount guard. */
export function paymentAmountMatchesQuote(expected: number, supplied: number) {
  return Math.abs(expected - supplied) <= 0.01;
}

describe("paymentAmountMatchesQuote", () => {
  it("accepts exact and tiny float diffs", () => {
    expect(paymentAmountMatchesQuote(1500, 1500)).toBe(true);
    expect(paymentAmountMatchesQuote(1500, 1500.005)).toBe(true);
  });

  it("rejects mismatched amounts so the model cannot invent totals", () => {
    expect(paymentAmountMatchesQuote(1500, 1200)).toBe(false);
  });
});
