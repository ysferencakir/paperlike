import { createRef, useEffect, type ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReaderSurfaceHandle } from "./types";

const pdfMocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  getPage: vi.fn(async () => ({
    getTextContent: vi.fn(async () => ({ items: [{ str: "needle in a large book" }] })),
  })),
}));

vi.mock("react-pdf", () => ({
  pdfjs: {
    GlobalWorkerOptions: { workerSrc: "" },
    getDocument: pdfMocks.getDocument,
  },
  Document: ({
    children,
    onLoadSuccess,
  }: {
    children: ReactNode;
    onLoadSuccess: (doc: unknown) => void;
  }) => {
    useEffect(() => {
      onLoadSuccess({
        numPages: 1000,
        getPage: pdfMocks.getPage,
        destroy: vi.fn(),
      });
    }, [onLoadSuccess]);
    return <div data-testid="pdf-document">{children}</div>;
  },
  Page: ({ pageNumber }: { pageNumber: number }) => (
    <div data-testid="rendered-pdf-page" data-page={pageNumber} />
  ),
}));

vi.mock("@/lib/i18n/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { PdfReaderSurface } from "./PdfReaderSurface";

class PassiveIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("PdfReaderSurface large-document behavior", () => {
  beforeEach(() => {
    pdfMocks.getDocument.mockReset();
    pdfMocks.getPage.mockClear();
    vi.stubGlobal("IntersectionObserver", PassiveIntersectionObserver);
  });

  it("does not mount a canvas/text layer for every page in continuous mode", async () => {
    const view = render(
      <PdfReaderSurface
        file={new Blob(["large-pdf"], { type: "application/pdf" })}
        scrollMode
        onProgress={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(view.getAllByTestId("rendered-pdf-page")).toHaveLength(2);
    });
    expect(view.container.querySelectorAll("[data-pdf-page-slot]")).toHaveLength(1000);
  });

  it("reuses the document loaded by react-pdf for text access", async () => {
    const ref = createRef<ReaderSurfaceHandle>();
    render(
      <PdfReaderSurface
        ref={ref}
        file={new Blob(["large-pdf"], { type: "application/pdf" })}
        onProgress={vi.fn()}
      />
    );

    await waitFor(() => expect(ref.current).not.toBeNull());
    await waitFor(() => expect(pdfMocks.getPage).not.toHaveBeenCalled());
    await expect(ref.current?.getCurrentText()).resolves.toContain("needle");

    expect(pdfMocks.getDocument).not.toHaveBeenCalled();
    expect(pdfMocks.getPage).toHaveBeenCalledTimes(1);
  });
});
