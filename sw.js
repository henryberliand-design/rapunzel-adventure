// ============================================================
// Rapunzel's Great Adventure — Service Worker
// Cache-first strategy with full offline support
// Bump CACHE_VERSION to bust the cache after deploying updates
// ============================================================

const CACHE_VERSION = 3;
const CACHE_NAME = `rapunzel-v${CACHE_VERSION}`;

// Every deployable file in the project — nothing is missed
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/v1.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Legacy icon paths (in case old HTML references them)
  '/icon-192.png',
  '/icon-512.png'
];

// ─── INSTALL: pre-cache all assets ─────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE: clean up old caches ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('rapunzel-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── FETCH: cache-first with offline navigation fallback ───
self.addEventListener('fetch', event => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        // Serve from cache immediately
        // Also update cache in background (stale-while-revalidate for assets)
        const fetchPromise = fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => {});

        return cachedResponse;
      }

      // Not in cache — try network
      return fetch(request).then(networkResponse => {
        // Cache successful responses for future offline use
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return networkResponse;
      }).catch(() => {
        // Network failed and not in cache
        // For navigation requests, serve the cached index.html as fallback
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        // For other requests, return a simple offline response
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      });
    })
  );
});
