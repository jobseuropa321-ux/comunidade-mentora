import type { SupportedLang } from '@/i18n/LanguageProvider';

/* Capa do módulo no idioma certo.
 *
 * O kit descreve DUAS convenções no app original — pasta espelho com fallback
 * no onError, e coluna `cover_url_es` no banco — e recomenda escolher uma. Na
 * primeira passada escolhi a coluna, pelo argumento de "trocar capa sem
 * deploy". Revisei: aqui a coluna guarda um CAMINHO de arquivo do próprio
 * repositório (`/covers/modulos/<slug>.webp`), não uma URL de upload. Trocar a
 * imagem exige deploy de qualquer forma, então o argumento não se aplica — e a
 * pasta espelho funciona sem depender de escrita no banco.
 *
 * A coluna continua ganhando quando estiver preenchida, então ela segue válida
 * como override pontual (a migration está escrita). O caminho normal é o
 * espelho.
 */

/** Converte /covers/modulos/x.webp em /covers/modulos/es/x.webp. */
export const esMirrorPath = (coverUrl: string): string =>
  coverUrl.replace('/covers/modulos/', '/covers/modulos/es/');

export const moduleCover = (
  m: { cover_url: string | null; cover_url_es?: string | null },
  lang: SupportedLang,
): string | null => {
  if (lang !== 'es') return m.cover_url;
  if (m.cover_url_es) return m.cover_url_es;          // override do banco
  return m.cover_url ? esMirrorPath(m.cover_url) : null;
};

/** Handler de erro para cair na capa em português quando a versão espanhola
 *  não existe. Necessário, não decorativo: hoje só parte dos módulos tem capa
 *  em espanhol, e sem isto o card fica com um buraco em vez de imagem.
 *  O guard `dataset.fb` impede loop se a capa PT também falhar. */
export const coverFallback = (originalUrl: string | null) =>
  (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.dataset.fb || !originalUrl) return;
    img.dataset.fb = '1';
    img.src = originalUrl;
  };
