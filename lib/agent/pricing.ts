import { Decimal } from "@prisma/client/runtime/library";
import type { PricingRule, Vehicle } from "@prisma/client";
import { daysBetween, parseDateOnly, rangesOverlap } from "@/lib/agent/dates";

function asNumber(value: Decimal | number | string): number {
  return typeof value === "number" ? value : Number(value);
}

export function computeQuotePricing(
  vehicle: Vehicle,
  rules: PricingRule[],
  startDate: string,
  endDate: string,
) {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const nights = daysBetween(start, end);
  const daily = asNumber(vehicle.dailyRate);
  let subtotal = daily * nights;

  const applied: Array<{
    id: string;
    ruleType: string;
    adjustmentPct: number | null;
    adjustmentFlat: number | null;
  }> = [];

  for (const rule of rules) {
    if (rule.ruleType === "SEASONAL") {
      if (!rule.startDate || !rule.endDate) continue;
      if (!rangesOverlap(start, end, rule.startDate, rule.endDate)) continue;
    }
    if (rule.ruleType === "DURATION" && nights < 7) {
      continue;
    }
    if (rule.ruleType === "WEEKDAY") {
      // Weekday rules apply when any rental day falls Mon–Thu UTC.
      let hits = false;
      for (let i = 0; i < nights; i++) {
        const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        const dow = day.getUTCDay();
        if (dow >= 1 && dow <= 4) {
          hits = true;
          break;
        }
      }
      if (!hits) continue;
    }

    if (rule.adjustmentPct != null) {
      subtotal += subtotal * (asNumber(rule.adjustmentPct) / 100);
    }
    if (rule.adjustmentFlat != null) {
      subtotal += asNumber(rule.adjustmentFlat);
    }
    applied.push({
      id: rule.id,
      ruleType: rule.ruleType,
      adjustmentPct: rule.adjustmentPct == null ? null : asNumber(rule.adjustmentPct),
      adjustmentFlat:
        rule.adjustmentFlat == null ? null : asNumber(rule.adjustmentFlat),
    });
  }

  const totalPrice = Math.round(subtotal * 100) / 100;
  return {
    nights,
    dailyRate: daily,
    totalPrice,
    depositDue: asNumber(vehicle.depositAmount),
    appliedRules: applied,
  };
}
