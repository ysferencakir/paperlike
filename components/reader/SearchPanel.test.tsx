import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchOptions, SearchResult } from "./types";

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/lib/i18n/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      if (key !== "search.progress") return key;
      return `${values?.completed}/${values?.total} · ${values?.count}`;
    },
  }),
}));

import { SearchPanel } from "./SearchPanel";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("SearchPanel cancellation and progress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("debounces input and aborts the previous full-book search", async () => {
    const first = deferred<SearchResult[]>();
    const second = deferred<SearchResult[]>();
    const calls: { query: string; options?: SearchOptions }[] = [];
    const onSearch = vi.fn((query: string, options?: SearchOptions) => {
      calls.push({ query, options });
      return query === "first" ? first.promise : second.promise;
    });

    render(
      <SearchPanel
        open
        onOpenChange={vi.fn()}
        onSearch={onSearch}
        onNavigate={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("search.placeholder");
    fireEvent.change(input, { target: { value: "first" } });
    await act(() => vi.advanceTimersByTimeAsync(250));
    expect(onSearch).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { value: "second" } });
    expect(calls[0].options?.signal?.aborted).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(250));
    expect(onSearch).toHaveBeenCalledTimes(2);

    await act(async () => {
      second.resolve([{ location: "page:2", excerpt: "second result" }]);
      await Promise.resolve();
    });
    expect(screen.getByText("second result")).toBeInTheDocument();
  });

  it("shows progress and cancels work when the controlled panel closes", async () => {
    const pending = deferred<SearchResult[]>();
    let options: SearchOptions | undefined;
    const onSearch = vi.fn((_query: string, nextOptions?: SearchOptions) => {
      options = nextOptions;
      return pending.promise;
    });
    const view = render(
      <SearchPanel
        open
        onOpenChange={vi.fn()}
        onSearch={onSearch}
        onNavigate={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("search.placeholder"), {
      target: { value: "paper" },
    });
    await act(() => vi.advanceTimersByTimeAsync(250));
    act(() => options?.onProgress?.({ completed: 12, total: 100, resultCount: 3 }));

    expect(screen.getByRole("status")).toHaveTextContent("12/100 · 3");
    expect(screen.getByRole("status")).toHaveTextContent("12%");

    view.rerender(
      <SearchPanel
        open={false}
        onOpenChange={vi.fn()}
        onSearch={onSearch}
        onNavigate={vi.fn()}
      />
    );
    expect(options?.signal?.aborted).toBe(true);
  });
});
