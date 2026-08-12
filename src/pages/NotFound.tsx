import React, { useState } from 'react';

import { Compass, Sparkles } from 'lucide-react';
import { useLocalizedNavigate } from '@/i18n/LanguageProvider';
import { useTranslation } from 'react-i18next';

const NotFound: React.FC = () => {
  const navigate = useLocalizedNavigate();
  const { t } = useTranslation();
  const [isPressed, setIsPressed] = useState(false);

  return (
    <div className="min-h-screen bg-[#FFF9EE] flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
      {/* Blobs decorativos de fundo */}
      <div
        className="absolute -top-16 -left-16 w-56 h-56 rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #BE0D3E 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-20 -right-10 w-64 h-64 rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #F6B43A 0%, transparent 70%)' }}
      />

      <div className="relative z-10 flex flex-col items-center max-w-sm w-full">
        <div className="inline-flex items-center gap-1.5 mb-6 px-3 py-1.5 rounded-full bg-white/70 border border-[#BE0D3E]/20">
          <Sparkles size={12} className="text-[#BE0D3E]" strokeWidth={2.5} />
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5B4041]/70">
            Amentora
          </span>
        </div>

        <h1
          className="font-lilita text-[110px] sm:text-[130px] leading-none font-black tracking-tighter bg-clip-text text-transparent select-none"
          style={{
            backgroundImage: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 45%, #F6B43A 100%)',
          }}
        >
          404
        </h1>

        <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-5 -mt-2 shadow-lg border border-[#BE0D3E]/10">
          <Compass size={28} className="text-[#BE0D3E]" strokeWidth={2.2} />
        </div>

        <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-[#1E1B11] mb-3">
          {t('notFound.titulo')}
        </h2>

        <p className="text-sm text-[#5B4041] leading-relaxed mb-8">
          {t('notFound.texto')}
        </p>

        <button
          onClick={() => navigate('/home')}
          onTouchStart={() => setIsPressed(true)}
          onTouchEnd={() => setIsPressed(false)}
          className="w-full rounded-2xl px-6 py-4 font-black text-white text-sm tracking-tight active:scale-[0.98] transition-transform"
          style={{
            background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)',
            boxShadow: '0 8px 25px rgba(255,45,122,0.4)',
            WebkitTapHighlightColor: 'transparent',
            transform: isPressed ? 'scale(0.98)' : undefined,
          }}
        >
          {t('notFound.voltar')}
        </button>

        <p className="text-[11px] text-[#5B4041]/60 mt-5">
          {t('notFound.rodape')}
        </p>
      </div>
    </div>
  );
};

export default NotFound;
