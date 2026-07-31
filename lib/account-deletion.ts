import { FirebaseAuthentication, type User as CapacitorUser } from "@capacitor-firebase/authentication";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";
import { clearCoverCache } from "./cover-cache";
import {
  DRIVE_SIGNIN_SCOPES,
  cacheDriveAccessToken,
  clearDriveAccessToken,
  deleteAppFolderFromDrive,
} from "./drive-sync";
import { getFirebaseAuth, getFirebaseDb } from "./firebase";
import { clearLocalLibraryData, clearSyncStateForUid } from "./storage";
import { pauseSyncForAccountDeletion, resumeSyncAfterAccountDeletion } from "./sync-lifecycle";

export type AccountDeletionStage =
  | "reauthentication"
  | "firestore"
  | "drive"
  | "auth"
  | "local";

export type AccountReauthentication =
  | { kind: "google" }
  | { kind: "password"; password: string };

export interface AccountDeletionOptions {
  user: CapacitorUser;
  reauthentication: AccountReauthentication;
  deleteLocalData: boolean;
}

export interface AccountDeletionResult {
  remoteDeleted: true;
  localDataRequested: boolean;
  localDataDeleted: boolean;
  localError?: unknown;
}

export class AccountDeletionError extends Error {
  constructor(
    readonly stage: Exclude<AccountDeletionStage, "local">,
    readonly completedStages: AccountDeletionStage[],
    readonly cause: unknown
  ) {
    super(`Account deletion failed during ${stage}`);
    this.name = "AccountDeletionError";
  }
}

export interface AccountDeletionDependencies {
  pauseSync: (uid: string) => Promise<void>;
  resumeSync: (uid: string) => void;
  reauthenticate: (
    user: CapacitorUser,
    reauthentication: AccountReauthentication
  ) => Promise<void>;
  deleteFirestoreData: (uid: string) => Promise<void>;
  deleteDriveData: (requiresDrive: boolean) => Promise<void>;
  deleteAuthAccount: (expectedUid: string) => Promise<void>;
  deleteLocalData: () => Promise<void>;
}

function usesProvider(user: CapacitorUser, providerId: string): boolean {
  return (
    user.providerId === providerId ||
    user.providerData.some((provider) => provider.providerId === providerId)
  );
}

export function getAccountReauthenticationKind(user: CapacitorUser): "google" | "password" {
  if (usesProvider(user, "google.com")) return "google";
  return "password";
}

async function reauthenticateCurrentUser(
  expectedUser: CapacitorUser,
  method: AccountReauthentication
): Promise<void> {
  const auth = getFirebaseAuth();
  const currentUser = auth?.currentUser;
  if (!auth || !currentUser || currentUser.uid !== expectedUser.uid) {
    throw new Error("Firebase JS authentication session is unavailable");
  }

  if (method.kind === "google") {
    const result = await FirebaseAuthentication.signInWithGoogle({
      scopes: DRIVE_SIGNIN_SCOPES,
    });
    if (!result.credential?.idToken || result.user?.uid !== expectedUser.uid) {
      throw new Error("Google reauthentication returned an unexpected user");
    }
    cacheDriveAccessToken(result.credential.accessToken);
    await reauthenticateWithCredential(
      currentUser,
      GoogleAuthProvider.credential(result.credential.idToken)
    );
    return;
  }

  const email = expectedUser.email ?? currentUser.email;
  if (!email || !method.password) throw new Error("Email and password are required");

  const nativeResult = await FirebaseAuthentication.signInWithEmailAndPassword({
    email,
    password: method.password,
  });
  if (nativeResult.user?.uid !== expectedUser.uid) {
    throw new Error("Password reauthentication returned an unexpected user");
  }
  await reauthenticateWithCredential(
    currentUser,
    EmailAuthProvider.credential(email, method.password)
  );
}

const FIRESTORE_BATCH_LIMIT = 450;

async function deleteReferences(db: Firestore, refs: DocumentReference[]): Promise<void> {
  for (let offset = 0; offset < refs.length; offset += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(offset, offset + FIRESTORE_BATCH_LIMIT)) batch.delete(ref);
    await batch.commit();
  }
}

