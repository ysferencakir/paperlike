// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { CoverCache } from "./cover-cache";
import { createCoverThumbnail } from "./cover-thumbnail";

function cacheFixture(maxEntries = 4) {
  const load = vi.fn(async (bookId: string) => new Blob([bookId.repeat(8)]));
  const createObjectURL = vi.fn((blob: Blob) => `blob:cover-${blob.size}-${crypto.randomUUID()}`);
  const revokeObjectURL = vi.fn();
  const cache = new CoverCache({
    maxEntries,
    maxBytes: Number.MAX_SAFE_INTEGER,
    load,
    prepare: async (blob) => blob,
    createObjectURL,
    revokeObjectURL,
  });
  return { cache, load, createObjectURL, revokeObjectURL };
}

describe("IT-COVER-CACHE-001 cover LRU and URL lifecycle", () => {
  it("deduplicates concurrent IndexedDB loads and object URLs", async () => {
    const { cache, load, createObjectURL } = cacheFixture();

    const [first, second] = await Promise.all([
      cache.acquire("same-book"),
      cache.acquire("same-book"),
    ]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(first?.url).toBe(second?.url);
    expect(cache.stats().activeLeases).toBe(2);
    first?.release();
    second?.release();
    cache.clear();
  });

  it("evicts least-recently-used inactive covers and revokes their URLs", async () => {
    const { cache, revokeObjectURL } = cacheFixture(2);
    for (const id of ["one", "two", "three"]) {
      const lease = await cache.acquire(id);
      lease?.release();
    }

    expect(cache.stats().entries).toBe(2);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    cache.clear();
    expect(revokeObjectURL).toHaveBeenCalledTimes(3);
  });

  it("keeps an active URL alive until its final lease is released", async () => {
    const { cache, revokeObjectURL } = cacheFixture();
    const lease = await cache.acquire("active");

    cache.invalidate("active");
    expect(revokeObjectURL).not.toHaveBeenCalled();
    lease?.release();
    expect(revokeObjectURL).toHaveBeenCalledWith(lease?.url);
  });

  it("caches extracted spine color with the same cover load", async () => {
    const { cache, load } = cacheFixture();
    const extract = vi.fn(async () => "rgb(1, 2, 3)");

    await expect(cache.getSpineColor("spine", extract)).resolves.toBe("rgb(1, 2, 3)");
    await expect(cache.getSpineColor("spine", extract)).resolves.toBe("rgb(1, 2, 3)");
    expect(load).toHaveBeenCalledTimes(1);
    expect(extract).toHaveBeenCalledTimes(1);
    cache.clear();
  });

  it("negative-caches books without cover art", async () => {
    const load = vi.fn(async () => undefined);
    const cache = new CoverCache({
      load,
      prepare: async (blob) => blob,
      createObjectURL: vi.fn(),
      revokeObjectURL: vi.fn(),
    });

    await expect(cache.acquire("no-cover")).resolves.toBeUndefined();
    await expect(cache.acquire("no-cover")).resolves.toBeUndefined();
    expect(load).toHaveBeenCalledTimes(1);
    cache.clear();
  });

  it("stays within its entry budget across a 200-book library fixture", async () => {
    const { cache, revokeObjectURL } = cacheFixture(24);

    for (let index = 0; index < 200; index++) {
      const lease = await cache.acquire(`book-${index}`);
      lease?.release();
    }

    expect(cache.stats().entries).toBeLessThanOrEqual(24);
    expect(cache.stats().activeLeases).toBe(0);
    expect(revokeObjectURL).toHaveBeenCalledTimes(176);
    cache.clear();
  });
});

describe("UT-COVER-THUMBNAIL-001 thumbnail fallback", () => {
  it("returns the original Blob when bitmap APIs are unavailable", async () => {
    const source = new Blob(["cover"]);
    await expect(createCoverThumbnail(source)).resolves.toBe(source);
  });
});
