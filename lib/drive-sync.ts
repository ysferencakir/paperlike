// Google Drive file storage for book files (epub/pdf). Uses the `drive.file`
// scope — the app can only see/manage files (and folders) it created itself.
// Files go into a regular, visible "Paperlike" folder in the user's own My
// Drive (NOT the hidden appDataFolder space — that requires the separate,
// more sensitive `drive.appdata` scope, which `drive.file` does not grant;
// files.create with parents: ["appDataFolder"] under `drive.file` alone
// fails with 403 "insufficientScopes"). A visible folder also means the user
// can actually see what's been uploaded, which is arguably more transparent
// anyway.
//
// Only available for users signed in with Google — email/password accounts
// have no Google OAuth access token, so every function here degrades to a
// no-op (returns null) for them, same as the rest of cloud sync degrades for
// guests.
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { useAuthStore } from "@/store/useAuthStore";
import { deleteDriveUploadSession, getDriveUploadSession, saveDriveUploadSession } from "./storage";

export const DRIVE_SIGNIN_SCOPES = ["https://www.googleapis.com/auth/drive.file"];

// Google access tokens last ~60 minutes; refresh a little early rather than
// racing an in-flight upload against the real expiry.
const TOKEN_LIFETIME_MS = 55 * 60 * 1000;

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Called right after a successful Google sign-in, so the first Drive call doesn't need its own round trip. */
export function cacheDriveAccessToken(accessToken: string | undefined): void {
  if (!accessToken) return;
  cachedToken = { value: accessToken, expiresAt: Date.now() + TOKEN_LIFETIME_MS };
}

export function clearDriveAccessToken(): void {
  cachedToken = null;
  cachedFolderId = null;
}

/**
 * Returns a valid Drive-scoped access token, silently re-running Google
 * sign-in to refresh it if the cached one has expired. Returns null if
 * there's no signed-in Google user (guest, or an email/password account).
 */
async function getDriveAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  if (!useAuthStore.getState().user) return null;
  try {
    const result = await FirebaseAuthentication.signInWithGoogle({ scopes: DRIVE_SIGNIN_SCOPES });
    cacheDriveAccessToken(result.credential?.accessToken);
    return cachedToken?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Distinguishes the kinds of Drive failures the rest of the app needs to
 * react to differently:
 * - "quota_exceeded": the user's Drive storage is full (403, reason storageQuotaExceeded).
 * - "permission_denied": the OAuth grant was revoked/insufficient (401, or 403 for any other reason).
 * - "not_found": the target file id (or resumable session) no longer exists on Drive (404).
 * - "network": anything else — timeouts, 5xx, offline, unparseable response. Retried once before surfacing.
 */
export type DriveSyncErrorKind = "quota_exceeded" | "permission_denied" | "not_found" | "network";

export class DriveSyncError extends Error {
  readonly kind: DriveSyncErrorKind;
  readonly status?: number;
  readonly reason?: string;

  constructor(kind: DriveSyncErrorKind, message: string, status?: number, reason?: string) {
    super(message);
    this.name = "DriveSyncError";
    this.kind = kind;
    this.status = status;
    this.reason = reason;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Shape of the JSON error body Google's APIs return on non-2xx responses. */
interface GoogleErrorBody {
  error?: {
    message?: string;
    status?: string;
    errors?: { reason?: string }[];
  };
}

/** Inspects a failed response's JSON body (falling back to bare HTTP status if it isn't parseable) and classifies it. */
async function classifyDriveError(res: Response, action: string): Promise<DriveSyncError> {
  let reason: string | undefined;
  let googleMessage: string | undefined;
  try {
    const body = (await res.json()) as GoogleErrorBody;
    googleMessage = body.error?.message;
    reason = body.error?.errors?.[0]?.reason ?? body.error?.status;
  } catch {
    // Body wasn't JSON (or already consumed) — fall back to the bare HTTP status below.
  }

  const detail = googleMessage ? `${action}: ${googleMessage} (HTTP ${res.status})` : `${action}: HTTP ${res.status}`;

  if (res.status === 404 || res.status === 410) {
    return new DriveSyncError("not_found", detail, res.status, reason);
  }
  if (res.status === 403 && reason === "storageQuotaExceeded") {
    return new DriveSyncError("quota_exceeded", detail, res.status, reason);
  }
  if (res.status === 401 || res.status === 403) {
    return new DriveSyncError("permission_denied", detail, res.status, reason);
  }
  return new DriveSyncError("network", detail, res.status, reason);
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 && status < 600;
}

const RETRY_DELAY_MS = 1000;

/**
 * Runs a single Drive API request, retrying exactly once (after a short
 * backoff) on transient failures — a thrown fetch (offline/DNS/etc.) or an
 * HTTP 5xx. Quota, permission, and not-found responses are definitive and
 * are classified and thrown immediately, since retrying them can't help.
 *
 * `passthroughStatuses` lets callers treat specific non-ok statuses (e.g.
 * 404 on delete, where "already gone" is a success) as an ok response
 * instead of an error.
 */
async function driveRequest(
  action: string,
  input: string,
  init: RequestInit,
  passthroughStatuses: number[] = []
): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(input, init);
    } catch (err) {
      if (attempt === 0) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw new DriveSyncError(
        "network",
        `${action}: network error (${err instanceof Error ? err.message : String(err)})`
      );
    }

    if (res.ok || passthroughStatuses.includes(res.status)) return res;

    if (isRetryableStatus(res.status) && attempt === 0) {
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    throw await classifyDriveError(res, action);
  }
  // Unreachable — the loop above always either returns or throws.
  throw new DriveSyncError("network", `${action}: retries exhausted`);
}

const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const APP_FOLDER_NAME = "Paperlike";

// Cached per app session — costs one extra Drive API round trip per launch
// instead of per upload.
let cachedFolderId: string | null = null;

/** Finds (or creates, on first use) the "Paperlike" folder this app uploads book files into. */
async function getOrCreateAppFolder(token: string): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER_NAME}' and trashed=false`
  );
  const searchRes = await fetch(`${DRIVE_FILES_URL}?q=${query}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (searchRes.ok) {
    const { files } = (await searchRes.json()) as { files: { id: string }[] };
    if (files.length > 0) {
      cachedFolderId = files[0].id;
      return cachedFolderId;
    }
  }

  const createRes = await driveRequest("Drive folder creation", `${DRIVE_FILES_URL}?fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: APP_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  const created = (await createRes.json()) as { id: string };
  cachedFolderId = created.id;
  return cachedFolderId;
}

