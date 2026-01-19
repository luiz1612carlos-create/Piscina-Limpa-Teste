
const CACHE_NAME = "piscina-limpa-v39";

const APP_SHELL_FILES = [
  './index.html',
  './manifest.json',
  './styles.css'
];

self.addEventListener("install", event => {
  console.log(`[SW v39] Instalando...`);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  console.log("[SW v39] Ativando e limpando caches antigos...");
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

  // Não cacheia chamadas de API ou Firebase
  if (
    requestUrl.hostname.includes('googleapis.com') ||
    requestUrl.hostname.includes('gstatic.com') ||
    requestUrl.hostname.includes('firebase') ||
    requestUrl.pathname.includes('/api/')
  ) {
    return;
  }

  // Estratégia Network First para navegação para garantir index.html sempre novo
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache First para outros recursos
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
