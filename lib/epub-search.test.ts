import { describe, expect, it, vi } from "vitest";
import { searchEpubSections, type EpubSearchSection } from "./epub-search";

function section(matches: { cfi: string; excerpt: string }[] = []): EpubSearchSection {
  return {
    load: vi.fn(async () => undefined),
    unload: vi.fn(),
    find: vi.fn(() => matches),
  };
}

describe("cancellable EPUB search", () => {
  it("reports section progress and stops before loading the next section", async () => {
    const controller = new AbortController();
    const first = section([{ cfi: "epubcfi(/6/2)", excerpt: "paper" }]);
    const second = section();

    await expect(
      searchEpubSections([first, second], vi.fn(async () => undefined), "paper", {
        signal: controller.signal,
        onProgress: () => controller.abort(),
      })
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(first.load).toHaveBeenCalledOnce();
    expect(first.unload).toHaveBeenCalledOnce();
    expect(second.load).not.toHaveBeenCalled();
  });

  it("unloads a section when cancellation happens during its load", async () => {
    const controller = new AbortController();
    const current = section();
    current.load = vi.fn(async () => {
      controller.abort();
    });

    await expect(
      searchEpubSections([current], vi.fn(async () => undefined), "paper", {
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(current.find).not.toHaveBeenCalled();
    expect(current.unload).toHaveBeenCalledOnce();
  });
});
