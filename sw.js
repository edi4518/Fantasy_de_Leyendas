/**
 * Service Worker - Fantasy de Leyendas PWA
 * Ciclo de vida optimizado para auto-actualización inmediata y sin interferencia de caché en APIs.
 */

const SW_VERSION = '1.3.0';

self.addEventListener('install', () => {
  // Forzar activación inmediata del nuevo service worker sin esperar a que se cierren pestañas
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Purgar cualquier caché residual anterior para que no sirva archivos viejos
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        return self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION });
          });
        });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  // Passthrough directo a red para garantizar que las respuestas siempre reflejen el último estado del backend y frontend
  event.respondWith(fetch(event.request));
});

