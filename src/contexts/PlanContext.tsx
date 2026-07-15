import React, { createContext, useContext, useState } from 'react';

/*
  PLANOS:
  'curso' → acesso apenas à área de membros (Home/módulos)
             + 1 teste gratuito no Chat IA
  'app'   → acesso completo a tudo
  'expert'→ acesso completo + admin

  Para mudar o plano do usuário, altere USER_PLAN abaixo.
  Quando a integração real de pagamento for feita, buscar do banco.
*/

export type PlanType = 'curso' | 'app' | 'expert';

// ── ALTERE AQUI PARA TESTAR ──────────────────────────────
const USER_PLAN: PlanType = 'app';
// ─────────────────────────────────────────────────────────

const CHAT_TRIAL_KEY = 'dam_chat_trial_used';

interface PlanContextType {
  plan: PlanType;
  hasFullAccess: boolean;
  canUseChatTrial: boolean;
  consumeChatTrial: () => void;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const plan = USER_PLAN;
  const hasFullAccess = plan === 'app' || plan === 'expert';

  const [chatTrialUsed, setChatTrialUsed] = useState(
    () => localStorage.getItem(CHAT_TRIAL_KEY) === 'true'
  );

  const canUseChatTrial = !hasFullAccess && !chatTrialUsed;

  const consumeChatTrial = () => {
    localStorage.setItem(CHAT_TRIAL_KEY, 'true');
    setChatTrialUsed(true);
  };

  return (
    <PlanContext.Provider value={{ plan, hasFullAccess, canUseChatTrial, consumeChatTrial }}>
      {children}
    </PlanContext.Provider>
  );
};

export const usePlan = () => {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
};
