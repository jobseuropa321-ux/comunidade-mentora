import React, { useState } from 'react';
import { usePlan } from '@/contexts/PlanContext';
import UpgradeModal from '@/components/UpgradeModal';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PlanGateProps {
  children: React.ReactNode;
  featureName?: string;
  /** Se true, apenas plano completo passa */
  requiresFull?: boolean;
  /** Se true, permite 1 trial gratuito (chat) */
  allowTrial?: boolean;
}

const PlanGate: React.FC<PlanGateProps> = ({
  children,
  featureName,
  requiresFull = true,
  allowTrial = false,
}) => {
  const { t } = useTranslation();
  const { hasFullAccess, canUseChatTrial } = usePlan();
  const [showModal, setShowModal] = useState(false);

  // featureName chega como CHAVE de tradução vinda das rotas (que são JSX de
  // módulo e não podem chamar hook), ou já resolvida vinda do Header/BottomNav.
  // t() devolve a própria string quando não é chave, então os dois casos passam.
  const featureLabel = featureName ? t(featureName, { defaultValue: featureName }) : undefined;

  // Determina se tem acesso
  const hasAccess = hasFullAccess || (allowTrial && canUseChatTrial);

  if (hasAccess) return <>{children}</>;

  return (
    <div className="relative min-h-[60vh]">
      {/* Conteúdo embaçado por baixo */}
      <div className="pointer-events-none select-none" style={{ filter: 'blur(6px)', opacity: 0.25 }}>
        {children}
      </div>

      {/* Overlay de bloqueio */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center z-10 px-6"
        onClick={() => setShowModal(true)}
      >
        <div
          className="flex flex-col items-center text-center p-8 rounded-3xl"
          style={{
            background: 'rgba(255,244,230,0.85)',
            border: '1px solid rgba(255,45,122,0.2)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: 'radial-gradient(circle at 35% 35%, #E06B85, #BE0D3E 60%, #C01B5C)',
              border: '1px solid rgba(255,255,255,0.5)',
              boxShadow: '0 8px 20px rgba(255,45,122,0.4), inset 0 1px 2px rgba(255,255,255,0.5)',
            }}
          >
            <Lock size={22} className="text-white" />
          </div>
          <p className="text-[14px] font-black text-[#1E1B11] mb-1">
            {featureLabel ?? t('planGate.bloqueada')}
          </p>
          <p className="text-[11px] text-[#5B4041] mb-5 leading-relaxed max-w-[220px]">
            {t('planGate.apenasPlanoCompleto')}
          </p>
          <button
            className="px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white"
            style={{
              background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)',
              boxShadow: '0 6px 20px rgba(255,45,122,0.45)',
            }}
          >
            {t('planGate.assinarAgora')}
          </button>
        </div>
      </div>

      {showModal && (
        <UpgradeModal featureName={featureLabel} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
};

export default PlanGate;
