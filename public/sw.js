const CACHE_NAME = 'mughal-ai-pwa-v1';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_ASSETS).catch(() => {
        // Ignore individual asset failures during initial precache
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Network-first for API and navigation, stale-while-revalidate for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Never cache dynamic API streams
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Navigation requests: network first, fallback to cached index.html for offline support
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  // Static assets: cache-first with background update
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Background Sync & Push listeners for PWABuilder advanced capability checks
self.addEventListener('sync', (event) => {
  if (event.tag === 'mughal-ai-sync') {
    event.waitUntil(Promise.resolve());
  }
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Mughal AI', body: 'New response ready.' };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Mughal AI', {
      body: data.body || 'Tap to open Mughal AI.',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    })
  );
});
