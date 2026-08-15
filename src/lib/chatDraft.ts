/* Rascunho da conversa com o agente — sobrevive a trocar de tela.
 *
 * POR QUE EXISTE: a conversa, o formulário de entrada e o resultado da IA
 * viviam só em useState. Bastava tocar em qualquer item do menu de baixo
 * pra desmontar a tela e perder tudo — inclusive uma resposta longa que a
 * IA já tinha terminado de escrever. Reportado por aluna em 2026-08-15:
 * "he rellenado el formulario, he cambiado de pantalla (SIN CERRAR
 * APLICACIÓN) y se ha borrado todo el test".
 *
 * localStorage e não sessionStorage: no PWA instalado o iOS descarta a aba
 * quando o app fica em segundo plano, e o sessionStorage iria junto — que é
 * exatamente o caso de "troquei de tela e voltei".
 *
 * O sessionId entra no rascunho de propósito: ele é a chave de cota da
 * function `chat-viral`. Retomar a conversa com um id novo faria o backend
 * contar como um chat novo e cobrar de novo da cota da aluna.
 */

const PREFIX = 'dam:chat-draft:v1:';
const TTL_MS = 24 * 60 * 60 * 1000;
/** localStorage costuma ter ~5MB por origem. Acima disso não vale insistir:
 *  melhor não guardar do que estourar a cota e derrubar outras chaves. */
const MAX_BYTES = 1.5 * 1024 * 1024;

export interface DraftMessage { role: 'user' | 'ia'; content: string; display?: string }
export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface ChatDraft {
  updatedAt: number;
  sessionId: string;
  stage: 'form' | 'picker' | 'chat';
  messages: DraftMessage[];
  input: string;
  courseName: string;
  skeletonId: string | null;
  lessonProgress: { current: number; total: number } | null;
  savedIdx: number[];
  saveStatuses: Record<string, DraftSaveStatus>;
  form: { step: number; answers: Record<string, string> } | null;
}

const keyFor = (userId: string, slug: string) => `${PREFIX}${userId}:${slug}`;

const store = (): Storage | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // Safari com "bloquear cookies" derruba só de acessar
  }
};

export function loadChatDraft(userId: string, slug: string): ChatDraft | null {
  const ls = store();
  if (!ls) return null;
  const k = keyFor(userId, slug);
  try {
    const raw = ls.getItem(k);
    if (!raw) return null;
    const d = JSON.parse(raw) as ChatDraft;
    if (!d || typeof d.updatedAt !== 'number' || !Array.isArray(d.messages)) throw new Error('formato');
    if (Date.now() - d.updatedAt > TTL_MS) { ls.removeItem(k); return null; }

    // 'saving' é um estado que só existe durante a requisição: depois de
    // remontar a tela não há nada salvando, e deixá-lo travaria o botão.
    const saveStatuses: Record<string, DraftSaveStatus> = {};
    for (const [idx, st] of Object.entries(d.saveStatuses ?? {})) {
      saveStatuses[idx] = st === 'saving' ? 'idle' : st;
    }
    return { ...d, saveStatuses, savedIdx: d.savedIdx ?? [] };
  } catch {
    try { ls.removeItem(k); } catch { /* nada a fazer */ }
    return null;
  }
}

export function saveChatDraft(userId: string, slug: string, draft: Omit<ChatDraft, 'updatedAt'>): void {
  const ls = store();
  if (!ls) return;
  const k = keyFor(userId, slug);
  const payload = JSON.stringify({ ...draft, updatedAt: Date.now() });

  // Conversa gigante: guardar pela metade embaralharia os índices de
  // savedIdx/saveStatuses (que apontam pra posição na lista de mensagens),
  // então é tudo ou nada.
  if (payload.length > MAX_BYTES) { try { ls.removeItem(k); } catch { /* ok */ } return; }

  try {
    prune(ls);
    ls.setItem(k, payload);
  } catch {
    // Cota estourada: limpa os rascunhos dos outros agentes e tenta de novo.
    try {
      clearAllChatDrafts();
      ls.setItem(k, payload);
    } catch { /* desiste em silêncio — rascunho é conveniência, não dado */ }
  }
}

export function clearChatDraft(userId: string, slug: string): void {
  try { store()?.removeItem(keyFor(userId, slug)); } catch { /* ok */ }
}

/** Chamado no signOut: rascunho de conversa é conteúdo da aluna, não pode
 *  sobrar no aparelho pra próxima pessoa que logar. */
export function clearAllChatDrafts(): void {
  const ls = store();
  if (!ls) return;
  try {
    for (const k of Object.keys(ls)) if (k.startsWith(PREFIX)) ls.removeItem(k);
  } catch { /* ok */ }
}

/** Descarta rascunhos vencidos de outros agentes/usuários. */
function prune(ls: Storage): void {
  const limite = Date.now() - TTL_MS;
  for (const k of Object.keys(ls)) {
    if (!k.startsWith(PREFIX)) continue;
    try {
      const d = JSON.parse(ls.getItem(k) ?? 'null') as ChatDraft | null;
      if (!d || typeof d.updatedAt !== 'number' || d.updatedAt < limite) ls.removeItem(k);
    } catch {
      ls.removeItem(k);
    }
  }
}
