import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LiveStatus {
  is_active: boolean;
  stream_url: string | null;
  title: string | null;
  description: string | null;
  presenter: string | null;
  updated_at: string;
}

const DEFAULT: LiveStatus = {
  is_active: false,
  stream_url: null,
  title: null,
  description: null,
  presenter: null,
  updated_at: new Date(0).toISOString(),
};

/**
 * Lê e mantém em sync o singleton `live_settings` (id=1).
 * Usa Postgres realtime — qualquer UPDATE feito no admin reflete em todos os clientes.
 */
export function useLiveStatus() {
  const [status, setStatus] = useState<LiveStatus>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabase
          .from('live_settings')
          .select('is_active, stream_url, title, description, presenter, updated_at')
          .eq('id', 1)
          .maybeSingle();
        if (!cancelled && data) setStatus(data);
      } catch (err) {
        // Silencioso — mantém DEFAULT (live inativa) se houver erro de rede/RLS
        console.warn('useLiveStatus: select falhou, mantendo default', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Nome único por instância pra evitar conflito quando o hook é montado em
    // 2 lugares simultaneamente (ex: BottomNav + AoVivo)
    const channelName = `live_settings_${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_settings', filter: 'id=eq.1' },
        (payload) => {
          const next = payload.new as Partial<LiveStatus>;
          if (next) {
            setStatus(prev => ({ ...prev, ...next }));
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { status, loading };
}
