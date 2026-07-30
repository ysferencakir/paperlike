import { create } from "zustand";

/**
 * Lets whatever's currently on screen (the reader, an open dialog, ...)
 * intercept the Android hardware/gesture back button before the global
 * fallback (navigate to the library, or exit the app) runs. A handler
 * returns true if it consumed the press (e.g. closed a panel), false to
 * let the fallback handle it.
 */
type BackHandler = () => boolean;

interface BackHandlerState {
  handler: BackHandler | null;
  setHandler: (handler: BackHandler) => void;
  clearHandler: (handler: BackHandler) => void;
}

export const useBackHandlerStore = create<BackHandlerState>((set, get) => ({
  handler: null,
  setHandler: (handler) => set({ handler }),
  clearHandler: (handler) => {
    if (get().handler === handler) set({ handler: null });
  },
}));
