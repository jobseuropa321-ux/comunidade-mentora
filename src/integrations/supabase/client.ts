import { createClient } from '@supabase/supabase-js';

// Lê as credenciais do .env (Vite). Enquanto o Supabase do projeto não for
// criado (ver docs/backend/PLANO-IMPLEMENTACAO.md), as telas rodam em modo
// "backend em preparação": renderizam normalmente e avisam de forma amigável
// nas ações que dependem do banco/IA.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'placeholder-anon-key';

/** true quando o .env aponta pra um projeto Supabase real. */
export const SUPABASE_READY = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
