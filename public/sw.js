const CACHE_PREFIX = "paperlike-shell-";
const CACHE_VERSION = `${CACHE_PREFIX}v2`;
const APP_SHELL = [
  "/",
  "/reader",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/pdf.worker.min.mjs",
  "/icons/paperlike.svg",
  "/icons/paperlike-maskable.svg",
];

async function cachePageAndAssets(cache, path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Unable to precache ${path}`);
  await cache.put(path, response.clone());

  const html = await response.text();
  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((asset) => asset.startsWith("/_next/"));
  await Promise.all(
    [...new Set(assetPaths)].map(async (asset) => {
      const assetResponse = await fetch(asset, { cache: "no-cache" });
      if (assetResponse.ok) await cache.put(asset, assetResponse);
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(APP_SHELL.slice(2));
      await Promise.all(APP_SHELL.slice(0, 2).map((path) => cachePageAndAssets(cache, path)));
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(request)) ||
      (await cache.match(new URL(request.url).pathname)) ||
      (await cache.match("/"))
    );
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok && response.type !== "opaque") {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return network;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, event));
});
