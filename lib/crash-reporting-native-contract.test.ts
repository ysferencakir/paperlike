// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("SEC-LOG-CONSENT-003 native Crashlytics opt-in contract", () => {
  it("disables automatic collection in the production manifest", () => {
    const manifest = readFileSync(
      join(process.cwd(), "android/app/src/main/AndroidManifest.xml"),
      "utf8"
    );
    expect(manifest).toMatch(
      /android:name="firebase_crashlytics_collection_enabled"\s+android:value="false"/
    );
  });

  it("supports runtime collection changes and discards unsent reports on opt-out", () => {
    const plugin = readFileSync(
      join(
        process.cwd(),
        "android/app/src/main/java/com/ysferencakir/paperlike/CrashReportingPlugin.java"
      ),
      "utf8"
    );
    expect(plugin).toContain("void setCollectionEnabled(PluginCall call)");
    expect(plugin).toContain("setCrashlyticsCollectionEnabled(enabled)");
    expect(plugin).toContain("deleteUnsentReports()");
    expect(plugin).toContain("isCrashlyticsCollectionEnabled()");
  });
});
