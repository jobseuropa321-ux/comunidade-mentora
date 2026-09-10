import React from 'react';
import { Ticket, Sparkles, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useLocalizedNavigate } from '@/i18n/LanguageProvider';
import { useMinhaMatricula } from '@/lib/matricula';

/* Botão da ficha de matrícula, na primeira aula de "Boas-vindas à comunidade".
   Campanha em português — quem renderiza já filtra o idioma. */
const MatriculaCta: React.FC = () => {
  const navigate = useLocalizedNavigate();
  const { matricula, loading } = useMinhaMatricula();
  const feita = !!matricula;

  return (
    <button
      onClick={() => navigate('/matricula')}
      disabled={loading}
      className="w-full text-left rounded-2xl overflow-hidden relative active:scale-[0.98] transition-transform"
      style={{
        background: feita
          ? 'linear-gradient(135deg, #FDBB40 0%, #F6B43A 100%)'
          : 'linear-gradient(135deg, #BE0D3E 0%, #94002D 100%)',
        boxShadow: feita ? '0 10px 26px -10px rgba(246,180,58,0.6)' : '0 10px 26px -10px rgba(190,13,62,0.6)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* brilho */}
      <div className="absolute -top-10 -right-6 w-36 h-36 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.28) 0%, transparent 65%)' }} />
      <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: feita ? '#1E1B11' : '#F6B43A' }} />

      <div className="flex items-center gap-3 pl-5 pr-4 py-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)' }}>
          {feita ? <CheckCircle2 size={20} className="text-[#1E1B11]" strokeWidth={2.5} /> : <Ticket size={20} className="text-white" strokeWidth={2.5} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[9px] font-black uppercase tracking-widest ${feita ? 'text-[#1E1B11]/70' : 'text-[#F6B43A]'}`}>
            {feita ? 'Ficha enviada' : 'Ficha de matrícula'}
          </p>
          <p className={`text-[13px] font-black leading-tight mt-0.5 ${feita ? 'text-[#1E1B11]' : 'text-white'}`}>
            {feita ? 'Seu ingresso está garantido' : 'Preencha e ganhe seu ingresso'}
          </p>
          <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${feita ? 'text-[#1E1B11]/70' : 'text-white/75'}`}>
            <Sparkles size={10} /> {feita ? 'Toque para ver o grupo do evento' : 'Evento exclusivo da comunidade'}
          </p>
        </div>
        <ChevronRight size={18} className={feita ? 'text-[#1E1B11]' : 'text-white'} strokeWidth={2.5} />
      </div>
    </button>
  );
};

export default MatriculaCta;
