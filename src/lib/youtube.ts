/* Links do YouTube colados no admin (watch, live, youtu.be, shorts) NÃO podem
 * ir direto pro src de um iframe: o YouTube bloqueia essas páginas em frame e
 * a aluna vê "Este conteúdo está bloqueado". Só a rota /embed/ID funciona. */

/** Extrai o ID do vídeo de um link do YouTube (watch, live, embed, shorts, youtu.be). */
export const getYouTubeVideoId = (rawUrl: string | null | undefined): string | null => {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl.trim());
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
      // /watch?v=ID
      const v = u.searchParams.get('v');
      if (v) return v;
      // /live/ID  /embed/ID  /shorts/ID
      const m = u.pathname.match(/^\/(?:live|embed|shorts)\/([^/?]+)/);
      return m ? m[1] : null;
    }
    if (host === 'youtu.be') {
      const m = u.pathname.match(/^\/([^/?]+)/);
      return m ? m[1] : null;
    }
    return null;
  } catch {
    return null;
  }
};

/** URL de embed do YouTube, ou null se o link não for do YouTube. */
export const buildYouTubeEmbedUrl = (
  rawUrl: string | null | undefined,
  opts: { autoplay?: boolean } = {},
): string | null => {
  const videoId = getYouTubeVideoId(rawUrl);
  if (!videoId) return null;
  const params = new URLSearchParams({ playsinline: '1', rel: '0' });
  if (opts.autoplay) params.set('autoplay', '1');
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
};

/** Src pronto pro iframe: YouTube vira /embed, qualquer outro link (Panda,
 *  Vimeo, embed já pronto) passa direto. */
export const toEmbedSrc = (rawUrl: string | null | undefined): string | null => {
  if (!rawUrl) return null;
  return buildYouTubeEmbedUrl(rawUrl) ?? rawUrl;
};
