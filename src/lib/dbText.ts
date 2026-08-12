/* Tradução dos campos de LISTA FECHADA que vêm do banco.
 *
 * `nivel`, `tag`, `instructor` e `duracao` são texto livre na tabela, mas na
 * prática assumem um punhado de valores ("Iniciante", "NOVO", "Em breve"...).
 * Para esses não vale criar coluna por idioma: o dicionário resolve, e valor
 * desconhecido passa direto em vez de sumir da tela.
 *
 * O que NÃO passa por aqui é título e descrição de módulo e aula — esses são
 * texto único por registro e moram em colunas _es próprias, editáveis pelo
 * painel.
 */
type TFunc = (k: string, o?: Record<string, unknown>) => string;

const traduz = (grupo: string, valor: string | null | undefined, t: TFunc): string => {
  const v = (valor ?? '').trim();
  if (!v) return '';
  // defaultValue devolve o próprio texto quando o valor não está no dicionário:
  // duração numérica ("1h 12min") e qualquer valor novo cadastrado no painel
  // continuam aparecendo, em vez de virar a chave crua na tela.
  return t(`conteudoDb.${grupo}.${v}`, { defaultValue: v });
};

export const dbNivel = (v: string | null | undefined, t: TFunc) => traduz('nivel', v, t);
export const dbTag = (v: string | null | undefined, t: TFunc) => traduz('tag', v, t);
export const dbInstructor = (v: string | null | undefined, t: TFunc) => traduz('instructor', v, t);
export const dbDuracao = (v: string | null | undefined, t: TFunc) => traduz('duracao', v, t);

/* Escolhe o texto do idioma da tela, caindo no português quando não há versão
 * espanhola. Vale para os campos de texto ÚNICO por registro (título e
 * descrição de módulo e aula), que moram em colunas _es próprias. */
export const dbText = (
  pt: string | null | undefined,
  es: string | null | undefined,
  lang: 'pt' | 'es',
): string => (lang === 'es' && es && es.trim() ? es : (pt ?? ''));
