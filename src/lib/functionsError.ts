// supabase.functions.invoke devolve FunctionsHttpError com .context = Response
// do fetch (body NAO parseado). Ler o campo direto (error.context.error) sempre
// da undefined — parseia aqui pra checar erros estruturados (ex.: limite_atingido).
export type FnErrorBody = {
  error?: string;
  reason?: string;
  limit?: number;
  used?: number;
};

export async function readFnError(error: unknown): Promise<FnErrorBody | null> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.clone === 'function' && typeof ctx.json === 'function') {
    try {
      // clone() preserva o body pra quem for ler o Response depois
      return await ctx.clone().json();
    } catch {
      return null;
    }
  }
  return null;
}
