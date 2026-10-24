/*
 * Service worker template.
 *
 * The build step (`scripts/gen-sw.mjs`) injects the real precache list and a
 * cache version derived from the CONTENT of those files, so a changed file
 * invalidates the old cache on its own.
 *
 * The paths are RELATIVE on purpose: the app is served from a subpath
 * (github.io/<slug>/), and an absolute path would look for assets at the root
 * of the domain, where they do not exist.
 */
// Injected by scripts/gen-sw.mjs: the real precache list of the build and a
// version derived from the content of those files.
const PRECACHE_ASSETS = [];
const CACHE_NAME = "kanam-sudoku-cache-v{{VERSION}}";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_ASSETS.map((asset) => new Request(asset, { cache: "reload" }))),
    ),
  );
  // Take over as soon as the new worker is installed.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache that is not the current one.
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * The path of a request relative to the service worker's scope.
 *
 * The precache list holds relative paths ("./assets/app.js"), and a request
 * carries an absolute one ("/kanam-sudoku-iphone/assets/app.js"). Comparing
 * them directly never matches, which is what makes an offline load fall back
 * to the network and fail.
 */
const relativePath = (pathname) => {
  // `scope` is a directory URL, so it normally ends with "/". Normalise anyway:
  // a scope without the trailing slash would make `slice` drop the last
  // character of the path and the cache lookup would miss every asset.
  const raw = new URL(self.registration.scope).pathname;
  const scope = raw.endsWith("/") ? raw : raw + "/";
  if (!pathname.startsWith(scope)) return pathname;
  return "./" + pathname.slice(scope.length);
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // A navigation offline is served by the precached index.html.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match("./index.html");
          return (
            cached ??
            new Response("Offline and no cached copy of the app.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })(),
    );
    return;
  }

  // A precached asset is served from the cache, online or not.
  const key = relativePath(url.pathname);
  if (PRECACHE_ASSETS.includes(key)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(key);
        if (cached) return cached;
        try {
          return await fetch(request);
        } catch {
          return new Response("", { status: 504 });
        }
      })(),
    );
  }
});
