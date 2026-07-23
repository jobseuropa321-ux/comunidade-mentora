/* Service worker mínimo escrito à mão (estratégia injectManifest do vite-plugin-pwa).
 * O plugin injeta a lista de precache em `self.__WB_MANIFEST` no build.
 * Em dev o SW fica desativado (devOptions.enabled: false). */

const PRECACHE = "dam-precache-v1";

// A referência a self.__WB_MANIFEST é obrigatória para o injectManifest funcionar.
const manifest = self.__WB_MANIFEST || [];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => {
      const urls = manifest.map((entry) => (typeof entry === "string" ? entry : entry.url));
      return cache.addAll(urls).catch(() => undefined);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== PRECACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Navegações (SPA): network-first; offline tenta a própria página no cache
  // (ex.: /ferramentas/edicao-ia/index.html precacheada) antes do shell do SPA.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match(request, { ignoreSearch: true })
          .then((r) => r || caches.match("/index.html"))
          .then((r) => r || fetch(request))
      )
    );
    return;
  }

  // Demais assets: cache-first.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
