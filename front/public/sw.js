const CACHE_NAME = 'liga-supersaludable-v1';
const APP_SHELL = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];
const STATIC_PATH_PREFIXES = ['/_astro/', '/img/', '/logos/', '/icons/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
      self.skipWaiting(),
    ]),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('liga-supersaludable-') && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const offlinePage = await caches.match('/offline.html');
        return offlinePage || Response.error();
      }),
    );
    return;
  }

  const isStaticAsset = STATIC_PATH_PREFIXES.some((prefix) =>
    url.pathname.startsWith(prefix),
  ) || url.pathname === '/favicon.ico';
  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((response) => {
        if (!response.ok) return response;
        const responseToCache = response.clone();
        return caches.open(CACHE_NAME).then((cache) =>
          cache.put(request, responseToCache).then(() => response),
        );
      });
    }),
  );
});
