import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Book } from "@/lib/types";

const coverMocks = vi.hoisted(() => ({
  acquire: vi.fn(),
}));

vi.mock("@/lib/cover-cache", () => ({
  coverCache: { acquire: coverMocks.acquire },
}));

import { BookCover } from "./BookCover";

const book: Book = {
  id: "lazy-cover",
  title: "Lazy Cover",
  author: "Paperlike",
  format: "epub",
  addedAt: 1,
  fileSize: 1,
};

let intersectionCallback:
  | ((entries: Pick<IntersectionObserverEntry, "isIntersecting">[]) => void)
  | undefined;

class FakeIntersectionObserver {
  constructor(
    callback: (entries: Pick<IntersectionObserverEntry, "isIntersecting">[]) => void
  ) {
    intersectionCallback = callback;
  }
  observe() {}
  disconnect() {}
}

describe("BookCover viewport lifecycle", () => {
  beforeEach(() => {
    intersectionCallback = undefined;
    coverMocks.acquire.mockReset();
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("loads near the viewport and releases its URL after leaving", async () => {
    const release = vi.fn();
    coverMocks.acquire.mockResolvedValue({
      blob: new Blob(["cover"]),
      url: "blob:lazy-cover",
      release,
    });
    render(<BookCover book={book} />);

    expect(coverMocks.acquire).not.toHaveBeenCalled();
    await act(async () => {
      intersectionCallback?.([{ isIntersecting: true }]);
      await Promise.resolve();
    });
    expect(screen.getByRole("img", { name: "Lazy Cover" })).toHaveAttribute(
      "src",
      "blob:lazy-cover"
    );

    act(() => intersectionCallback?.([{ isIntersecting: false }]));
    expect(screen.queryByRole("img", { name: "Lazy Cover" })).not.toBeInTheDocument();
    expect(release).toHaveBeenCalledOnce();
  });
});
