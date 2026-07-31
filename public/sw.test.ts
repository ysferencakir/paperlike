import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "public", "sw.js"), "utf8");

describe("service worker update safety contract", () => {
  it("stages and validates a complete shell before activation cleanup", () => {
    expect(source).toContain("STAGING_CACHE");
    expect(source).toContain("validateAppShell(staging)");
    expect(source).toContain("validateAppShell(target)");
    expect(source.indexOf("validateAppShell(activeCache)")).toBeLessThan(
      source.indexOf("const names = await caches.keys()")
    );
  });

  it("removes an incomplete new cache while preserving older versions", () => {
    expect(source).toContain(
      "Promise.all([caches.delete(STAGING_CACHE), caches.delete(CACHE_VERSION)])"
    );
    expect(source).toContain("name.startsWith(CACHE_PREFIX) && name !== CACHE_VERSION");
  });

  it("does not turn a successful network response into a failure when cache writes fail", () => {
    expect(source).toContain("await safeCachePut");
    expect(source).toContain('notifyClients({ type: "PWA_CACHE_ERROR" })');
    expect(source).toContain("return cached || new Response");
  });
});
