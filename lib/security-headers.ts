// Single source of truth for the production web security headers (ISS-022).
// Statically-exported (`output: "export"`) Next.js has no server to attach
// HTTP response headers from, so the same policy has to be applied in two
// places that can't literally import this file:
// - `public/_headers` (Netlify / Cloudflare Pages convention)
// - `vercel.json` (Vercel's `headers` config)
// `lib/security-headers.test.ts` asserts both stay byte-identical to the
// `CONTENT_SECURITY_POLICY` string below, so an edit here that isn't mirrored
// fails CI instead of silently drifting.
//
// Directives, in order:
// - default-src 'self': baseline — nothing loads cross-origin unless a more
//   specific directive below allows it.
// - script-src 'self' 'unsafe-inline': Next.js's static export embeds its own
//   hydration/routing bootstrap as inline <script> tags with per-build
//   content hashes — verified empirically (production `out/` served and
//   loaded in Chromium): a strict 'self'-only policy blocks these and the
//   app never hydrates. The standard fix (per-request nonces) needs a
//   server to mint a fresh nonce per response; a static export has none.
//   Precomputing sha256 hashes per build is possible in principle but adds
//   a real build-pipeline step for a benefit CSP itself already gives up
//   once inline execution is allowed at all. 'self' still blocks loading an
//   arbitrary *external* <script src="https://evil.example/x.js">, which is
//   the more common real-world injection shape; the remaining risk here is
//   the same one 'unsafe-inline' always carries.
// - style-src 'self' 'unsafe-inline': Tailwind ships as an external
//   stylesheet, but a lot of UI (ShelfView spine colors, progress bars,
//   dynamic positioning) sets the `style` attribute directly — the CSP spec
//   treats that the same as an inline <style> block, so 'unsafe-inline' is
//   required here. Scripts staying inline-free is the actual XSS-relevant
//   protection; loosening style-src is a much smaller surface.
// - img-src 'self' blob: data:: book covers are cached as object URLs
//   (blob:) and small fallbacks as data URIs.
// - font-src 'self': `next/font/google` self-hosts the app-shell's fonts at
//   build time — no runtime Google Fonts request for the shell itself. (The
//   EPUB reader iframe is a separate, unrelated document this policy can't
//   and doesn't need to reach — see ISS-012.)
// - connect-src 'self' <google apis>: Firebase Auth/Firestore and Drive API
//   calls (see lib/firebase.ts, lib/cloud-sync.ts, lib/drive-sync.ts).
// - object-src 'none': no <object>/<embed>, nothing to allow.
// - base-uri 'self': stops a <base> tag injection from rewriting relative URLs.
// - form-action 'self': the app has no cross-origin form submissions.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://oauth2.googleapis.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/**
 * Headers that only make sense as real HTTP response headers, not an HTML
 * `<meta>` tag (`frame-ancestors` is explicitly meta-tag-incompatible per
 * spec; the others simply have no meta-tag equivalent). These only take
 * effect once a static host's `public/_headers`/`vercel.json` is actually
 * live — see the same two files referenced above.
 */
export const RESPONSE_ONLY_SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
