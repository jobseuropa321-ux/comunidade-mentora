import { useEffect } from 'react';

/*
  No app original este hook registra tempo de uso / eventos no Supabase.
  Aqui é um no-op leve (só marca a última visita em localStorage), mantido
  para o AppLayout continuar idêntico ao blueprint.
*/
export function useAppUsageTracking() {
  useEffect(() => {
    try {
      localStorage.setItem('dam_last_seen', new Date().toISOString());
    } catch {
      /* ignore */
    }
  }, []);
}
