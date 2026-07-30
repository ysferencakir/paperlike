import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Firestore, getFirestore } from "firebase/firestore";
import { type Auth, getAuth, indexedDBLocalPersistence, initializeAuth } from "firebase/auth";

// Client-side config — these are not secrets (Firebase's own docs make this
// explicit: the API key just identifies the project, real access control
// lives in Firestore security rules / Auth). Safe to bake into the public
// bundle via NEXT_PUBLIC_* env vars.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

/**
 * Initializes the default Firebase app if it isn't already, and only if
 * NEXT_PUBLIC_FIREBASE_* env vars are actually set. `@capacitor-firebase/
 * authentication`'s web implementation calls `getAuth()` with no app
 * argument, which throws unless some code has already called
 * `initializeApp()` — so this must run before any auth call, not just
 * lazily whenever Firestore happens to be touched. AuthHandler calls this
 * on mount for exactly that reason.
 */
export function getFirebaseApp(): FirebaseApp | undefined {
  if (!isFirebaseConfigured()) return undefined;
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
  }
  return app;
}

/**
 * Lazily initializes Firestore on first use, and only if NEXT_PUBLIC_FIREBASE_*
 * env vars are actually set. Cloud sync is an opt-in layer on top of the
 * local-first app — every caller must handle `undefined` (env vars missing,
 * e.g. local dev before Firebase Console setup, or a build that
 * intentionally ships without cloud sync).
 */
export function getFirebaseDb(): Firestore | undefined {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return undefined;
  if (!db) {
    db = getFirestore(firebaseApp);
  }
  return db;
}

let auth: Auth | undefined;
let isNative = false;

/** Must be called once, early (before any getFirebaseAuth() call), to pick the right init path. */
export function setFirebaseIsNativePlatform(native: boolean): void {
  isNative = native;
}

/**
 * The Firebase JS SDK's own Auth instance — kept separate from
 * `@capacitor-firebase/authentication`'s native session. On Android/iOS,
 * `@capacitor-firebase/authentication` signs the user in on the *native*
 * side only; nothing else in the Firebase JS SDK (Firestore, Storage, ...)
 * sees that session unless this JS-side Auth is *also* signed in, via
 * `signInWithCredential` in useAuthStore.ts. `initializeAuth` with
 * `indexedDBLocalPersistence` (rather than plain `getAuth()`) is required on
 * native so that session survives app restarts — see
 * https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/authentication/docs/firebase-js-sdk.md
 */
export function getFirebaseAuth(): Auth | undefined {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return undefined;
  if (!auth) {
    auth = isNative
      ? initializeAuth(firebaseApp, { persistence: indexedDBLocalPersistence })
      : getAuth(firebaseApp);
  }
  return auth;
}
