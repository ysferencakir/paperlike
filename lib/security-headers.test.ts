// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY, RESPONSE_ONLY_SECURITY_HEADERS } from "./security-headers";

const ROOT = join(__dirname, "..");

// The hosting-config files below can't literally import CONTENT_SECURITY_POLICY
// (one is a plain-text Netlify/Cloudflare convention file, the other JSON) —
// these tests are the drift guard described in security-headers.ts's top comment.
// Their CSP is the app-shell policy plus `frame-ancestors 'none'`, a directive
// browsers ignore in a <meta> tag but that's meaningful as a real header.
const EXPECTED_HEADER_CSP = `${CONTENT_SECURITY_POLICY}; frame-ancestors 'none'`;

describe("UT-SECURITY-HEADERS-001 hosting config stays in sync with lib/security-headers.ts", () => {
  it("public/_headers carries the exact CSP and response-only headers", () => {
    const contents = readFileSync(join(ROOT, "public", "_headers"), "utf-8");
    expect(contents).toContain(`Content-Security-Policy: ${EXPECTED_HEADER_CSP}`);
    for (const [key, value] of Object.entries(RESPONSE_ONLY_SECURITY_HEADERS)) {
      expect(contents).toContain(`${key}: ${value}`);
    }
  });

  it("vercel.json carries the exact CSP and response-only headers", () => {
    const config = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf-8")) as {
      headers: { headers: { key: string; value: string }[] }[];
    };
    const headerMap = new Map(config.headers[0].headers.map((h) => [h.key, h.value]));
    expect(headerMap.get("Content-Security-Policy")).toBe(EXPECTED_HEADER_CSP);
    for (const [key, value] of Object.entries(RESPONSE_ONLY_SECURITY_HEADERS)) {
      expect(headerMap.get(key)).toBe(value);
    }
  });
});
