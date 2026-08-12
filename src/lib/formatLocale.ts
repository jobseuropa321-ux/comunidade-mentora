/* Formatação de data e número que acompanha o idioma da URL.
 *
 * Existe porque `toLocaleDateString('pt-BR')` espalhado pelo app é invisível:
 * não gera erro, não aparece em busca por string em português, e entrega
 * "12 de ago." e "1.234" no meio de uma tela em espanhol. No app original do
 * kit isso passou batido em Dashboard, Chat, Biblioteca e Comunidade.
 *
 * O painel Admin fica de fora de propósito: ele não é traduzido (decisão do
 * kit), então continua em pt-BR.
 */
import type { SupportedLang } from '@/i18n/LanguageProvider';

export const localeTag = (lang: SupportedLang): string => (lang === 'es' ? 'es-ES' : 'pt-BR');

/** Data curta: "12 ago" / "12 ago". */
export const formatDateShort = (iso: string, lang: SupportedLang): string =>
  new Date(iso).toLocaleDateString(localeTag(lang), { day: '2-digit', month: 'short' });

/** Data por extenso numérica: "12/08/2026". */
export const formatDateNumeric = (iso: string | Date, lang: SupportedLang): string =>
  new Date(iso).toLocaleDateString(localeTag(lang), { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Número com separador de milhar do idioma. */
export const formatNumber = (n: number, lang: SupportedLang): string =>
  n.toLocaleString(localeTag(lang));

/** Tempo relativo curto. Mantém a forma que o app já usava em pt ("há 5 min")
 *  e a equivalente em espanhol ("hace 5 min"). Acima de 7 dias vira data. */
export const timeAgoShort = (iso: string, lang: SupportedLang): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  const ha = lang === 'es' ? 'hace' : 'há';
  if (min < 1) return lang === 'es' ? 'ahora' : 'agora';
  if (min < 60) return `${ha} ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${ha} ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${ha} ${d} d`;
  return formatDateShort(iso, lang);
};
