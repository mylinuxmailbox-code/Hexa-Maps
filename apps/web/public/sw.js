/**
 * Hexa Maps Progressive Web App Service Worker (v1)
 * - Versioned app-shell & static asset cache
 * - Offline fallback for cached basemap vector tiles (.pbf) & glyphs (.pbf)
 */
const SHELL_CACHE = 'hexa-shell-v1';
const TILE_CACHE = 'hexa-tiles-v1';
const PRECACHE_URLS = ['/', '/manifest.webmanifest', '/icons/hexa-logo.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== TILE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cache-first with background refresh for vector tiles & font glyphs
  if (url.pathname.startsWith('/api/v1/tiles/') || url.pathname.startsWith('/api/v1/glyphs/')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const networkResp = await fetch(request);
          if (networkResp.ok && networkResp.status === 200) {
            cache.put(request, networkResp.clone());
          }
          return networkResp;
        } catch {
          return new Response('', { status: 204 });
        }
      }),
    );
    return;
  }

  // Network-first with cache fallback for navigation & static assets
  if (request.mode === 'navigate' || url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(request, clone));
          }
          return resp;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match('/')) || new Response('Offline', { status: 503 });
        }),
    );
  }
});
