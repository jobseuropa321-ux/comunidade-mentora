import React, { useMemo, useState } from 'react';
import { CalendarClock, Bell, TrendingUp, Zap, ChevronLeft, ChevronRight, Flame } from 'lucide-react';

/* ── HELPERS ── */
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

interface AlertaItem {
  dia: number;
  titulo: string;
  descricao: string;
  icon: React.ElementType;
  tag: string;
  cardClass: string;
}

/* ── TELA ── */
const Alerta: React.FC = () => {
  const hoje = useMemo(() => new Date(), []);
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();
  const diaHoje = hoje.getDate();

  // dias marcados com alerta neste mês (mock realista, ancorado no dia de hoje)
  const diasComAlerta = useMemo(() => {
    const base = new Set<number>();
    [3, 7, 11, 15, 19, 23, 27].forEach((offset) => {
      const d = ((diaHoje + offset - 1) % 28) + 1;
      base.add(d);
    });
    base.add(diaHoje + 2 > 28 ? diaHoje - 2 : diaHoje + 2);
    return base;
  }, [diaHoje]);

  const primeiroDiaSemana = useMemo(
    () => new Date(anoAtual, mesAtual, 1).getDay(),
    [anoAtual, mesAtual]
  );
  const totalDias = useMemo(
    () => new Date(anoAtual, mesAtual + 1, 0).getDate(),
    [anoAtual, mesAtual]
  );

  const celulas = useMemo(() => {
    const arr: (number | null)[] = [];
    for (let i = 0; i < primeiroDiaSemana; i++) arr.push(null);
    for (let d = 1; d <= totalDias; d++) arr.push(d);
    return arr;
  }, [primeiroDiaSemana, totalDias]);

  const [diaSelecionado, setDiaSelecionado] = useState<number>(diaHoje);

  const proximosAlertas: AlertaItem[] = [
    {
      dia: diaHoje + 1 > totalDias ? 1 : diaHoje + 1,
      titulo: 'Trend do áudio "Efeito Espelho" em alta',
      descricao: 'Uso subindo 340% nas últimas 48h. Corre pra entrar antes de saturar.',
      icon: TrendingUp,
      tag: 'Trend quente',
      cardClass: 'card-glass-liquid-pink',
    },
    {
      dia: diaHoje + 3 > totalDias ? 2 : diaHoje + 3,
      titulo: 'Dia de Reels de bastidor',
      descricao: 'Seu público engaja 2x mais com conteúdo de rotina às quartas.',
      icon: CalendarClock,
      tag: 'Rotina',
      cardClass: 'card-glass-liquid',
    },
    {
      dia: diaHoje + 5 > totalDias ? 4 : diaHoje + 5,
      titulo: 'Horário nobre: 19h–21h',
      descricao: 'Pico de audiência prevista pro seu nicho nesta janela.',
      icon: Zap,
      tag: 'Horário nobre',
      cardClass: 'card-glass-liquid-lime',
    },
    {
      dia: diaHoje + 8 > totalDias ? 7 : diaHoje + 8,
      titulo: 'Reset de hashtags da semana',
      descricao: 'Renove seu banco de hashtags antes que percam alcance.',
      icon: Bell,
      tag: 'Manutenção',
      cardClass: 'card-glass-liquid',
    },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-28">
      {/* Cabeçalho da tela */}
      <div className="mb-5">
        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50">
          Fique de olho
        </span>
        <h1 className="page-title mt-1">Calendário de alerta</h1>
        <p className="text-[13px] text-[#5B4041] mt-1.5 leading-relaxed">
          As datas certas pra postar, com base no que tá bombando agora.
        </p>
      </div>

      {/* Card do calendário */}
      <div className="viral-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            disabled
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#5B4041]/30 cursor-not-allowed"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            aria-label="Mês anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-black text-[15px] text-[#1E1B11] tracking-tight capitalize">
            {MESES[mesAtual]} de {anoAtual}
          </span>
          <button
            type="button"
            disabled
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#5B4041]/30 cursor-not-allowed"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            aria-label="Próximo mês"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 gap-1 mb-1.5">
          {DIAS_SEMANA.map((d, i) => (
            <div
              key={`${d}-${i}`}
              className="flex items-center justify-center text-[10px] font-black uppercase text-[#5B4041]/50"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grid de dias */}
        <div className="grid grid-cols-7 gap-1">
          {celulas.map((dia, idx) => {
            if (dia === null) return <div key={`vazio-${idx}`} />;
            const isHoje = dia === diaHoje;
            const temAlerta = diasComAlerta.has(dia);
            const isSelecionado = dia === diaSelecionado && !isHoje;
            return (
              <button
                key={dia}
                type="button"
                onClick={() => setDiaSelecionado(dia)}
                className={`calendar-day ${isHoje ? 'today' : ''} ${isSelecionado ? 'picked' : ''}`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <span
                  className={`text-[13px] ${isHoje ? 'font-black text-[#BE0D3E]' : 'font-bold text-[#1E1B11]'}`}
                >
                  {dia}
                </span>
                {temAlerta && (
                  <span
                    className="absolute bottom-1 w-1.5 h-1.5 rounded-full"
                    style={{ background: isHoje ? '#BE0D3E' : '#BE0D3E' }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Legenda */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[#BE0D3E]/10">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md" style={{ background: '#BE0D3E' }} />
            <span className="text-[10px] font-bold text-[#5B4041]">Hoje</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#BE0D3E' }} />
            <span className="text-[10px] font-bold text-[#5B4041]">Alerta de trend</span>
          </div>
        </div>
      </div>

      {/* Próximos alertas */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50">
            Próximos alertas
          </span>
          <span className="flex items-center gap-1 text-[10px] font-black text-[#BE0D3E]">
            <Flame size={12} strokeWidth={2.5} />
            {proximosAlertas.length} ativos
          </span>
        </div>

        <div className="space-y-3">
          {proximosAlertas
            .slice()
            .sort((a, b) => a.dia - b.dia)
            .map((alerta, i) => {
              const Icon = alerta.icon;
              return (
                <div
                  key={i}
                  className={`${alerta.cardClass} p-4 flex items-start gap-3 cursor-pointer active:scale-[0.98] transition-transform`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)',
                      boxShadow: '0 6px 16px rgba(255,45,122,0.35)',
                    }}
                  >
                    <Icon size={19} color="#FFFFFF" strokeWidth={2.4} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-black uppercase tracking-wide text-[#BE0D3E]">
                        Dia {alerta.dia} · {alerta.tag}
                      </span>
                    </div>
                    <p className="text-[14px] font-black text-[#1E1B11] tracking-tight leading-snug">
                      {alerta.titulo}
                    </p>
                    <p className="text-[12px] text-[#5B4041] mt-0.5 leading-relaxed">
                      {alerta.descricao}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* CTA final */}
      <button
        type="button"
        className="w-full mt-6 py-3.5 rounded-2xl text-white font-black text-[13px] uppercase tracking-wide active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        style={{
          background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)',
          boxShadow: '0 8px 25px rgba(255,45,122,0.4)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <Bell size={16} strokeWidth={2.5} />
        Ativar notificações de trend
      </button>
    </div>
  );
};

export default Alerta;
