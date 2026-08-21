import { describe, expect, it } from "vitest";
import { getLocale, isRtlLocale, isSupportedLocale, LOCALES } from "@/lib/i18n/locales";

describe("language preferences", () => {
  it("offers comprehensive ISO 639-1 language coverage without duplicates", () => {
    expect(LOCALES.length).toBeGreaterThanOrEqual(184);
    expect(new Set(LOCALES.map((locale) => locale.code)).size).toBe(LOCALES.length);
  });

  it("normalizes regional locale tags and falls back safely", () => {
    expect(getLocale("ar-AE").code).toBe("ar");
    expect(isSupportedLocale("fr-CA")).toBe(true);
    expect(getLocale("not-a-locale").code).toBe("en");
  });

  it("identifies right-to-left languages", () => {
    expect(isRtlLocale("ar")).toBe(true);
    expect(isRtlLocale("he")).toBe(true);
    expect(isRtlLocale("en")).toBe(false);
  });
});