/** Deletes every document in the currently supported uid-scoped schema. */
export async function deleteFirestoreUserTree(
  uid: string,
  database?: Firestore
): Promise<void> {
  const db = database ?? getFirebaseDb();
  if (!db) throw new Error("Firestore is not configured");

  const books = await getDocs(collection(db, "users", uid, "books"));
  for (const book of books.docs) {
    const [highlights, bookmarks] = await Promise.all([
      getDocs(collection(db, "users", uid, "books", book.id, "highlights")),
      getDocs(collection(db, "users", uid, "books", book.id, "bookmarks")),
    ]);
    await deleteReferences(db, [
      ...highlights.docs.map((snapshot) => snapshot.ref),
      ...bookmarks.docs.map((snapshot) => snapshot.ref),
    ]);
  }

  const [settings, tombstones] = await Promise.all([
    getDocs(collection(db, "users", uid, "settings")),
    getDocs(collection(db, "users", uid, "tombstones")),
  ]);
  await deleteReferences(db, [
    ...books.docs.map((snapshot) => snapshot.ref),
    ...settings.docs.map((snapshot) => snapshot.ref),
    ...tombstones.docs.map((snapshot) => snapshot.ref),
  ]);
  await deleteDoc(doc(db, "users", uid));
}

async function deleteCurrentAuthAccount(expectedUid: string): Promise<void> {
  const auth = getFirebaseAuth();
  const currentUser = auth?.currentUser;
  if (!auth || !currentUser || currentUser.uid !== expectedUid) {
    throw new Error("Firebase authentication session changed during account deletion");
  }

  await deleteUser(currentUser);
  // The backend account is irreversibly gone after deleteUser succeeds.
  // Session cleanup must therefore be best-effort: reporting this stage as
  // failed would incorrectly tell the user their account still exists.
  await Promise.allSettled([
    FirebaseAuthentication.signOut(),
    auth.currentUser ? firebaseSignOut(auth) : Promise.resolve(),
    clearSyncStateForUid(expectedUid),
  ]);
  clearDriveAccessToken();
  const { useAuthStore } = await import("@/store/useAuthStore");
  useAuthStore.setState({ user: null, initialized: true });
}

async function deleteLocalData(): Promise<void> {
  await clearLocalLibraryData();
  clearCoverCache();
  const { useLibraryStore } = await import("@/store/useLibraryStore");
  await useLibraryStore.getState().refresh();
}

const defaultDependencies: AccountDeletionDependencies = {
  pauseSync: pauseSyncForAccountDeletion,
  resumeSync: resumeSyncAfterAccountDeletion,
  reauthenticate: reauthenticateCurrentUser,
  deleteFirestoreData: deleteFirestoreUserTree,
  deleteDriveData: async (requiresDrive) => {
    // Email/password-only accounts do not own a Drive grant. In particular,
    // do not call the Drive helper here: its token refresh is interactive and
    // could otherwise open an unrelated Google sign-in.
    if (requiresDrive) {
      await deleteAppFolderFromDrive({ requiresAccessToken: true });
    }
  },
  deleteAuthAccount: deleteCurrentAuthAccount,
  deleteLocalData,
};

/**
 * Deletes remote data in strict order and removes Auth last. Before Auth is
 * deleted, failures are retryable and reported with the exact failed stage.
 * Optional local deletion happens afterwards and is returned as a partial
 * result because the remote account is already irreversibly gone.
 */
export async function deleteAccountAndData(
  options: AccountDeletionOptions,
  dependencies: AccountDeletionDependencies = defaultDependencies
): Promise<AccountDeletionResult> {
  const completedStages: AccountDeletionStage[] = [];
  let authDeleted = false;

  await dependencies.pauseSync(options.user.uid);
  try {
    const steps: {
      stage: Exclude<AccountDeletionStage, "local">;
      run: () => Promise<void>;
    }[] = [
      {
        stage: "reauthentication",
        run: () => dependencies.reauthenticate(options.user, options.reauthentication),
      },
      {
        stage: "firestore",
        run: () => dependencies.deleteFirestoreData(options.user.uid),
      },
      {
        stage: "drive",
        run: () =>
          usesProvider(options.user, "google.com")
            ? dependencies.deleteDriveData(true)
            : Promise.resolve(),
      },
      { stage: "auth", run: () => dependencies.deleteAuthAccount(options.user.uid) },
    ];

    for (const step of steps) {
      try {
        await step.run();
        completedStages.push(step.stage);
        if (step.stage === "auth") authDeleted = true;
      } catch (cause) {
        throw new AccountDeletionError(step.stage, [...completedStages], cause);
      }
    }

    if (!options.deleteLocalData) {
      return {
        remoteDeleted: true,
        localDataRequested: false,
        localDataDeleted: false,
      };
    }

    try {
      await dependencies.deleteLocalData();
      completedStages.push("local");
      return {
        remoteDeleted: true,
        localDataRequested: true,
        localDataDeleted: true,
      };
    } catch (localError) {
      return {
        remoteDeleted: true,
        localDataRequested: true,
        localDataDeleted: false,
        localError,
      };
    }
  } finally {
    if (!authDeleted) dependencies.resumeSync(options.user.uid);
  }
}
