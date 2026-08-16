/* Para onde a conversa rola depois de mudar a lista de mensagens.
 *
 * O padrão antigo era sempre `scrollIntoView` no fim da lista. Com uma
 * resposta longa da IA isso deixava a aluna olhando o RODAPÉ do texto, e ela
 * tinha que rolar pra cima pra achar as perguntas que precisava responder —
 * a queixa da equipe da Espanha em 2026-08-15: "el texto siempre se va al
 * final [...] mejor que se quede arriba".
 */

export type DestinoRolagem = 'fim' | 'topo-da-resposta';

interface Opcoes {
  /** Área rolável das mensagens. */
  box: HTMLElement | null;
  /** Âncora invisível no fim da lista. */
  fim: HTMLElement | null;
  /** Índice da última mensagem (= posição dela entre os filhos do box). */
  indiceUltima: number;
  /** A última mensagem é da IA? */
  ultimaEhDaIA: boolean;
  /** A IA ainda está digitando? */
  carregando: boolean;
  behavior?: ScrollBehavior;
}

export function rolarConversa({
  box, fim, indiceUltima, ultimaEhDaIA, carregando, behavior = 'smooth',
}: Opcoes): DestinoRolagem {
  const paraOFim = (): DestinoRolagem => {
    fim?.scrollIntoView({ behavior, block: 'end' });
    return 'fim';
  };

  // Enquanto a IA digita, e quando a última mensagem é da própria aluna, o
  // certo é mesmo acompanhar o fim da conversa.
  if (!box || carregando || !ultimaEhDaIA) return paraOFim();

  const el = box.children[indiceUltima] as HTMLElement | undefined;
  if (!el) return paraOFim();

  // Alinha o COMEÇO da resposta com o topo da área de leitura. Resposta curta
  // não muda nada na prática: o scrollTo satura no fim da lista.
  const topo = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
  box.scrollTo({ top: Math.max(0, topo - 8), behavior });
  return 'topo-da-resposta';
}
