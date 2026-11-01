/**
 * Service Worker - Fantasy de Leyendas PWA (Modo Desarrollo Activo)
 * Desregistra cachés previas para reflejar cambios de inmediato.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Passthrough directo a red sin cacheo en desarrollo
  event.respondWith(fetch(event.request));
});
