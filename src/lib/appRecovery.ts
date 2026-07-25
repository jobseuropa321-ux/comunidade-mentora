/* ═══════════════════════════════════════════════════════════════════════
 *  RECUPERAÇÃO DE BUILD OBSOLETO — antídoto da tela branca.
 *
 *  O app é servido em pedaços com hash no nome (`/assets/Home-a1b2c3.js`).
 *  A cada deploy os hashes mudam. Quem já tinha aberto o app antes fica com
 *  a referência antiga guardada (no service worker e/ou na aba aberta) e
 *  pede um arquivo que não existe mais.
 *
 *  Sem tratamento, esse import falha, o React derruba a árvore inteira e
 *  sobra só o fundo creme do CSS — foi exatamente o que aconteceu em 24/07.
 *
 *  Aqui a gente detecta esse erro específico e conserta: apaga o service
 *  worker + os caches e recarrega uma única vez por sessão (o limite evita
 *  loop infinito de reload se o problema for outro).
 * ═══════════════════════════════════════════════════════════════════════ */

/** Marca que já tentamos consertar nesta sessão. Usa sessionStorage de
 *  propósito: sobrevive ao reload da própria aba (que é o que precisamos
 *  limitar) e zera quando a pessoa abre o app de novo depois. */
const RECOVERY_KEY = 'dam_stale_build_recovery';

/** Mensagens que os navegadores usam quando um pedaço do app não carrega.
 *  Cada motor tem a sua — o Safari do iPhone, que é a maioria das alunas,
 *  fala "Importing a module script failed". */
const STALE_BUILD_SIGNS = [
  'dynamically imported module',        // Chrome / Firefox
  'importing a module script failed',   // Safari / iOS
  'module script failed',
  'failed to load module script',
  'loading chunk',
  'unable to preload css',
  'error loading dynamically imported module',
];

/** true quando o erro é "faltou um pedaço do app", e não um bug de código. */
export const isStaleBuildError = (err: unknown): boolean => {
  const msg = (
    err instanceof Error ? `${err.name}: ${err.message}` : String(err ?? '')
  ).toLowerCase();
  if (!msg) return false;
  if (STALE_BUILD_SIGNS.some((sign) => msg.includes(sign))) return true;
  // Servidor devolvendo HTML no lugar de JS (o bug do rewrite catch-all).
  return msg.includes('mime type') && msg.includes('text/html');
};

/** Já tentamos consertar nesta sessão? */
export const recoveryAlreadyAttempted = (): boolean => {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === '1';
  } catch {
    return false;
  }
};

const markRecoveryAttempt = () => {
  try {
    sessionStorage.setItem(RECOVERY_KEY, '1');
  } catch {
    /* modo privado do Safari pode bloquear — seguimos assim mesmo */
  }
};

/** Apaga service workers e caches. Isolado porque a tela de erro também
 *  usa isso no botão manual. */
const clearOfflineStorage = async () => {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => undefined)));
    }
  } catch {
    /* ignore */
  }
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => undefined)));
    }
  } catch {
    /* ignore */
  }
};

/**
 * Limpa tudo e recarrega. Retorna false se já tentamos nesta sessão —
 * nesse caso quem chamou deve mostrar a tela de erro em vez de insistir.
 *
 * @param force ignora o limite de 1 tentativa (usado no botão manual).
 */
export const recoverFromStaleBuild = async (force = false): Promise<boolean> => {
  if (!force && recoveryAlreadyAttempted()) return false;
  markRecoveryAttempt();
  await clearOfflineStorage();
  window.location.reload();
  return true;
};

/**
 * Rede de segurança global, para os erros que NÃO passam pelo ErrorBoundary
 * do React: promise rejeitada solta, falha de preload do Vite, e o `error`
 * de um <script>/<link> que não carregou.
 *
 * Chamado uma vez no boot, em main.tsx.
 */
export const installStaleBuildGuards = () => {
  // Vite avisa quando um modulepreload falha.
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    void recoverFromStaleBuild();
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isStaleBuildError(event.reason)) void recoverFromStaleBuild();
  });

  // Capture phase: erro de carregamento de <script>/<link> não borbulha.
  window.addEventListener(
    'error',
    (event) => {
      const el = event.target as (HTMLElement & { src?: string; href?: string }) | null;
      if (el && el !== (window as unknown as HTMLElement) && el.tagName) {
        const url = el.src || el.href || '';
        if (url.includes('/assets/')) void recoverFromStaleBuild();
        return;
      }
      if (isStaleBuildError(event.error ?? event.message)) void recoverFromStaleBuild();
    },
    true,
  );
};
