import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";

// Storage is browser-only by contract. Node-environment integration tests use
// Node's standards-compliant Blob while exposing the browser global expected
// by storage.ts.
if (typeof window === "undefined") {
  Object.defineProperty(globalThis, "window", {
    value: globalThis,
    configurable: true,
  });
}
