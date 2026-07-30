// One-way (device → cloud) sync: pushes the local library into Firestore so
// a signed-in user has a cloud copy. This does NOT pull anything back down
// yet — opening the app on a second device still starts from an empty local
// library. That "real cross-device sync" half is a separate, later step;
// see PROJECT_DOCUMENTATION.md § Faz F.
//
// Schema: users/{uid}/books/{bookId} (book metadata + its progress merged
// in), users/{uid}/books/{bookId}/highlights/{id}, .../bookmarks/{id}, and
// users/{uid}/settings/reader.
import { deleteDoc, doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { getAllBooks, getAllMetadataForBackup } from "./storage";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAuthStore } from "@/store/useAuthStore";
import { deleteBookFileFromDrive, uploadBookFileToDrive } from "./drive-sync";
import type { Book, Bookmark, Highlight, ReaderSettings, ReadingProgress } from "./types";

const MAX_BATCH_OPS = 450; // Firestore's actual limit is 500 — leave headroom.

function currentUid(): string | null {
  return useAuthStore.getState().user?.uid ?? null;
}

function bookDoc(uid: string, bookId: string, db: NonNullable<ReturnType<typeof getFirebaseDb>>) {
  return doc(db, "users", uid, "books", bookId);
}

/**
 * Push a single book's metadata (and, if given, its progress) after a local
 * add/rename. No-ops when signed out or Firebase isn't configured — every
 * caller in lib/storage.ts fires this in the background and ignores
 * failures, so guest mode and offline use are never affected.
 */
