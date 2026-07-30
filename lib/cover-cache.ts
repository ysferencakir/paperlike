import { extractSpineColor } from "./extract-cover-color";
import { getBookCover } from "./storage";
import { createCoverThumbnail } from "./cover-thumbnail";

export const COVER_CACHE_MAX_ENTRIES = 96;
export const COVER_CACHE_MAX_BYTES = 32 * 1024 * 1024;

interface CacheEntry {
  bookId: string;
  blob: Blob | null;
  loaded: boolean;
  bytes: number;
  refs: number;
  url?: string;
  loadPromise?: Promise<Blob | undefined>;
  color?: string | null;
  colorPromise?: Promise<string | null>;
  invalidated?: boolean;
}

export interface CoverLease {
  blob: Blob;
  url: string;
  release: () => void;
}

interface CoverCacheOptions {
  maxEntries?: number;
  maxBytes?: number;
  load?: (bookId: string) => Promise<Blob | undefined>;
  prepare?: (blob: Blob) => Promise<Blob>;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
}

export class CoverCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private readonly load: (bookId: string) => Promise<Blob | undefined>;
  private readonly prepare: (blob: Blob) => Promise<Blob>;
  private readonly createObjectURL: (blob: Blob) => string;
  private readonly revokeObjectURL: (url: string) => void;
  private totalBytes = 0;

  constructor(options: CoverCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? COVER_CACHE_MAX_ENTRIES;
    this.maxBytes = options.maxBytes ?? COVER_CACHE_MAX_BYTES;
    this.load = options.load ?? getBookCover;
    this.prepare = options.prepare ?? createCoverThumbnail;
    this.createObjectURL =
      options.createObjectURL ?? ((blob) => URL.createObjectURL(blob));
    this.revokeObjectURL =
      options.revokeObjectURL ?? ((url) => URL.revokeObjectURL(url));
  }

  private touch(entry: CacheEntry): void {
    if (this.entries.get(entry.bookId) !== entry) return;
    this.entries.delete(entry.bookId);
    this.entries.set(entry.bookId, entry);
  }

  private getOrCreate(bookId: string): CacheEntry {
    const existing = this.entries.get(bookId);
    if (existing) {
      this.touch(existing);
      return existing;
    }
    const entry: CacheEntry = { bookId, blob: null, loaded: false, bytes: 0, refs: 0 };
    this.entries.set(bookId, entry);
    return entry;
  }

  private async ensureBlob(entry: CacheEntry): Promise<Blob | undefined> {
    if (entry.loaded) return entry.blob ?? undefined;
    if (entry.loadPromise) return entry.loadPromise;

    entry.loadPromise = this.load(entry.bookId)
      .then(async (source) => (source ? this.prepare(source) : undefined))
      .then((blob) => {
        entry.loadPromise = undefined;
        if (entry.invalidated) return blob;
        entry.blob = blob ?? null;
        entry.loaded = true;
        entry.bytes = blob?.size ?? 0;
        this.totalBytes += entry.bytes;
        this.touch(entry);
        this.evict();
        return blob;
      })
      .catch((error) => {
        entry.loadPromise = undefined;
        if (this.entries.get(entry.bookId) === entry) this.entries.delete(entry.bookId);
        throw error;
      });
    return entry.loadPromise;
  }

  async acquire(bookId: string): Promise<CoverLease | undefined> {
    const entry = this.getOrCreate(bookId);
    entry.refs += 1;
    try {
      const blob = await this.ensureBlob(entry);
      if (!blob || entry.invalidated) {
        this.release(entry);
        return undefined;
      }
      entry.url ??= this.createObjectURL(blob);
      let released = false;
      return {
        blob,
        url: entry.url,
        release: () => {
          if (released) return;
          released = true;
          this.release(entry);
        },
      };
    } catch (error) {
      this.release(entry);
      throw error;
    }
  }

  async getSpineColor(
    bookId: string,
    extract: (blob: Blob) => Promise<string | null> = extractSpineColor
  ): Promise<string | null> {
    const entry = this.getOrCreate(bookId);
    entry.refs += 1;
    try {
      const blob = await this.ensureBlob(entry);
      if (!blob || entry.invalidated) return null;
      if (entry.color !== undefined) return entry.color;
      entry.colorPromise ??= extract(blob)
        .then((color) => {
          entry.color = color;
          entry.colorPromise = undefined;
          return color;
        })
        .catch((error) => {
          entry.colorPromise = undefined;
          throw error;
        });
      return await entry.colorPromise;
    } finally {
      this.release(entry);
    }
  }

  private release(entry: CacheEntry): void {
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.invalidated && entry.refs === 0) {
      this.destroy(entry);
      return;
    }
    this.evict();
  }

  private destroy(entry: CacheEntry): void {
    if (entry.url) {
      this.revokeObjectURL(entry.url);
      entry.url = undefined;
    }
    entry.blob = null;
    entry.loaded = false;
    entry.bytes = 0;
  }

  private evict(): void {
    while (
      this.entries.size > this.maxEntries ||
      this.totalBytes > this.maxBytes
    ) {
      const candidate = Array.from(this.entries.values()).find(
        (entry) => entry.refs === 0 && !entry.loadPromise
      );
      if (!candidate) return;
      this.entries.delete(candidate.bookId);
      this.totalBytes -= candidate.bytes;
      this.destroy(candidate);
    }
  }

  invalidate(bookId: string): void {
    const entry = this.entries.get(bookId);
    if (!entry) return;
    this.entries.delete(bookId);
    this.totalBytes -= entry.bytes;
    entry.invalidated = true;
    if (entry.refs === 0 && !entry.loadPromise) this.destroy(entry);
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      entry.invalidated = true;
      if (entry.refs === 0 && !entry.loadPromise) this.destroy(entry);
    }
    this.entries.clear();
    this.totalBytes = 0;
  }

  stats(): { entries: number; bytes: number; activeLeases: number } {
    let activeLeases = 0;
    for (const entry of this.entries.values()) activeLeases += entry.refs;
    return { entries: this.entries.size, bytes: this.totalBytes, activeLeases };
  }
}

export const coverCache = new CoverCache();

export const invalidateCoverCache = (bookId: string) => coverCache.invalidate(bookId);
export const clearCoverCache = () => coverCache.clear();
