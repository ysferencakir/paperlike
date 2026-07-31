// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@capacitor-firebase/authentication";
import {
  deleteAccountAndData,
  deleteFirestoreUserTree,
  getAccountReauthenticationKind,
  type AccountDeletionDependencies,
} from "./account-deletion";

const firestoreState = vi.hoisted(() => ({
  db: { kind: "fake-firestore" },
  deletedPaths: [] as string[],
}));

vi.mock("./firebase", () => ({
  getFirebaseAuth: vi.fn(() => undefined),
  getFirebaseDb: vi.fn(() => firestoreState.db),
}));

vi.mock("firebase/firestore", () => {
  const makeSnapshot = (id: string, path: string) => ({ id, ref: { path } });
  return {
    collection: vi.fn((_db: unknown, ...segments: string[]) => ({
      path: segments.join("/"),
    })),
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({
      path: segments.join("/"),
    })),
    getDocs: vi.fn(async (ref: { path: string }) => {
      switch (ref.path) {
        case "users/account-delete-user/books":
          return {
            docs: [
              makeSnapshot("book-a", `${ref.path}/book-a`),
              makeSnapshot("book-b", `${ref.path}/book-b`),
            ],
          };
        case "users/account-delete-user/books/book-a/highlights":
          return { docs: [makeSnapshot("highlight-a", `${ref.path}/highlight-a`)] };
        case "users/account-delete-user/books/book-a/bookmarks":
          return { docs: [makeSnapshot("bookmark-a", `${ref.path}/bookmark-a`)] };
        case "users/account-delete-user/books/book-b/highlights":
        case "users/account-delete-user/books/book-b/bookmarks":
          return { docs: [] };
        case "users/account-delete-user/settings":
          return {
            docs: [
              makeSnapshot("reader", `${ref.path}/reader`),
              makeSnapshot("future", `${ref.path}/future`),
            ],
          };
        case "users/account-delete-user/tombstones":
          return {
            docs: [makeSnapshot("book:book-a:", `${ref.path}/book:book-a:`)],
          };
        default:
          throw new Error(`Unexpected collection path: ${ref.path}`);
      }
    }),
    writeBatch: vi.fn(() => ({
      delete: (ref: { path: string }) => firestoreState.deletedPaths.push(ref.path),
      commit: vi.fn(async () => undefined),
    })),
    deleteDoc: vi.fn(async (ref: { path: string }) => {
      firestoreState.deletedPaths.push(ref.path);
    }),
  };
});

beforeEach(() => {
  firestoreState.deletedPaths.length = 0;
});

function makeUser(providerId: string): User {
  return {
    uid: "account-delete-user",
    email: "reader@example.com",
    displayName: "Reader",
    emailVerified: true,
    isAnonymous: false,
    phoneNumber: null,
    photoUrl: null,
    providerId,
    providerData: [
      {
        providerId,
        uid: "provider-user",
        displayName: "Reader",
        email: "reader@example.com",
        phoneNumber: null,
        photoUrl: null,
      },
    ],
    tenantId: null,
    metadata: {
      creationTime: 1,
      lastSignInTime: 2,
    },
  };
}

function makeDependencies(
  order: string[],
  failure?: "reauthentication" | "firestore" | "drive" | "auth" | "local"
): AccountDeletionDependencies {
  const step = (name: typeof failure) =>
    vi.fn(async () => {
      order.push(name ?? "");
      if (failure === name) throw new Error(`${name} failed`);
    });

  return {
    pauseSync: vi.fn(async () => {
      order.push("pause");
    }),
    resumeSync: vi.fn(() => order.push("resume")),
    reauthenticate: vi.fn(async () => {
      order.push("reauthentication");
      if (failure === "reauthentication") throw new Error("reauthentication failed");
    }),
    deleteFirestoreData: step("firestore"),
    deleteDriveData: step("drive"),
    deleteAuthAccount: step("auth"),
    deleteLocalData: step("local"),
  };
}

describe("SEC-ACCOUNT-DELETE account and remote-data deletion", () => {
  it("runs remote deletion in order, deletes Auth last, then optionally clears local data", async () => {
    const order: string[] = [];
    const dependencies = makeDependencies(order);

    await expect(
      deleteAccountAndData(
        {
          user: makeUser("google.com"),
          reauthentication: { kind: "google" },
          deleteLocalData: true,
        },
        dependencies
      )
    ).resolves.toEqual({
      remoteDeleted: true,
      localDataRequested: true,
      localDataDeleted: true,
    });
    expect(order).toEqual(["pause", "reauthentication", "firestore", "drive", "auth", "local"]);
    expect(dependencies.deleteDriveData).toHaveBeenCalledWith(true);
    expect(dependencies.deleteAuthAccount).toHaveBeenCalledWith("account-delete-user");
    expect(dependencies.resumeSync).not.toHaveBeenCalled();
  });

  it("stops before Auth on a Drive failure and resumes sync for a retry", async () => {
    const order: string[] = [];
    const dependencies = makeDependencies(order, "drive");

    const promise = deleteAccountAndData(
      {
        user: makeUser("google.com"),
        reauthentication: { kind: "google" },
        deleteLocalData: false,
      },
      dependencies
    );

    await expect(promise).rejects.toMatchObject({
      stage: "drive",
      completedStages: ["reauthentication", "firestore"],
    });
    expect(order).toEqual(["pause", "reauthentication", "firestore", "drive", "resume"]);
    expect(dependencies.deleteAuthAccount).not.toHaveBeenCalled();
  });

  it("reports optional local cleanup as partial after remote deletion succeeds", async () => {
    const order: string[] = [];
    const dependencies = makeDependencies(order, "local");

    await expect(
      deleteAccountAndData(
        {
          user: makeUser("password"),
          reauthentication: { kind: "password", password: "correct horse" },
          deleteLocalData: true,
        },
        dependencies
      )
    ).resolves.toMatchObject({
      remoteDeleted: true,
      localDataRequested: true,
      localDataDeleted: false,
      localError: expect.any(Error),
    });
    expect(dependencies.deleteDriveData).not.toHaveBeenCalled();
    expect(dependencies.resumeSync).not.toHaveBeenCalled();
  });

  it("selects Google reauthentication for linked Google accounts", () => {
    expect(getAccountReauthenticationKind(makeUser("google.com"))).toBe("google");
    expect(getAccountReauthenticationKind(makeUser("password"))).toBe("password");
  });

  it("deletes known Firestore descendants before books, settings, and the user root", async () => {
    await deleteFirestoreUserTree("account-delete-user");

    expect(firestoreState.deletedPaths).toEqual([
      "users/account-delete-user/books/book-a/highlights/highlight-a",
      "users/account-delete-user/books/book-a/bookmarks/bookmark-a",
      "users/account-delete-user/books/book-a",
      "users/account-delete-user/books/book-b",
      "users/account-delete-user/settings/reader",
      "users/account-delete-user/settings/future",
      "users/account-delete-user/tombstones/book:book-a:",
      "users/account-delete-user",
    ]);
  });
});
