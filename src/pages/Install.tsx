import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Share,
  PlusSquare,
  MoreVertical,
  Download,
  Smartphone,
  Home as HomeIcon,
  CheckCircle2,
  Zap,
  BellRing,
  WifiOff,
  ChevronRight,
} from 'lucide-react';

type Plataforma = 'iphone' | 'android';

/* Os passos ficam NEUTROS: só o ícone e o slug. Título e descrição são
   resolvidos no render pelo dicionário. Duplicar o array por idioma é a
   armadilha nº 1 do kit — o array cresce, alguém edita um lado só, e o
   espanhol renderiza undefined sem nenhum aviso. */
interface Passo {
  icon: React.ElementType;
  slug: string;
}

const PASSOS_IPHONE: Passo[] = [
  { icon: Share,         slug: 'compartilhar' },
  { icon: PlusSquare,    slug: 'adicionar' },
  { icon: CheckCircle2,  slug: 'confirmar' },
  { icon: HomeIcon,      slug: 'pronto' },
];

const PASSOS_ANDROID: Passo[] = [
  { icon: MoreVertical,  slug: 'menu' },
  { icon: Download,      slug: 'instalar' },
  { icon: CheckCircle2,  slug: 'confirmar' },
  { icon: HomeIcon,      slug: 'pronto' },
];

const Install: React.FC = () => {
  const { t } = useTranslation();
  const [aba, setAba] = useState<Plataforma>('iphone');
  const passos = aba === 'iphone' ? PASSOS_IPHONE : PASSOS_ANDROID;

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-28">
      {/* Header da tela */}
      <div className="mb-6">
        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50">
          {t('install.leva30s')}
        </span>
        <h1 className="page-title mt-1">{t('install.titulo')}</h1>
        <p className="text-[13px] text-[#5B4041] font-medium mt-2 leading-relaxed">
          {t('install.subtitulo')}
        </p>
      </div>

      {/* Seletor de plataforma */}
      <div
        className="flex items-center gap-1 p-1 rounded-2xl mb-6"
        style={{ background: 'rgba(255,45,122,0.08)' }}
      >
        <button
          onClick={() => setAba('iphone')}
          style={{
            WebkitTapHighlightColor: 'transparent',
            ...(aba === 'iphone'
              ? { background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)', boxShadow: '0 6px 16px rgba(255,45,122,0.35)' }
              : {}),
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-black transition-all active:scale-[0.98] ${
            aba === 'iphone' ? 'text-white' : 'text-[#5B4041]'
          }`}
        >
          <Smartphone size={16} />
          iPhone
        </button>
        <button
          onClick={() => setAba('android')}
          style={{
            WebkitTapHighlightColor: 'transparent',
            ...(aba === 'android'
              ? { background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)', boxShadow: '0 6px 16px rgba(255,45,122,0.35)' }
              : {}),
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-black transition-all active:scale-[0.98] ${
            aba === 'android' ? 'text-white' : 'text-[#5B4041]'
          }`}
        >
          <Smartphone size={16} />
          Android
        </button>
      </div>

      {/* Passo a passo */}
      <div className="space-y-4 mb-6">
        {passos.map((passo, index) => {
          const Icon = passo.icon;
          return (
            <div key={`${aba}-${index}`} className="viral-card rounded-2xl p-4 flex gap-4 items-start">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-black shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)',
                  boxShadow: '0 4px 12px rgba(255,45,122,0.35)',
                }}
              >
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={16} className="text-[#BE0D3E] shrink-0" />
                  <h3 className="text-[14px] font-black text-[#1E1B11] leading-tight">{t(`install.${aba}.${passo.slug}.titulo`)}</h3>
                </div>
                <p className="text-[12.5px] text-[#5B4041] font-medium leading-relaxed">{t(`install.${aba}.${passo.slug}.descricao`)}</p>
              </div>
              {index < passos.length - 1 && (
                <ChevronRight size={16} className="text-[#1E1B11]/10 shrink-0 mt-2" />
              )}
            </div>
          );
        })}
      </div>

      {/* Card de benefícios */}
      <div className="card-glass-liquid-lime rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(26,26,26,0.08)' }}
          >
            <Zap size={18} className="text-[#1E1B11]" fill="#1E1B11" />
          </div>
          <h2 className="text-[16px] font-black text-[#1E1B11] tracking-tight">
            {t('install.porQueVale')}
          </h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#1E1B11]/8 flex items-center justify-center shrink-0 mt-0.5">
              <Zap size={14} className="text-[#1E1B11]" />
            </div>
            <p className="text-[13px] text-[#1E1B11] font-bold leading-snug">
              {t('install.beneficio1')}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#1E1B11]/8 flex items-center justify-center shrink-0 mt-0.5">
              <BellRing size={14} className="text-[#1E1B11]" />
            </div>
            <p className="text-[13px] text-[#1E1B11] font-bold leading-snug">
              {t('install.beneficio2')}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#1E1B11]/8 flex items-center justify-center shrink-0 mt-0.5">
              <WifiOff size={14} className="text-[#1E1B11]" />
            </div>
            <p className="text-[13px] text-[#1E1B11] font-bold leading-snug">
              {t('install.beneficio3')}
            </p>
          </div>
        </div>
      </div>

      {/* Rodapé motivacional */}
      <p className="text-center text-[11px] text-[#5B4041] font-semibold mt-6 px-4 leading-relaxed">
        {t('install.rodape')}
      </p>
    </div>
  );
};

export default Install;
