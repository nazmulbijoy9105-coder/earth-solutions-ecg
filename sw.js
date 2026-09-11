// sw.js — Peopole AI v8.0 | Service Worker + Push Notifications
const CACHE_NAME  = 'peopole-ai-v8';
const OFFLINE_URL = '/index.html';

const CACHE_STATIC = [
  '/',
  '/index.html',
  '/style.css',
  '/frontend/chat.js',
  '/pricing.html',
  '/logo.jpg',
  '/manifest.json'
];

// ── INSTALL: cache static assets ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_STATIC).catch(err => console.warn('[SW] Cache partial fail:', err)))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean old caches ───────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── FETCH: network first for API, cache first for static ─────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept API or analytics calls
  if (url.pathname.startsWith('/api/')) return;

  // Cross-origin (fonts, etc) — network only
  if (url.origin !== location.origin) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 200 })));
    return;
  }

  // Navigation — network first, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Static assets — cache first, then network, then cache update
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (res && res.status === 200 && request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return res;
      }).catch(() => {
        if (request.destination === 'image') return new Response('', { status: 404 });
      });
    })
  );
});

// ── PUSH: receive push notifications from server ──────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'Peopole AI', body: 'New update from Earth Solutions', url: '/', icon: '/logo.jpg', badge: '/logo.jpg' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:  data.body,
      icon:  data.icon  || '/logo.jpg',
      badge: data.badge || '/logo.jpg',
      data:  { url: data.url || '/' },
      vibrate: [100, 50, 100],
      tag:  'peopole-ai-notification',
      renotify: true
    })
  );
});

// ── NOTIFICATION CLICK: open app ──────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── MESSAGE: skip waiting on demand ──────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