/**
 * Thrown for a resumable-upload failure that means the session itself is
 * unusable (expired, or Drive rejected it outright) — the caller should
 * discard the persisted session and start a brand new upload attempt next
 * time, rather than trying to resume this one again. Carries the classified
 * `DriveSyncError` so it can still be surfaced to the user with the right
 * message once the session bookkeeping is done.
 */
class DriveResumableSessionInvalidError extends Error {
  constructor(readonly driveError: DriveSyncError) {
    super(driveError.message);
  }
}

/** Starts a new resumable-upload session, returning the session URI (Drive's `Location` response header) that subsequent PUTs target. */
async function initiateResumableSession(
  token: string,
  folderId: string,
  filename: string,
  mimeType: string
): Promise<string> {
  const metadata = { name: filename, parents: [folderId] };
  const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=resumable&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
    },
    body: JSON.stringify(metadata),
  });
  if (!res.ok) throw await classifyDriveError(res, "Drive resumable session init");
  const sessionUri = res.headers.get("Location");
  if (!sessionUri) {
    throw new DriveSyncError("network", "Drive resumable session init returned no Location header");
  }
  return sessionUri;
}

type ResumableStatus =
  | { done: true; fileId: string }
  | { done: false; bytesReceived: number };

/**
 * Asks Drive how much of a resumable session's content it has actually
 * received so far, per the protocol's status-check convention: an empty PUT
 * with a `Content-Range: bytes (star)/<total>` probe (an asterisk in place
 * of the byte range). A 308 response's `Range`
 * header gives the last received byte; a 200/201 means the upload had
 * actually already finished (e.g. our previous attempt's response was lost
 * to a network drop after Drive had already committed the file).
 */
async function checkResumableStatus(sessionUri: string, totalBytes: number): Promise<ResumableStatus> {
  const res = await fetch(sessionUri, {
    method: "PUT",
    headers: { "Content-Range": `bytes */${totalBytes}` },
  });
  if (res.status === 200 || res.status === 201) {
    const data = (await res.json()) as { id: string };
    return { done: true, fileId: data.id };
  }
  if (res.status === 308) {
    const range = res.headers.get("Range");
    const match = range ? /bytes=0-(\d+)/.exec(range) : null;
    return { done: false, bytesReceived: match ? parseInt(match[1], 10) + 1 : 0 };
  }
  // 404/410 = session expired/unknown; other 4xx = Drive rejected the
  // session outright. Either way it can't be resumed.
  throw new DriveResumableSessionInvalidError(await classifyDriveError(res, "Drive resumable status check"));
}

/** PUTs the blob's content starting at `offset` to an already-initiated resumable session. */
async function putResumableContent(
  sessionUri: string,
  blob: Blob,
  offset: number,
  totalBytes: number
): Promise<ResumableStatus> {
  const chunk = offset > 0 ? blob.slice(offset) : blob;
  const res = await fetch(sessionUri, {
    method: "PUT",
    headers: {
      "Content-Range": `bytes ${offset}-${totalBytes - 1}/${totalBytes}`,
      "Content-Length": String(chunk.size),
    },
    body: chunk,
  });
  if (res.status === 200 || res.status === 201) {
    const data = (await res.json()) as { id: string };
    return { done: true, fileId: data.id };
  }
  if (res.status === 308) {
    // Drive accepted the bytes but considers the upload still incomplete
    // (shouldn't normally happen for a single PUT of all remaining bytes,
    // but handle it gracefully rather than assuming failure).
    const range = res.headers.get("Range");
    const match = range ? /bytes=0-(\d+)/.exec(range) : null;
    return { done: false, bytesReceived: match ? parseInt(match[1], 10) + 1 : offset };
  }
  if (res.status >= 400 && res.status < 500) {
    throw new DriveResumableSessionInvalidError(await classifyDriveError(res, "Drive resumable upload"));
  }
  throw await classifyDriveError(res, "Drive resumable upload");
}

