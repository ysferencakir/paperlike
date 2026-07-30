import { create } from "zustand";
import { FirebaseAuthentication, type User } from "@capacitor-firebase/authentication";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { pushLibrarySnapshot } from "@/lib/cloud-sync";
import { getFirebaseAuth, setFirebaseIsNativePlatform } from "@/lib/firebase";

// @capacitor-firebase/authentication signs the user in on the *native*
// Android/iOS side only — nothing else in the Firebase JS SDK (Firestore,
// Storage, ...) running in the WebView sees that session until the JS SDK's
// own Auth is *also* signed in with an equivalent credential. Web already
// runs on the JS SDK directly, so this only matters on native.
async function isNativePlatform(): Promise<boolean> {
  const { Capacitor } = await import("@capacitor/core");
  return Capacitor.isNativePlatform();
}

async function syncWebAuthAfterGoogleSignIn(idToken: string | undefined): Promise<void> {
  if (!(await isNativePlatform()) || !idToken) return;
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

async function syncWebAuthWithEmailPassword(email: string, password: string): Promise<void> {
  if (!(await isNativePlatform())) return;
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signInWithCredential(auth, EmailAuthProvider.credential(email, password));
}

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
    const result = await FirebaseAuthentication.signInWithGoogle();
    await syncWebAuthAfterGoogleSignIn(result.credential?.idToken);
    // Pushed here (after the JS-side Auth is actually bridged) rather than
    // from the authStateChange listener below — that listener can fire from
    // the *native* sign-in alone, racing ahead of syncWebAuthAfterGoogleSignIn
    // and pushing to Firestore before request.auth exists on the JS side,
    // which the security rules then reject.
    if (result.user) pushLibrarySnapshot(result.user.uid).catch(console.error);
  },

  signInWithEmail: async (email, password) => {
    const result = await FirebaseAuthentication.signInWithEmailAndPassword({ email, password });
    await syncWebAuthWithEmailPassword(email, password);
    if (result.user) pushLibrarySnapshot(result.user.uid).catch(console.error);
  },

  createAccountWithEmail: async (email, password) => {
    const result = await FirebaseAuthentication.createUserWithEmailAndPassword({ email, password });
    await syncWebAuthWithEmailPassword(email, password);
    if (result.user) pushLibrarySnapshot(result.user.uid).catch(console.error);
  },

  resetPassword: async (email) => {
    await FirebaseAuthentication.sendPasswordResetEmail({ email });
  },

  signOut: async () => {
    await FirebaseAuthentication.signOut();
    const auth = getFirebaseAuth();
    if (auth) await firebaseSignOut(auth);
  },
}));

// Kept outside the store body (module scope, called once from a root-level
// handler component) so the authStateChange listener isn't re-subscribed on
// every store consumer mount — see AuthHandler.tsx.
export async function initAuthListener(): Promise<() => void> {
  try {
    const result = await FirebaseAuthentication.getCurrentUser();
    useAuthStore.setState({ user: result.user, initialized: true });
    if (result.user) pushLibrarySnapshot(result.user.uid).catch(console.error);

    const listener = await FirebaseAuthentication.addListener("authStateChange", (change) => {
      // Interactive sign-ins push their own snapshot (see signInWithGoogle/
      // signInWithEmail/createAccountWithEmail above) once the JS-side Auth
      // is actually bridged — pushing here too would race ahead of that and
      // hit Firestore before request.auth exists on the JS side.
      useAuthStore.setState({ user: change.user, initialized: true });
    });
    return () => void listener.remove();
  } catch {
    // Plugin not present on the currently installed native build (e.g. a
    // live-reload session against an APK compiled before this plugin was
    // added) — treat as "no user" rather than leaving the app thinking auth
    // never initialized, or throwing an unhandled rejection at the caller.
    useAuthStore.setState({ user: null, initialized: true });
    return () => {};
  }
}
