import { create } from "zustand";
import { FirebaseAuthentication, type User } from "@capacitor-firebase/authentication";

interface AuthState {
  user: User | null;
  // undefined while the initial authStateChange hasn't fired yet, so the UI
  // can show nothing/a spinner instead of flashing a "signed out" state.
  initialized: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createAccountWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  initialized: false,

  signInWithGoogle: async () => {
    await FirebaseAuthentication.signInWithGoogle();
  },

  signInWithEmail: async (email, password) => {
    await FirebaseAuthentication.signInWithEmailAndPassword({ email, password });
  },

  createAccountWithEmail: async (email, password) => {
    await FirebaseAuthentication.createUserWithEmailAndPassword({ email, password });
  },

  resetPassword: async (email) => {
    await FirebaseAuthentication.sendPasswordResetEmail({ email });
  },

  signOut: async () => {
    await FirebaseAuthentication.signOut();
  },
}));

// Kept outside the store body (module scope, called once from a root-level
// handler component) so the authStateChange listener isn't re-subscribed on
// every store consumer mount — see AuthHandler.tsx.
export async function initAuthListener(): Promise<() => void> {
  const result = await FirebaseAuthentication.getCurrentUser();
  useAuthStore.setState({ user: result.user, initialized: true });

  const listener = await FirebaseAuthentication.addListener("authStateChange", (change) => {
    useAuthStore.setState({ user: change.user, initialized: true });
  });
  return () => void listener.remove();
}
