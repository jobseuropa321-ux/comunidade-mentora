import type { SupportedLang } from '@/i18n/LanguageProvider';

/* Capa do módulo no idioma certo.
 *
 * O kit descreve DUAS convenções no app original (pasta espelho /covers/es/
 * com fallback no onError, e coluna cover_url_es no banco) e recomenda
 * escolher uma. Aqui é a coluna: dá pra trocar a capa sem deploy, e não
 * depende de um 404 acontecer pra descobrir que a imagem não existe.
 *
 * Enquanto não houver capa em espanhol, cai na capa padrão — melhor uma capa
 * em português do que um buraco na tela.
 */
export const moduleCover = (
  m: { cover_url: string | null; cover_url_es?: string | null },
  lang: SupportedLang,
): string | null => (lang === 'es' && m.cover_url_es ? m.cover_url_es : m.cover_url);
