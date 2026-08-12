import type { SupportedLang } from "./LanguageProvider";

/**
 * Diretiva INVISÍVEL de idioma anexada ao conteúdo enviado para a IA.
 *
 * Os prompts (system) das funções continuam em PT — aqui só adicionamos, do lado
 * do usuário, uma instrução forte de IDIOMA DE SAÍDA. Em PT não enviamos nada
 * (comportamento idêntico ao de hoje); em ES anexamos a diretiva. Assim a IA
 * acompanha o idioma da aluna sem precisar reescrever/deployar os prompts.
 */
export function aiLangSuffix(lang: SupportedLang): string {
  if (lang === "es") {
    return "\n\n---\n[IMPORTANTE: Responde TODO en ESPAÑOL (español). Aunque las instrucciones del sistema o de arriba estén en portugués, TODA tu respuesta debe estar escrita en español, con naturalidad y manteniendo el formato pedido.]";
  }
  return "";
}

/**
 * Retorna uma CÓPIA do array de mensagens com a diretiva de idioma anexada ao
 * content da ÚLTIMA mensagem de role 'user'. Não muta o array original (o histórico
 * exibido na UI permanece limpo). Em PT, devolve o array inalterado.
 */
export function withAiLangMessages<T extends { role: string; content: string }>(
  messages: T[],
  lang: SupportedLang,
): T[] {
  const suffix = aiLangSuffix(lang);
  if (!suffix || messages.length === 0) return messages;
  let idx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") { idx = i; break; }
  }
  if (idx === -1) return messages;
  const copy = messages.slice();
  copy[idx] = { ...copy[idx], content: copy[idx].content + suffix };
  return copy;
}
