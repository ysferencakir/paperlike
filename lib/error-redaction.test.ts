import { describe, expect, it } from "vitest";
import { sanitizeCrashPayload } from "./error-redaction";

describe("SEC-LOG-001 Crashlytics payload redaction", () => {
  it("redacts user identifiers, URIs, paths, tokens, and quoted content", () => {
    const error = new Error(
      'Failed "Private Book Title" for reader@example.com at content://library/private.epub ' +
        "with Bearer ya29.secret-token and access_token=raw-secret"
    );
    error.stack =
      "Error at W:\\Users\\reader\\private-note.ts:12\n" +
      "https://www.googleapis.com/upload/drive/v3/files?upload_id=private";

    const payload = sanitizeCrashPayload(error);

    expect(payload.message).not.toMatch(
      /Private Book Title|reader@example|content:\/\/|ya29|raw-secret/
    );
    expect(payload.stack).not.toMatch(/Users\\reader|googleapis|upload_id=private/);
    expect(payload.message).toContain("[redacted");
    expect(payload.stack).toContain("[redacted");
  });

  it("limits arbitrary message and stack sizes", () => {
    const error = new Error("message ".repeat(400));
    error.stack = "stack frame\n".repeat(1_000);

    const payload = sanitizeCrashPayload(error);

    expect(payload.message.length).toBeLessThan(540);
    expect(payload.stack.length).toBeLessThan(4_130);
    expect(payload.message).toContain("[truncated]");
    expect(payload.stack).toContain("[truncated]");
  });
});
