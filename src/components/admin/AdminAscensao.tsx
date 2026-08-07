import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Loader2, RefreshCw, MousePointerClick, PlayCircle, CreditCard, Users, TrendingUp,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   ADMIN · ASCENSÃO — o funil do Viral em 1 Minuto.

     1. Módulo  → clicou no card na Home
     2. VSL     → abriu a aula com o vídeo
     3. Botão   → clicou no "Quero meu acesso com desconto agora"

   Os cliques são gravados em `ascension_events` (src/lib/ascension.ts)
   e lidos SÓ pela RPC `ascension_stats`, que agrega no banco e exige
   papel de expert. Aqui não tem SELECT direto na tabela.

   "Pessoas" = gente diferente (distinct user_id). "Cliques" = tudo,
   incluindo quem voltou e clicou de novo. O número que interessa
   pra decidir é o de pessoas.

   ⚠️ Só conta do dia que isto foi ao ar pra frente — não existe
   histórico retroativo dos cliques anteriores.
   ══════════════════════════════════════════════════════════════ */

interface Passo { pessoas: number; cliques: number }
interface Stats {
  modulo: Passo;
  vsl: Passo;
  cta: Passo;
  periodo_dias: number | null;
  ultimos_cta: { nome: string | null; quando: string }[];
}

const PERIODOS: { id: number | null; label: string }[] = [
  { id: 1, label: 'Hoje' },
  { id: 7, label: '7 dias' },
  { id: 30, label: '30 dias' },
  { id: null, label: 'Tudo' },
];

const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);

const formatarData = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
};

