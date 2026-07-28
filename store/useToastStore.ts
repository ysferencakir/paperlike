import { create } from "zustand";

export type ToastVariant = "default" | "success" | "error";

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
}

const DEFAULT_DURATION_MS = 3200;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

function push(message: string, variant: ToastVariant) {
  const id = crypto.randomUUID();
  useToastStore.setState((state) => ({ toasts: [...state.toasts, { id, message, variant }] }));
  setTimeout(() => useToastStore.getState().dismiss(id), DEFAULT_DURATION_MS);
}

export const toast = {
  message: (msg: string) => push(msg, "default"),
  success: (msg: string) => push(msg, "success"),
  error: (msg: string) => push(msg, "error"),
};
