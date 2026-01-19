
const CACHE_NAME = "piscina-limpa-v31"; // Incrementado de v30 para v31

const APP_SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './styles.css'
];

self.addEventListener("install", event => {
  console.log(`SW Install: Caching App Shell ${CACHE_NAME}`);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL_FILES);
    })
  );
  // Força o Service Worker a se tornar ativo imediatamente
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log("SW: Removendo cache antigo", key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  return self.clients.claim();
});

self.addEventListener("fetch", event => {
    const requestUrl = new URL(event.request.url);

    // Ignorar requisições externas críticas
    if (requestUrl.hostname.endsWith('googleapis.com') ||
        requestUrl.hostname.endsWith('gstatic.com') ||
        requestUrl.hostname.includes('firebase')) {
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match('./index.html') || caches.match('index.html');
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
