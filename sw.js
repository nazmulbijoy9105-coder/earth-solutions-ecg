/* Peopole AI — sw.js v3.0 | Service Worker */

const CACHE_NAME  = 'peopole-ai-v3';
const OFFLINE_URL = '/index.html';

const CACHE_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/frontend/chat.js',
  '/logo.jpg',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(CACHE_FILES).catch(err =>
        console.warn('[SW] Cache partial failure:', err)
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept API calls
  if (url.pathname.startsWith('/api/')) return;

  // Cross-origin (fonts etc) — network only
  if (url.origin !== location.origin) {
    event.respondWith(fetch(event.request).catch(() => new Response('')));
    return;
  }

  // Navigation — network first, fallback to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Static assets — cache first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res && res.status === 200 && event.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(() => {
        if (event.request.destination === 'image') return new Response('', { status: 404 });
      });
    })
  );
});
