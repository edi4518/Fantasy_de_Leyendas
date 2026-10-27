/**
 * Service Worker - Fantasy de Leyendas PWA
 *
 * Responsabilidad:
 * Cacheo de activos estáticos (app shell, CSS, JS, fuentes), gestión de estrategias de
 * red/caché (Network First para API, Stale-While-Revalidate para UI estática) y habilitación offline.
 */

const CACHE_NAME = 'fantasy-leyendas-v1';
const STATIC_ASSETS = [
  '/',
  '/public/index.html',
  '/public/manifest.webmanifest',
  '/src/styles/design-tokens.css',
  '/src/styles/reset.css',
  '/src/styles/global.css',
  '/src/styles/layout.css',
  '/src/styles/components.css',
  '/src/app/main.js',
  '/src/app/router.js',
  '/src/app/navigation.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-cacheando App Shell estático');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Estrategia Network-first con fallback a cache para llamadas de navegación y assets
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => caches.match(event.request))
  );
});
