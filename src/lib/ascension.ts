import { supabase, SUPABASE_READY } from '@/integrations/supabase/client';

/* ══════════════════════════════════════════════════════════════
   ASCENSÃO — os 3 cliques do funil do Viral em 1 Minuto.
   Vira linha em `ascension_events` e aparece na aba Ascensão do
   admin (RPC ascension_stats).

     'modulo' → card do Viral 1 Min na Home
     'vsl'    → abriu a página da oferta (a aula com o vídeo)
     'cta'    → botão "Quero meu acesso com desconto agora"

   Registrar NUNCA pode atrapalhar a navegação: é disparado sem
   await e o erro só vai pro console. Se o insert falhar, a aluna
   segue o caminho normal — a gente só perde o número.
   ══════════════════════════════════════════════════════════════ */

export type AscensionStep = 'modulo' | 'vsl' | 'cta';

/** Registra um passo do funil (fire-and-forget). */
export function trackAscension(step: AscensionStep): void {
  if (!SUPABASE_READY) return;
  // user_id vem do DEFAULT auth.uid() da tabela — não precisa mandar.
  void supabase
    .from('ascension_events')
    .insert({ event: step })
    .then(({ error }) => {
      if (error) console.warn(`[ascensao] não registrou "${step}":`, error.message);
    });
}
