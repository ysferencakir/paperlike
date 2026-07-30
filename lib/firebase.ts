import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Firestore, getFirestore } from "firebase/firestore";

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
 * Lazily initializes the Firebase app/Firestore on first use, and only if
 * NEXT_PUBLIC_FIREBASE_* env vars are actually set. Cloud sync is an
 * opt-in layer on top of the local-first app — every caller must handle
 * `undefined` (env vars missing, e.g. local dev before Firebase Console
 * setup, or a build that intentionally ships without cloud sync).
 */
export function getFirebaseDb(): Firestore | undefined {
  if (!isFirebaseConfigured()) return undefined;
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
  }
  if (!db) {
    db = getFirestore(app);
  }
  return db;
}
