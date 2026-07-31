import { create } from "zustand";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type InstallOutcome = "accepted" | "dismissed" | "unavailable";

interface PwaInstallState {
  installPrompt: BeforeInstallPromptEvent | null;
  installed: boolean;
  setInstallPrompt: (event: BeforeInstallPromptEvent | null) => void;
  setInstalled: (installed: boolean) => void;
  requestInstall: () => Promise<InstallOutcome>;
}

export const usePwaInstallStore = create<PwaInstallState>((set, get) => ({
  installPrompt: null,
  installed: false,
  setInstallPrompt: (installPrompt) => set({ installPrompt }),
  setInstalled: (installed) =>
    set({ installed, installPrompt: installed ? null : get().installPrompt }),
  requestInstall: async () => {
    const event = get().installPrompt;
    if (!event) return "unavailable";

    await event.prompt();
    const { outcome } = await event.userChoice;
    set({
      installPrompt: null,
      installed: outcome === "accepted" ? true : get().installed,
    });
    return outcome;
  },
}));
