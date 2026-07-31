const CACHE_PREFIX = "paperlike-shell-";
const CACHE_VERSION = `${CACHE_PREFIX}v4`;
const STAGING_CACHE = `${CACHE_VERSION}-staging`;
const APP_SHELL = [
  "/",
  "/reader",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/pdf.worker.min.mjs",
  "/icons/paperlike.svg",
  "/icons/paperlike-maskable.svg",
  // Self-hosted reader-surface fonts (see EpubReaderSurface.tsx / ISS-012) —
  // not referenced by "/" or "/reader"'s own markup (they're only injected
  // into a book's iframe at runtime), so cachePageAndAssets() below can't
  // discover them by crawling those pages' HTML; they have to be listed
  // explicitly to actually work offline.
  "/fonts/reader-fonts.css",
  "/fonts/literata-normal-latin.woff2",
  "/fonts/literata-normal-latin-ext.woff2",
  "/fonts/literata-italic-latin.woff2",
  "/fonts/literata-italic-latin-ext.woff2",
  "/fonts/lora-normal-latin.woff2",
  "/fonts/lora-normal-latin-ext.woff2",
  "/fonts/lora-italic-latin.woff2",
  "/fonts/lora-italic-latin-ext.woff2",
  "/fonts/eb-garamond-normal-latin.woff2",
  "/fonts/eb-garamond-normal-latin-ext.woff2",
  "/fonts/eb-garamond-italic-latin.woff2",
  "/fonts/eb-garamond-italic-latin-ext.woff2",
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

async function validateAppShell(cache) {
  for (const path of APP_SHELL) {
    if (!(await cache.match(path))) {
      throw new Error(`Precache validation failed for ${path}`);
    }
  }
}

async function prepareAppShell() {
  await caches.delete(STAGING_CACHE);
  const staging = await caches.open(STAGING_CACHE);

  try {
    await staging.addAll(APP_SHELL.slice(2));
    await Promise.all(
      APP_SHELL.slice(0, 2).map((path) => cachePageAndAssets(staging, path))
    );
    await validateAppShell(staging);

    await caches.delete(CACHE_VERSION);
    const target = await caches.open(CACHE_VERSION);
    for (const request of await staging.keys()) {
      const response = await staging.match(request);
      if (!response) throw new Error(`Missing staged response for ${request.url}`);
      await target.put(request, response);
    }
    await validateAppShell(target);
    await caches.delete(STAGING_CACHE);
  } catch (error) {
    await Promise.all([caches.delete(STAGING_CACHE), caches.delete(CACHE_VERSION)]);
    throw error;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(prepareAppShell());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const activeCache = await caches.open(CACHE_VERSION);
      await validateAppShell(activeCache);
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

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  await Promise.all(clients.map((client) => client.postMessage(message)));
}

async function safeCachePut(cache, request, response) {
  try {
    await cache.put(request, response);
  } catch {
    try {
      await notifyClients({ type: "PWA_CACHE_ERROR" });
    } catch {
      // Cache reporting must never replace a valid network response with an error.
    }
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await safeCachePut(cache, request, response.clone());
    }
    return response;
  } catch {
    const cached =
      (await cache.match(request)) ||
      (await cache.match(new URL(request.url).pathname)) ||
      (await cache.match("/"));
    return cached || new Response("Paperlike is offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok && response.type !== "opaque") {
        await safeCachePut(cache, request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return (await network) || Response.error();
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
