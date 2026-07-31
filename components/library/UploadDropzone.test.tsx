import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  importBookFile: vi.fn(),
  getWebStorageSnapshot: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/import-book", () => ({ importBookFile: mocks.importBookFile }));
vi.mock("@/lib/pwa-storage", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/pwa-storage")>();
  return { ...original, getWebStorageSnapshot: mocks.getWebStorageSnapshot };
});
vi.mock("@/store/useLibraryStore", () => ({
  useLibraryStore: (
    selector: (state: { refresh: () => Promise<void> }) => unknown
  ) => selector({ refresh: vi.fn(async () => undefined) }),
}));
vi.mock("@/store/useToastStore", () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}));
vi.mock("@/lib/i18n/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { UploadDropzone } from "./UploadDropzone";

describe("UploadDropzone storage guard", () => {
  it("stops before parsing files when safe local space is insufficient", async () => {
    mocks.getWebStorageSnapshot.mockResolvedValue({
      supported: true,
      persisted: false,
      usage: 99 * 1024 * 1024,
      quota: 100 * 1024 * 1024,
    });
    const { container } = render(<UploadDropzone />);
    const input = container.querySelector('input[type="file"]');
    const file = new File([new Uint8Array(2 * 1024 * 1024)], "large.epub", {
      type: "application/epub+zip",
    });

    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("upload.insufficientStorage")
    );
    expect(mocks.importBookFile).not.toHaveBeenCalled();
  });
});