/**
 * Uploads a new file into the app's "Paperlike" Drive folder using Google
 * Drive's resumable-upload protocol, returning its Drive file id.
 *
 * If a resumable session for this book id was persisted by a previous,
 * interrupted attempt (network drop, app backgrounded/killed mid-transfer),
 * this resumes it from the last byte Drive actually received instead of
 * restarting the transfer from scratch. On success (or once Drive confirms
 * the file already exists from an earlier attempt), the persisted session is
 * cleared. On an unrecoverable failure — an expired/rejected session, or a
 * non-retryable 4xx — the persisted session is discarded so the next call
 * starts a fresh upload attempt; other (likely transient) failures leave the
 * session in place so the next call can resume it.
 *
 * Throws a `DriveSyncError` on a genuine failure so the caller can surface
 * it to the user; returns `null` only for the legitimate no-op cases (no
 * signed-in Google user, or the upload is still in flight and will resume
 * on the next attempt).
 */
export async function uploadBookFileToDrive(bookId: string, filename: string, blob: Blob): Promise<string | null> {
  const token = await getDriveAccessToken();
  if (!token) return null;

  const totalBytes = blob.size;
  const existing = await getDriveUploadSession(bookId);

  let sessionUri: string | null = null;
  let offset = 0;

  if (existing && existing.totalBytes === totalBytes) {
    try {
      const status = await checkResumableStatus(existing.sessionUri, totalBytes);
      if (status.done) {
        await deleteDriveUploadSession(bookId);
        return status.fileId;
      }
      sessionUri = existing.sessionUri;
      offset = status.bytesReceived;
    } catch (err) {
      if (err instanceof DriveResumableSessionInvalidError) {
        // Session expired or Drive rejected it outright — discard it and
        // fall through to starting a brand new upload below.
        await deleteDriveUploadSession(bookId);
      } else {
        // Network failure just querying status — keep the session around
        // and try resuming from it directly; worst case Drive re-reports
        // the real offset via a 308 on this very PUT.
        sessionUri = existing.sessionUri;
        offset = 0;
      }
    }
  } else if (existing) {
    // Stale session (file size changed since) — can't be resumed.
    await deleteDriveUploadSession(bookId);
  }

  if (!sessionUri) {
    const folderId = await getOrCreateAppFolder(token);
    sessionUri = await initiateResumableSession(token, folderId, filename, blob.type || "application/octet-stream");
    await saveDriveUploadSession({ bookId, sessionUri, filename, totalBytes, createdAt: Date.now() });
    offset = 0;
  }

  try {
    const result = await putResumableContent(sessionUri, blob, offset, totalBytes);
    if (!result.done) {
      // Drive still hasn't confirmed the full file after PUTting everything
      // we had — leave the session persisted so a later call can resume
      // from wherever it actually got to. Not a failure, so no toast.
      console.error(`Drive resumable upload for "${filename}" did not complete in one pass; will resume next attempt`);
      return null;
    }
    await deleteDriveUploadSession(bookId);
    return result.fileId;
  } catch (err) {
    if (err instanceof DriveResumableSessionInvalidError) {
      await deleteDriveUploadSession(bookId);
      throw err.driveError;
    }
    throw err;
  }
}

/** Replaces the content of an already-uploaded Drive file (e.g. re-syncing after a local edit). */
export async function updateBookFileInDrive(fileId: string, blob: Blob): Promise<void> {
  const token = await getDriveAccessToken();
  if (!token) return;
  await driveRequest("Drive update", `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": blob.type || "application/octet-stream",
    },
    body: blob,
  });
}

/** Downloads a book file's content by its Drive file id. Not wired up to any UI flow yet — see Faz F "pull". */
export async function downloadBookFileFromDrive(fileId: string): Promise<Blob | null> {
  const token = await getDriveAccessToken();
  if (!token) return null;
  const res = await driveRequest("Drive download", `${DRIVE_FILES_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.blob();
}

export async function deleteBookFileFromDrive(fileId: string): Promise<void> {
  const token = await getDriveAccessToken();
  if (!token) return;
  // 404 just means it's already gone — that's a passthrough success, not an error.
  await driveRequest(
    "Drive delete",
    `${DRIVE_FILES_URL}/${fileId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    [404]
  );
}
