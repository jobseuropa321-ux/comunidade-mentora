import React from 'react';
import { X, Sparkles, Lock, Check } from 'lucide-react';

interface UpgradeModalProps {
  onClose: () => void;
  featureName?: string;
}

const FEATURES = [
  'Referências e inspirações virais',
  'Calendário de alertas e conteúdos',
  'Modelos com IA (ilimitado)',
  'Dashboard de métricas',
  'Kanban de roteiros',
  'Comunidade exclusiva',
];

const UpgradeModal: React.FC<UpgradeModalProps> = ({ onClose, featureName }) => {
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[60] bg-[#1E1B11]/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed bottom-0 inset-x-0 z-[70] max-w-lg mx-auto rounded-t-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF9EE 100%)',
          border: '1px solid rgba(255,45,122,0.2)',
          borderBottom: 'none',
          boxShadow: '0 -20px 60px rgba(255,45,122,0.15)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#BE0D3E]/25" />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center bg-[#BE0D3E]/10 text-[#5B4041] hover:text-[#BE0D3E] hover:bg-[#BE0D3E]/15 transition-colors"
        >
          <X size={14} />
        </button>

        <div className="px-6 pt-3 pb-10">
          {/* Ícone */}
          <div className="flex justify-center mb-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle at 35% 35%, #E06B85, #BE0D3E 60%, #C01B5C)',
                boxShadow: '0 10px 30px rgba(255,45,122,0.4), inset 0 1px 2px rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.4)',
              }}
            >
              <Lock size={28} className="text-white" />
            </div>
          </div>

          {/* Texto */}
          <h2 className="text-[20px] font-black text-[#1E1B11] text-center leading-tight mb-2">
            Funcionalidade bloqueada
          </h2>
          {featureName && (
            <p className="text-[12px] text-[#5B4041] text-center mb-1">
              <span className="font-bold text-[#BE0D3E]">{featureName}</span>
            </p>
          )}
          <p className="text-[11px] text-[#5B4041] text-center mb-6 leading-relaxed">
            Você tem acesso apenas à área de cursos. Assine o plano completo para desbloquear tudo.
          </p>

          {/* Lista de benefícios */}
          <div className="bg-white border border-[#BE0D3E]/15 rounded-2xl p-4 mb-5 space-y-2 shadow-[0_4px_14px_rgba(255,45,122,0.08)]">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#BE0D3E] mb-3">O que você desbloqueia</p>
            {FEATURES.map(f => (
              <div key={f} className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-[#F6B43A] flex items-center justify-center shrink-0">
                  <Check size={9} strokeWidth={3} className="text-[#1E1B11]" />
                </div>
                <span className="text-[11px] text-[#1E1B11]">{f}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            className="w-full py-4 rounded-2xl text-[13px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)',
              boxShadow: '0 8px 25px rgba(255,45,122,0.45)',
            }}
          >
            <Sparkles size={15} />
            Assinar o plano completo
          </button>

          <p className="text-[9px] text-[#5B4041] text-center mt-3">
            Seu acesso ao curso continua ativo independente do plano
          </p>
        </div>
      </div>
    </>
  );
};

export default UpgradeModal;
