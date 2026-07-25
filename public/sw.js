/* Service worker mínimo escrito à mão (estratégia injectManifest do vite-plugin-pwa).
 * O plugin injeta a lista de precache em `self.__WB_MANIFEST` no build.
 * Em dev o SW fica desativado (devOptions.enabled: false). */

// A referência a self.__WB_MANIFEST é obrigatória para o injectManifest funcionar.
const manifest = self.__WB_MANIFEST || [];

/* O nome do cache PRECISA mudar a cada build.
 *
 * Antes era a constante "dam-precache-v1". Como o `activate` só apaga caches
 * com nome DIFERENTE do atual, um nome fixo significava que nada nunca era
 * apagado: os arquivos de builds antigos ficavam guardados pra sempre e eram
 * servidos cache-first, sem revalidar. Foi um dos motivos da tela branca de
 * 24/07 — o celular seguia pedindo pedaços de um deploy que não existia mais.
 *
 * Agora o nome sai de um hash da própria lista de precache: mudou o build,
 * mudou o hash, e o `activate` limpa tudo que é velho. */
const buildSignature = manifest
  .map((entry) => (typeof entry === "string" ? entry : `${entry.url}:${entry.revision || ""}`))
  .join("|");

const buildHash = (() => {
  let h = 5381; // djb2
  for (let i = 0; i < buildSignature.length; i++) {
    h = ((h << 5) + h + buildSignature.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
})();

const PRECACHE = `dam-precache-${buildHash}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => {
      const urls = manifest.map((entry) => (typeof entry === "string" ? entry : entry.url));
      // Um a um em vez de cache.addAll: o addAll é atômico, então UM arquivo
      // falhando (rede instável no celular) descartava o precache inteiro em
      // silêncio e deixava o app sem nada guardado.
      return Promise.allSettled(urls.map((url) => cache.add(url)));
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
      fetch(request)
        .then((response) => {
          // Guarda a versão nova pro próximo acesso offline.
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(PRECACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request, { ignoreSearch: true })
            .then((r) => r || caches.match("/index.html"))
            .then((r) => r || fetch(request))
        )
    );
    return;
  }

  // Demais assets: cache-first, guardando o que vier da rede.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Nunca guardar resposta ruim, nem HTML no lugar de um arquivo do app
        // (era o que o rewrite catch-all da Vercel devolvia pra chunk antigo).
        // Guardar isso deixaria o app quebrado mesmo depois do deploy corrigido.
        const contentType = response.headers.get("content-type") || "";
        const isAsset = new URL(request.url).pathname.startsWith("/assets/");
        const looksLikeHtml = contentType.includes("text/html");
        if (response.ok && !(isAsset && looksLikeHtml)) {
          const copy = response.clone();
          caches.open(PRECACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      });
    })
  );
});
