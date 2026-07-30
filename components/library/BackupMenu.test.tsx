import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BackupOptions } from "@/lib/backup";

const backupMocks = vi.hoisted(() => ({
  exportLibrary: vi.fn(),
  importLibrary: vi.fn(),
}));

vi.mock("@/lib/backup", () => ({
  exportLibrary: backupMocks.exportLibrary,
  importLibrary: backupMocks.importLibrary,
  isBackupAbortError: (error: unknown) =>
    error instanceof DOMException && error.name === "AbortError",
}));

vi.mock("@/lib/native-ui", () => ({ shareFile: vi.fn() }));
vi.mock("@/store/useLibraryStore", () => ({
  useLibraryStore: (selector: (state: { refresh: () => Promise<void> }) => unknown) =>
    selector({ refresh: vi.fn(async () => undefined) }),
}));
vi.mock("@/store/useLocaleStore", () => ({
  useLocaleStore: (
    selector: (state: { locale: string; setLocale: (locale: string) => void }) => unknown
  ) => selector({ locale: "tr", setLocale: vi.fn() }),
}));
vi.mock("@/store/useToastStore", () => ({
  toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/i18n/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
  DropdownMenuRadioGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuRadioItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ render }: { render: ReactElement }) => render,
}));

import { BackupMenu } from "./BackupMenu";

describe("BackupMenu long-operation controls", () => {
  it("shows progress and aborts the active operation from the cancel button", async () => {
    let options: BackupOptions | undefined;
    backupMocks.exportLibrary.mockImplementation((nextOptions?: BackupOptions) => {
      options = nextOptions;
      nextOptions?.onProgress?.({
        stage: "collecting",
        completed: 2,
        total: 4,
        percentage: 50,
        currentBook: "Large Book",
      });
      return new Promise<Blob>(() => {});
    });

    render(<BackupMenu />);
    fireEvent.click(screen.getByText("backup.export"));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "backup.progressCollecting"
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    fireEvent.click(screen.getByRole("button", { name: "backup.cancel" }));

    await waitFor(() => expect(options?.signal?.aborted).toBe(true));
  });
});
