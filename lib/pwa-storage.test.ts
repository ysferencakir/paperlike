import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_SAFETY_RESERVE_BYTES,
  canStoreFiles,
  formatStorageBytes,
  getAvailableStorage,
  getWebStorageSnapshot,
  isStorageLow,
  requestPersistentWebStorage,
  type WebStorageSnapshot,
} from "./pwa-storage";

const originalStorage = Object.getOwnPropertyDescriptor(navigator, "storage");

afterEach(() => {
  if (originalStorage) Object.defineProperty(navigator, "storage", originalStorage);
  else Reflect.deleteProperty(navigator, "storage");
});

describe("PWA storage helpers", () => {
  it("reads quota and persistent-storage state from the browser", async () => {
    const persist = vi.fn(async () => true);
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        estimate: vi.fn(async () => ({ usage: 20, quota: 100 })),
        persisted: vi.fn(async () => false),
        persist,
      },
    });

    await expect(getWebStorageSnapshot()).resolves.toEqual({
      supported: true,
      persisted: false,
      usage: 20,
      quota: 100,
    });
    await expect(requestPersistentWebStorage()).resolves.toBe(true);
    expect(persist).toHaveBeenCalledOnce();
  });

  it("keeps a safety reserve when accepting book files", () => {
    const snapshot: WebStorageSnapshot = {
      supported: true,
      persisted: false,
      usage: 100,
      quota: 100 + STORAGE_SAFETY_RESERVE_BYTES + 1_000,
    };

    expect(canStoreFiles([{ size: 999 }], snapshot)).toBe(true);
    expect(canStoreFiles([{ size: 1_001 }], snapshot)).toBe(false);
  });

  it("reports available and low space and formats bytes", () => {
    const snapshot: WebStorageSnapshot = {
      supported: true,
      persisted: true,
      usage: 950 * 1024 * 1024,
      quota: 1024 * 1024 * 1024,
    };

    expect(getAvailableStorage(snapshot)).toBe(74 * 1024 * 1024);
    expect(isStorageLow(snapshot)).toBe(true);
    expect(formatStorageBytes(1.5 * 1024 * 1024, "en")).toBe("1.5 MB");
  });
});
