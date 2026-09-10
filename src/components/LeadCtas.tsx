import React from 'react';
import { Crown, LifeBuoy, ChevronRight } from 'lucide-react';
import { useLocalizedNavigate } from '@/i18n/LanguageProvider';

/* Botões que ficam embaixo da ficha de matrícula na 1ª aula de
   "Boas-vindas à comunidade": aplicação da mentoria (preto e dourado) e suporte. */

export const MentoriaCta: React.FC = () => {
  const navigate = useLocalizedNavigate();
  return (
    <button onClick={() => navigate('/mentoria')}
      className="w-full text-left rounded-2xl overflow-hidden relative active:scale-[0.98] transition-transform"
      style={{
        background: 'linear-gradient(160deg, #1C1C1F 0%, #0B0B0C 65%, #17150C 100%)',
        border: '1px solid rgba(212,175,55,0.45)',
        boxShadow: '0 12px 28px -12px rgba(212,175,55,0.45)',
        WebkitTapHighlightColor: 'transparent',
      }}>
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #F1D27A, #D4AF37, #B8860B)' }} />
      <div className="absolute -top-10 -right-6 w-36 h-36 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.22) 0%, transparent 65%)' }} />
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.4)' }}>
          <Crown size={20} style={{ color: '#D4AF37' }} strokeWidth={2.25} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: '#D4AF37' }}>Mentoria · Acompanhamento do time</p>
          <p className="text-[13px] font-black leading-tight mt-0.5 text-white">Quer furar a fila e acelerar?</p>
          <p className="text-[10px] mt-0.5 text-white/55">Aplicação rápida e conversa direta com o time</p>
        </div>
        <ChevronRight size={18} style={{ color: '#D4AF37' }} strokeWidth={2.5} />
      </div>
    </button>
  );
};

export const SuporteCta: React.FC = () => {
  const navigate = useLocalizedNavigate();
  return (
    <button onClick={() => navigate('/suporte')}
      className="w-full text-left rounded-2xl bg-white border border-[#BE0D3E]/15 active:scale-[0.98] transition-transform"
      style={{ WebkitTapHighlightColor: 'transparent' }}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(190,13,62,0.08)' }}>
          <LifeBuoy size={18} className="text-[#BE0D3E]" strokeWidth={2.25} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-black text-[#1E1B11] leading-tight">Precisa de suporte?</p>
          <p className="text-[10px] text-[#5B4041]/65 mt-0.5">Conta o que houve e entre no grupo de atendimento</p>
        </div>
        <ChevronRight size={17} className="text-[#5B4041]/50" strokeWidth={2.5} />
      </div>
    </button>
  );
};
