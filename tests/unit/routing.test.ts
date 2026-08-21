import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

describe("public and admin route contract", () => {
  it("serves the CMS website at the root route", () => {
    const publicPage = source("app/page.tsx");

    expect(publicPage).toContain("getPublicCmsContent");
    expect(publicPage).not.toMatch(/redirect\(["']\/admin(?:\/|["'])/);
  });

  it("keeps setup, login, and dashboard navigation under /admin", () => {
    const adminPage = source("app/(admin)/admin/page.tsx");

    expect(adminPage).toContain('redirect("/admin/setup")');
    expect(adminPage).toContain('redirect("/admin/login")');
    expect(adminPage).toContain('redirect("/admin/dashboard")');
  });

  it("does not configure a global redirect away from the public homepage", () => {
    const nextConfig = source("next.config.ts");

    expect(nextConfig).not.toMatch(/source:\s*["']\/["'][\s\S]*destination:\s*["']\/admin/);
  });
});
