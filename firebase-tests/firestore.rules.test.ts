import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deleteFirestoreUserTree } from "@/lib/account-deletion";
import { drainSyncOutbox, pullLibrarySnapshot } from "@/lib/cloud-sync";
import {
  getBook,
  getBookmarks,
  getHighlights,
  getSyncOutboxOperations,
  upsertBookMetadata,
  upsertBookmarkLocal,
  upsertHighlightLocal,
  upsertSyncOutboxOperation,
} from "@/lib/storage";
import { createSyncOutboxOperation } from "@/lib/sync-outbox";
import { syncTombstoneId } from "@/lib/sync-tombstones";

const PROJECT_ID = "demo-paperlike-rules";
let testEnvironment: RulesTestEnvironment;

function dbFor(uid?: string): Firestore {
  const compatDb = uid
    ? testEnvironment.authenticatedContext(uid).firestore()
    : testEnvironment.unauthenticatedContext().firestore();
  // rules-unit-testing exposes the compat wrapper, while the production app
  // uses modular Firestore. Modular functions unwrap compat's `_delegate` at
  // runtime; keep that bridge explicit at this test-only boundary.
  return compatDb as unknown as Firestore;
}

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(join(process.cwd(), "firestore.rules"), "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe("SEC-CLOUD-001 Firestore uid isolation", () => {
  it("denies unauthenticated reads and writes", async () => {
    const db = dbFor();
    await assertFails(getDoc(doc(db, "users", "alice")));
    await assertFails(setDoc(doc(db, "users", "alice", "settings", "reader"), { theme: "paper" }));
  });

  it("allows a user to manage every supported path under their own uid", async () => {
    const db = dbFor("alice");
    const paths = [
      "users/alice",
      "users/alice/books/book-1",
      "users/alice/books/book-1/highlights/highlight-1",
      "users/alice/books/book-1/bookmarks/bookmark-1",
      "users/alice/settings/reader",
      "users/alice/tombstones/book:book-1:",
    ];

    for (const path of paths) {
      const ref = doc(db, path);
      await assertSucceeds(setDoc(ref, { owner: "alice" }));
      await assertSucceeds(getDoc(ref));
      await assertSucceeds(deleteDoc(ref));
    }
  });

  it("denies cross-user access and unknown top-level collections", async () => {
    const alice = dbFor("alice");
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore() as unknown as Firestore;
      await setDoc(doc(admin, "users", "bob", "books", "private"), {
        owner: "bob",
      });
    });

    const bobBook = doc(alice, "users", "bob", "books", "private");
    await assertFails(getDoc(bobBook));
    await assertFails(setDoc(bobBook, { owner: "alice" }));
    await assertFails(deleteDoc(bobBook));
    await assertFails(setDoc(doc(alice, "public", "unexpected"), { exposed: true }));
  });

  it("runs the production account-deletion helper without leaving supported descendants", async () => {
    const alice = dbFor("alice");
    await Promise.all([
      setDoc(doc(alice, "users", "alice"), { createdAt: 1 }),
      setDoc(doc(alice, "users", "alice", "books", "book-1"), { title: "One" }),
      setDoc(doc(alice, "users", "alice", "books", "book-1", "highlights", "h-1"), {
        text: "redacted",
      }),
      setDoc(doc(alice, "users", "alice", "books", "book-1", "bookmarks", "b-1"), {
        location: "chapter-1",
      }),
      setDoc(doc(alice, "users", "alice", "settings", "reader"), { theme: "paper" }),
      setDoc(doc(alice, "users", "alice", "tombstones", "book:book-1:"), {
        entity: "book",
        bookId: "book-1",
        deletedAt: 1,
      }),
    ]);

    await assertSucceeds(deleteFirestoreUserTree("alice", alice));

    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore() as unknown as Firestore;
      const [user, books, highlights, bookmarks, settings, tombstones] = await Promise.all([
        getDoc(doc(admin, "users", "alice")),
        getDocs(collection(admin, "users", "alice", "books")),
        getDocs(collection(admin, "users", "alice", "books", "book-1", "highlights")),
        getDocs(collection(admin, "users", "alice", "books", "book-1", "bookmarks")),
        getDocs(collection(admin, "users", "alice", "settings")),
        getDocs(collection(admin, "users", "alice", "tombstones")),
      ]);

      expect(user.exists()).toBe(false);
      expect(books.empty).toBe(true);
      expect(highlights.empty).toBe(true);
      expect(bookmarks.empty).toBe(true);
      expect(settings.empty).toBe(true);
      expect(tombstones.empty).toBe(true);
    });
  });

  it("applies remote tombstones before live records so a second device cannot resurrect deletes", async () => {
    const alice = dbFor("alice");
    const bookDeleteId = "deleted-book";
    const childDeleteBookId = "child-delete-book";
    const highlightId = "deleted-highlight";
    const bookmarkId = "deleted-bookmark";
    const baseBook = {
      title: "Old device copy",
      author: "Paperlike",
      format: "epub" as const,
      addedAt: 1,
      fileSize: 10,
      updatedAt: 10,
    };

    await Promise.all([
      upsertBookMetadata({ id: bookDeleteId, ...baseBook }),
      upsertBookMetadata({ id: childDeleteBookId, ...baseBook }),
      upsertHighlightLocal({
        id: highlightId,
        bookId: childDeleteBookId,
        location: "chapter-1",
        text: "old",
        color: "#fde68a",
        importance: 0,
        createdAt: 10,
        updatedAt: 10,
      }),
      upsertBookmarkLocal({
        id: bookmarkId,
        bookId: childDeleteBookId,
        location: "chapter-1",
        label: "Old",
        createdAt: 10,
        updatedAt: 10,
      }),
      setDoc(doc(alice, "users", "alice", "books", bookDeleteId), {
        ...baseBook,
        category: null,
      }),
      setDoc(doc(alice, "users", "alice", "books", childDeleteBookId), {
        ...baseBook,
        category: null,
      }),
      setDoc(
        doc(alice, "users", "alice", "books", childDeleteBookId, "highlights", highlightId),
        {
          location: "chapter-1",
          text: "old",
          color: "#fde68a",
          importance: 0,
          createdAt: 10,
          updatedAt: 10,
        }
      ),
      setDoc(
        doc(alice, "users", "alice", "books", childDeleteBookId, "bookmarks", bookmarkId),
        {
          location: "chapter-1",
          label: "Old",
          createdAt: 10,
          updatedAt: 10,
        }
      ),
      setDoc(
        doc(
          alice,
          "users",
          "alice",
          "tombstones",
          syncTombstoneId("book", bookDeleteId)
        ),
        { entity: "book", bookId: bookDeleteId, deletedAt: 20 }
      ),
      setDoc(
        doc(
          alice,
          "users",
          "alice",
          "tombstones",
          syncTombstoneId("highlight", childDeleteBookId, highlightId)
        ),
        {
          entity: "highlight",
          bookId: childDeleteBookId,
          itemId: highlightId,
          deletedAt: 20,
        }
      ),
      setDoc(
        doc(
          alice,
          "users",
          "alice",
          "tombstones",
          syncTombstoneId("bookmark", childDeleteBookId, bookmarkId)
        ),
        {
          entity: "bookmark",
          bookId: childDeleteBookId,
          itemId: bookmarkId,
          deletedAt: 20,
        }
      ),
    ]);

    await pullLibrarySnapshot("alice", alice);

    expect(await getBook(bookDeleteId)).toBeUndefined();
    expect(await getBook(childDeleteBookId)).toBeDefined();
    expect(await getHighlights(childDeleteBookId)).toEqual([]);
    expect(await getBookmarks(childDeleteBookId)).toEqual([]);
  });

  it("replays a persisted outbox mutation and removes it only after Firestore accepts it", async () => {
    const alice = dbFor("alice");
    const bookId = "outbox-restart-book";
    await upsertBookMetadata({
      id: bookId,
      title: "Restart-safe",
      author: "Paperlike",
      format: "pdf",
      addedAt: 100,
      fileSize: 200,
      updatedAt: 300,
    });
    await upsertSyncOutboxOperation(
      createSyncOutboxOperation("alice", "book", {
        bookId,
        now: 400,
      })
    );

    await drainSyncOutbox("alice", { force: true, database: alice });

    const remote = await getDoc(doc(alice, "users", "alice", "books", bookId));
    expect(remote.exists()).toBe(true);
    expect(remote.data()).toMatchObject({
      title: "Restart-safe",
      author: "Paperlike",
      updatedAt: 300,
    });
    expect(await getSyncOutboxOperations("alice")).toEqual([]);
  });
});