/* ── Um passo do funil ── */
const PassoCard: React.FC<{
  icone: React.ElementType;
  titulo: string;
  descricao: string;
  dados: Passo;
  /** Base pra largura da barra (pessoas do 1º passo). */
  base: number;
  /** Passo anterior, pra taxa de continuidade. */
  anterior?: { titulo: string; pessoas: number };
}> = ({ icone: Icone, titulo, descricao, dados, base, anterior }) => {
  const largura = base > 0 ? Math.max(6, pct(dados.pessoas, base)) : 6;

  return (
    <div className="rounded-2xl border border-[#BE0D3E]/15 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(255,45,122,0.1)' }}>
          <Icone size={16} className="text-[#BE0D3E]" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-black text-[#1E1B11] leading-none">{titulo}</p>
          <p className="text-[10px] text-[#5B4041]/60 mt-1 leading-snug">{descricao}</p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-[26px] font-black text-[#BE0D3E] leading-none tabular-nums">{dados.pessoas}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-[#5B4041]/50 mt-1">
            pessoas
          </p>
        </div>
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-[#F6D6DC]/60 overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${largura}%`, background: 'linear-gradient(90deg, #E63462, #CB1B49)' }} />
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-[#5B4041]/50 tabular-nums">
          {dados.cliques} clique{dados.cliques === 1 ? '' : 's'} no total
        </span>
        {anterior && (
          <span className="text-[10px] font-bold text-[#5B4041]/70 tabular-nums">
            {pct(dados.pessoas, anterior.pessoas)}% de quem {anterior.titulo}
          </span>
        )}
      </div>
    </div>
  );
};

const AdminAscensao: React.FC = () => {
  const [periodo, setPeriodo] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async (dias: number | null, silencioso = false) => {
    if (!silencioso) setLoading(true);
    const { data, error } = await supabase.rpc('ascension_stats', { _days: dias });
    setLoading(false);
    if (error) {
      toast.error('Erro ao carregar os números', { description: error.message });
      return;
    }
    setStats(data as unknown as Stats);
  }, []);

  useEffect(() => { carregar(periodo); }, [periodo, carregar]);

  const vazio = stats && stats.modulo.cliques === 0 && stats.vsl.cliques === 0 && stats.cta.cliques === 0;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <h2 className="text-[13px] font-black text-[#1E1B11] leading-none">Viral em 1 Minuto</h2>
          <p className="text-[10px] text-[#5B4041]/60 mt-1 leading-snug">
            O caminho da aluna até o checkout — do card na Home ao botão embaixo da VSL.
          </p>
        </div>
        <button
          onClick={() => carregar(periodo, true)}
          className="shrink-0 w-9 h-9 rounded-xl border border-[#BE0D3E]/20 flex items-center justify-center text-[#BE0D3E] active:scale-95 transition-transform"
          aria-label="Atualizar"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <RefreshCw size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* Período */}
      <div className="grid grid-cols-4 gap-1 bg-[#F6D6DC]/50 p-1 rounded-xl">
        {PERIODOS.map(p => {
          const ativo = periodo === p.id;
          return (
            <button
              key={p.label}
              onClick={() => setPeriodo(p.id)}
              className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                ativo ? 'bg-white text-[#BE0D3E] shadow-sm' : 'text-[#5B4041]/70'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {loading || !stats ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 text-[#BE0D3E] animate-spin" />
        </div>
      ) : (
        <>
          {/* Funil */}
          <div className="space-y-2.5">
            <PassoCard
              icone={MousePointerClick}
              titulo="Clicaram no módulo"
              descricao="Abriram o card do Viral 1 Min na Home"
              dados={stats.modulo}
              base={stats.modulo.pessoas}
            />
            <PassoCard
              icone={PlayCircle}
              titulo="Abriram a aula com a VSL"
              descricao="Chegaram na página do vídeo da oferta"
              dados={stats.vsl}
              base={stats.modulo.pessoas}
              anterior={{ titulo: 'clicou no módulo', pessoas: stats.modulo.pessoas }}
            />
            <PassoCard
              icone={CreditCard}
              titulo="Clicaram no botão"
              descricao='"Quero meu acesso com desconto agora" → checkout'
              dados={stats.cta}
              base={stats.modulo.pessoas}
              anterior={{ titulo: 'abriu a VSL', pessoas: stats.vsl.pessoas }}
            />
          </div>

          {/* Conversão da ponta a ponta */}
          <div className="rounded-2xl border border-[#BE0D3E]/15 bg-[#FFF7E6] p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
              <TrendingUp size={16} className="text-[#BE0D3E]" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-black text-[#1E1B11] leading-none">Do módulo ao checkout</p>
              <p className="text-[10px] text-[#5B4041]/60 mt-1 leading-snug">
                De cada 100 que abrem o módulo, quantas clicam no botão
              </p>
            </div>
            <p className="text-[22px] font-black text-[#BE0D3E] leading-none tabular-nums shrink-0">
              {pct(stats.cta.pessoas, stats.modulo.pessoas)}%
            </p>
          </div>

          {vazio && (
            <p className="text-[10px] text-[#5B4041]/60 leading-relaxed px-1">
              Nenhum clique registrado neste período. A contagem começa a partir de agora —
              cliques anteriores à criação desta aba não entram.
            </p>
          )}

          {/* Quem clicou no botão */}
          {stats.ultimos_cta.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <Users size={12} className="text-[#5B4041]/50" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#5B4041]">
                  Quem clicou no botão
                </h3>
              </div>
              <div className="rounded-2xl border border-[#BE0D3E]/15 bg-white divide-y divide-[#BE0D3E]/10 overflow-hidden">
                {stats.ultimos_cta.map((c, i) => (
                  <div key={`${c.quando}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-[11px] font-bold text-[#1E1B11] truncate flex-1">
                      {c.nome?.trim() || 'Sem nome no perfil'}
                    </span>
                    <span className="text-[10px] text-[#5B4041]/50 shrink-0 tabular-nums">
                      {formatarData(c.quando)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-[#5B4041]/50 mt-1.5 px-1">
                Últimos 30 cliques do período. Clicar no botão não quer dizer que comprou —
                a venda em si você confere na Hubla.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminAscensao;
