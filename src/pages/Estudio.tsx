import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Circle, RotateCcw, Square } from 'lucide-react';
import { useLocalizedNavigate } from '@/i18n/LanguageProvider';
import { useTranslation } from 'react-i18next';

interface Roteiro {
  titulo: string;
  categoria: string;
  texto: string;
}

/* Só as chaves — título, categoria e texto do teleprompter vêm de
   estudio.roteiros.<id> no render. */
const ROTEIRO_IDS = ['gancho-3s', 'storytime-virou-caso', 'lista-erros'] as const;
const roteiroId = (cardId: string | undefined) =>
  cardId && (ROTEIRO_IDS as readonly string[]).includes(cardId) ? cardId : 'default';

const formatTempo = (segundos: number): string => {
  const m = Math.floor(segundos / 60)
    .toString()
    .padStart(2, '0');
  const s = (segundos % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

type EstadoGravacao = 'idle' | 'contagem' | 'gravando';

const Estudio: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useLocalizedNavigate();
  const { cardId } = useParams<{ cardId?: string }>();

  // O roteiro é montado do dicionário: cardId desconhecido cai no 'default'.
  const rid = roteiroId(cardId);
  const roteiro = {
    titulo: t(`estudio.roteiros.${rid}.titulo`),
    categoria: t(`estudio.roteiros.${rid}.categoria`),
    texto: t(`estudio.roteiros.${rid}.texto`),
  };

  const [estado, setEstado] = useState<EstadoGravacao>('idle');
  const [contagem, setContagem] = useState(3);
  const [segundos, setSegundos] = useState(0);
  const [espelhado, setEspelhado] = useState(false);

  const contagemTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gravacaoInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (contagemTimeout.current) clearTimeout(contagemTimeout.current);
      if (gravacaoInterval.current) clearInterval(gravacaoInterval.current);
    };
  }, []);

  const iniciarContagem = () => {
    setEstado('contagem');
    setContagem(3);

    const passo = (valor: number) => {
      contagemTimeout.current = setTimeout(() => {
        if (valor > 1) {
          setContagem(valor - 1);
          passo(valor - 1);
        } else {
          setSegundos(0);
          setEstado('gravando');
          gravacaoInterval.current = setInterval(() => {
            setSegundos((prev) => prev + 1);
          }, 1000);
        }
      }, 900);
    };

    passo(3);
  };

  const pararGravacao = () => {
    if (gravacaoInterval.current) clearInterval(gravacaoInterval.current);
    if (contagemTimeout.current) clearTimeout(contagemTimeout.current);
    gravacaoInterval.current = null;
    contagemTimeout.current = null;
    setEstado('idle');
    setSegundos(0);
    setContagem(3);
  };

  const handleRecPress = () => {
    if (estado === 'idle') {
      iniciarContagem();
    } else {
      pararGravacao();
    }
  };

  return (
    <div className="min-h-screen bg-[#1E1B11] text-white flex flex-col">
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 shrink-0">
        <button
          onClick={() => navigate('/home')}
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center active:scale-90 transition-transform"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          aria-label={t('common.voltar')}
        >
          <ArrowLeft className="w-5 h-5 text-white" strokeWidth={2.5} />
        </button>

        <div className="flex flex-col items-center">
          <span className="font-lilita text-lg tracking-tight leading-none">{t('estudio.titulo')}</span>
          <span className="text-[9px] font-black uppercase tracking-widest text-white/40 mt-0.5">
            {roteiro.categoria}
          </span>
        </div>

        <button
          onClick={() => setEspelhado((v) => !v)}
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center active:scale-90 transition-transform"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          aria-label={t('a11y.virarCamera')}
        >
          <RotateCcw className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
        </button>
      </div>

      {/* Área central: preview de câmera + teleprompter */}
      <div className="flex-1 px-4 pb-4 flex flex-col min-h-0">
        <div
          className="relative flex-1 rounded-3xl overflow-hidden border border-white/10"
          style={{
            background:
              'radial-gradient(circle at 50% 20%, #2A2A2A 0%, #141414 65%, #0A0A0A 100%)',
            transform: espelhado ? 'scaleX(-1)' : 'none',
          }}
        >
          {/* watermark de "câmera" fake */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-30">
            <Camera className="w-16 h-16 text-white" strokeWidth={1.5} />
            <span
              className="text-xs font-bold uppercase tracking-widest text-white"
              style={{ transform: espelhado ? 'scaleX(-1)' : 'none' }}
            >
              {t('estudio.previaCamera')}
            </span>
          </div>

          {/* Badge REC no canto */}
          {estado === 'gravando' && (
            <div
              className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-full px-3 py-1.5"
              style={{ transform: espelhado ? 'scaleX(-1)' : 'none' }}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#BE0D3E] animate-pulse" />
              <span className="text-xs font-black tabular-nums">{formatTempo(segundos)}</span>
            </div>
          )}

          {/* Contagem regressiva */}
          {estado === 'contagem' && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: espelhado ? 'scaleX(-1)' : 'none' }}
            >
              <span
                key={contagem}
                className="countdown-pop font-lilita text-white leading-none"
                style={{ fontSize: '7rem', textShadow: '0 0 40px rgba(255,45,122,0.6)' }}
              >
                {contagem}
              </span>
            </div>
          )}

          {/* Teleprompter */}
          <div
            className="absolute inset-x-0 bottom-0 px-5 pt-10 pb-5"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 20%, transparent 100%)',
              transform: espelhado ? 'scaleX(-1)' : 'none',
            }}
          >
            <p className="text-[9px] font-black uppercase tracking-widest text-[#E06B85] mb-2">
              {roteiro.titulo}
            </p>
            <p className="text-lg sm:text-xl font-bold leading-snug text-white/95">
              {roteiro.texto}
            </p>
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="px-4 pb-8 pt-2 flex flex-col items-center gap-3 shrink-0">
        <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
          {estado === 'idle' && t('estudio.toqueParaGravar')}
          {estado === 'contagem' && t('estudio.preparando')}
          {estado === 'gravando' && t('estudio.gravandoToque')}
        </span>

        <button
          onClick={handleRecPress}
          disabled={estado === 'contagem'}
          className="relative w-20 h-20 rounded-full flex items-center justify-center active:scale-[0.92] transition-transform disabled:active:scale-100"
          style={{
            WebkitTapHighlightColor: 'transparent',
            background:
              estado === 'gravando'
                ? 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)'
                : 'rgba(255,255,255,0.08)',
            border: `4px solid ${estado === 'gravando' ? '#BE0D3E' : '#FFFFFF'}`,
            boxShadow:
              estado === 'gravando'
                ? '0 0 0 6px rgba(255,45,122,0.25), 0 8px 25px rgba(255,45,122,0.4)'
                : 'none',
          }}
          aria-label={estado === 'gravando' ? t('estudio.pararGravacao') : t('estudio.iniciarGravacao')}
        >
          {estado === 'gravando' ? (
            <Square className="w-7 h-7 text-white" fill="white" strokeWidth={0} />
          ) : (
            <Circle className="w-12 h-12 text-[#BE0D3E]" fill="#BE0D3E" strokeWidth={0} />
          )}
        </button>
      </div>
    </div>
  );
};

export default Estudio;
