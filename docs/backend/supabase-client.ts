import { createClient } from '@supabase/supabase-js';

// Lê as credenciais do .env (Vite). Enquanto você não integrar o Supabase,
// a tela de Perfil ainda renderiza normalmente com o AuthContext MOCK —
// só o upload de avatar (que usa storage) precisa dessas variáveis setadas.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'placeholder-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