export async function pushBook(book: Book, progress?: ReadingProgress): Promise<void> {
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  await setDoc(
    bookDoc(uid, book.id, db),
    {
      title: book.title,
      author: book.author,
      format: book.format,
      addedAt: book.addedAt,
      fileSize: book.fileSize,
      category: book.category ?? null,
      ...(progress
        ? {
            progress: {
              location: progress.location,
              percentage: progress.percentage,
              updatedAt: progress.updatedAt,
            },
          }
        : {}),
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

/** Push just the progress field for a book (reading position changed). */
export async function pushProgress(progress: ReadingProgress): Promise<void> {
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  await setDoc(
    bookDoc(uid, progress.bookId, db),
    {
      progress: {
        location: progress.location,
        percentage: progress.percentage,
        updatedAt: progress.updatedAt,
      },
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

/**
 * Uploads a newly-added book's file to the user's hidden Drive app folder
 * and records the returned file id on its Firestore doc. Google-only (no-op
 * for email/password accounts, which have no Drive access token) — see
 * lib/drive-sync.ts.
 */
export async function syncBookFileToDrive(book: Book, fileBlob: Blob): Promise<void> {
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  const filename = `${book.id}.${book.format}`;
  const fileId = await uploadBookFileToDrive(filename, fileBlob);
  if (!fileId) return;
  await setDoc(bookDoc(uid, book.id, db), { driveFileId: fileId, updatedAt: Date.now() }, { merge: true });
}

/** Removes a book (and, best-effort, its known highlight/bookmark docs, and its Drive file) from Firestore. */
export async function deleteBookRemote(
  bookId: string,
  highlightIds: string[] = [],
  bookmarkIds: string[] = []
): Promise<void> {
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  const ref = bookDoc(uid, bookId, db);
  const snapshot = await getDoc(ref);
  const driveFileId = snapshot.data()?.driveFileId as string | undefined;
  await Promise.all([
    deleteDoc(ref),
    ...highlightIds.map((id) => deleteDoc(doc(db, "users", uid, "books", bookId, "highlights", id))),
    ...bookmarkIds.map((id) => deleteDoc(doc(db, "users", uid, "books", bookId, "bookmarks", id))),
    driveFileId ? deleteBookFileFromDrive(driveFileId) : Promise.resolve(),
  ]);
}

export async function pushHighlight(highlight: Highlight): Promise<void> {
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  await setDoc(
    doc(db, "users", uid, "books", highlight.bookId, "highlights", highlight.id),
    { ...highlight, updatedAt: Date.now() },
    { merge: true }
  );
}

export async function deleteHighlightRemote(bookId: string, id: string): Promise<void> {
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  await deleteDoc(doc(db, "users", uid, "books", bookId, "highlights", id));
}

export async function pushBookmark(bookmark: Bookmark): Promise<void> {
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  await setDoc(
    doc(db, "users", uid, "books", bookmark.bookId, "bookmarks", bookmark.id),
    { ...bookmark, updatedAt: Date.now() },
    { merge: true }
  );
}

export async function deleteBookmarkRemote(bookId: string, id: string): Promise<void> {
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  await deleteDoc(doc(db, "users", uid, "books", bookId, "bookmarks", id));
}

/** Push the current reader settings (called whenever they change while signed in). */
export async function pushSettingsSnapshot(): Promise<void> {
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  const s = useSettingsStore.getState();
  const settings: ReaderSettings = {
    theme: s.theme,
    warmth: s.warmth,
    brightness: s.brightness,
    contrast: s.contrast,
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    margin: s.margin,
    columns: s.columns,
    columnsAutoManaged: s.columnsAutoManaged,
    scrollMode: s.scrollMode,
    volumeKeyPageTurn: s.volumeKeyPageTurn,
    pageTurnAnimation: s.pageTurnAnimation,
    autoNightMode: s.autoNightMode,
    customBg: s.customBg,
    customFg: s.customFg,
  };
  await setDoc(doc(db, "users", uid, "settings", "reader"), { ...settings, updatedAt: Date.now() }, { merge: true });
}

/**
 * Pushes the entire current local library (books, progress, highlights,
 * bookmarks, reader settings) to Firestore under this user's own subtree.
 * Safe to call repeatedly (e.g. once per sign-in) — every write uses
 * `merge: true` semantics via per-field `set`, so it never touches data
 * this device doesn't know about.
 *
 * Silently no-ops if Firebase isn't configured (no NEXT_PUBLIC_FIREBASE_*
 * env vars) — cloud sync is strictly opt-in on top of the local-first app.
 */
export async function pushLibrarySnapshot(uid: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;

  const [books, metadata] = await Promise.all([getAllBooks(), getAllMetadataForBackup()]);
  const progressByBook = new Map(metadata.progress.map((p) => [p.bookId, p]));

  let batch = writeBatch(db);
  let opsInBatch = 0;
  const pendingBatches: ReturnType<typeof writeBatch>[] = [];

  const enqueue = (ref: ReturnType<typeof doc>, data: Record<string, unknown>) => {
    if (opsInBatch >= MAX_BATCH_OPS) {
      pendingBatches.push(batch);
      batch = writeBatch(db);
      opsInBatch = 0;
    }
    batch.set(ref, data, { merge: true });
    opsInBatch++;
  };

  for (const book of books) {
    const progress = progressByBook.get(book.id);
    enqueue(doc(db, "users", uid, "books", book.id), {
      title: book.title,
      author: book.author,
      format: book.format,
      addedAt: book.addedAt,
      fileSize: book.fileSize,
      category: book.category ?? null,
      progress: progress
        ? { location: progress.location, percentage: progress.percentage, updatedAt: progress.updatedAt }
        : null,
      updatedAt: Date.now(),
    });
  }

  for (const highlight of metadata.highlights) {
    enqueue(
      doc(db, "users", uid, "books", highlight.bookId, "highlights", highlight.id),
      { ...highlight, updatedAt: Date.now() }
    );
  }

  for (const bookmark of metadata.bookmarks) {
    enqueue(
      doc(db, "users", uid, "books", bookmark.bookId, "bookmarks", bookmark.id),
      { ...bookmark, updatedAt: Date.now() }
    );
  }

  const s = useSettingsStore.getState();
  const settings: ReaderSettings = {
    theme: s.theme,
    warmth: s.warmth,
    brightness: s.brightness,
    contrast: s.contrast,
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    margin: s.margin,
    columns: s.columns,
    columnsAutoManaged: s.columnsAutoManaged,
    scrollMode: s.scrollMode,
    volumeKeyPageTurn: s.volumeKeyPageTurn,
    pageTurnAnimation: s.pageTurnAnimation,
    autoNightMode: s.autoNightMode,
    customBg: s.customBg,
    customFg: s.customFg,
  };
  enqueue(doc(db, "users", uid, "settings", "reader"), {
    ...settings,
    updatedAt: Date.now(),
  });

  pendingBatches.push(batch);
  for (const b of pendingBatches) await b.commit();
}
