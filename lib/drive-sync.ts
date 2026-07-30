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

  const createRes = await fetch(`${DRIVE_FILES_URL}?fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: APP_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!createRes.ok) throw new Error(`Drive folder creation failed: ${createRes.status}`);
  const created = (await createRes.json()) as { id: string };
  cachedFolderId = created.id;
  return cachedFolderId;
}

/** Uploads a new file into the app's "Paperlike" Drive folder, returning its Drive file id. */
export async function uploadBookFileToDrive(filename: string, blob: Blob): Promise<string | null> {
  const token = await getDriveAccessToken();
  if (!token) return null;
  const folderId = await getOrCreateAppFolder(token);

  const metadata = { name: filename, parents: [folderId] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", blob);

  const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Replaces the content of an already-uploaded Drive file (e.g. re-syncing after a local edit). */
export async function updateBookFileInDrive(fileId: string, blob: Blob): Promise<void> {
  const token = await getDriveAccessToken();
  if (!token) return;
  const res = await fetch(`${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": blob.type || "application/octet-stream",
    },
    body: blob,
  });
  if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
}

/** Downloads a book file's content by its Drive file id. Not wired up to any UI flow yet — see Faz F "pull". */
export async function downloadBookFileFromDrive(fileId: string): Promise<Blob | null> {
  const token = await getDriveAccessToken();
  if (!token) return null;
  const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  return res.blob();
}

export async function deleteBookFileFromDrive(fileId: string): Promise<void> {
  const token = await getDriveAccessToken();
  if (!token) return;
  const res = await fetch(`${DRIVE_FILES_URL}/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  // 404 just means it's already gone — fine either way.
  if (!res.ok && res.status !== 404) throw new Error(`Drive delete failed: ${res.status}`);
}
