// One-way (device → cloud) sync: pushes the local library into Firestore so
// a signed-in user has a cloud copy. This does NOT pull anything back down
// yet — opening the app on a second device still starts from an empty local
// library. That "real cross-device sync" half is a separate, later step;
// see PROJECT_DOCUMENTATION.md § Faz F.
//
// Schema: users/{uid}/books/{bookId} (book metadata + its progress merged
// in), users/{uid}/books/{bookId}/highlights/{id}, .../bookmarks/{id}, and
// users/{uid}/settings/reader.
import { doc, writeBatch } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { getAllBooks, getAllMetadataForBackup } from "./storage";
import { useSettingsStore } from "@/store/useSettingsStore";
import type { ReaderSettings } from "./types";

const MAX_BATCH_OPS = 450; // Firestore's actual limit is 500 — leave headroom.

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
