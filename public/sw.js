const CACHE_NAME = "piscina-limpa-v56";

const APP_SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/index.css'
];

self.addEventListener("install", event => {
  console.log(`[SW v56] Instalando...`);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  console.log("[SW v56] Ativando e limpando caches antigos...");
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
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

  if (
    requestUrl.hostname.includes('googleapis.com') ||
    requestUrl.hostname.includes('gstatic.com') ||
    requestUrl.hostname.includes('firebase') ||
    requestUrl.pathname.includes('/api/')
  ) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});