/*
 * Chess AI Arena service worker.
 *
 * Goal: an honest, lightweight offline story — after the first successful visit
 * the app shell (including the hashed JS/CSS bundle) and the Stockfish
 * WebAssembly engine are cached locally, so a game keeps working offline.
 *
 * Strategy:
 *   - install : cache the shell, the assets referenced by index.html and the engine
 *   - navigation requests : network first, fall back to the cached shell
 *   - static assets       : stale-while-revalidate
 *   - other requests      : straight to the network
 *
 * Matching ignores the Vary header: every cached entry is a public, same-origin
 * static asset (no cookies, no per-user content), and hosts such as `vite
 * preview` reply with `Vary: Origin`, which would otherwise miss for script and
 * style requests.
 *
 * Deploys bump CACHE_VERSION, which removes older caches on activation.
 */
const CACHE_VERSION = 'chess-ai-arena-v3';
const CORE_ASSETS = [
  './',
  './index.html',
  './favicon.svg',
  './engine/stockfish-19-lite-single.js',
  './engine/stockfish-19-lite-single.wasm',
];
const MATCH = { ignoreVary: true };

function absolute(path) {
  return new URL(path, self.registration.scope).toString();
}

async function precache() {
  const cache = await caches.open(CACHE_VERSION);
  const requests = CORE_ASSETS.map((asset) => new Request(absolute(asset), { cache: 'reload' }));

  // Discover the hashed bundle referenced by index.html so the app boots offline.
  try {
    const response = await fetch(absolute('./index.html'), { cache: 'reload' });
    if (response.ok) {
      const html = await response.clone().text();
      await cache.put(absolute('./index.html'), response);
      const discovered = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((url) => !url.startsWith('data:') && !url.startsWith('http') && !url.startsWith('#'))
        .map((url) => new Request(absolute(url), { cache: 'reload' }));
      requests.push(...discovered);
    }
  } catch {
    // Offline installs simply keep whatever the runtime cache already holds.
  }

  await Promise.allSettled(requests.map((request) => cache.add(request)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          return (
            (await cache.match(request, MATCH)) ||
            (await cache.match(absolute('./index.html'), MATCH)) ||
            (await cache.match(absolute('./'), MATCH)) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(request, MATCH);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);
      return cached || (await network) || Response.error();
    })(),
  );
});
