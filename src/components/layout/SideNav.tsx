import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Home, Radio, Users, Sparkles, Library, User, ShieldCheck, MessageCircle, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { usePlan } from '@/contexts/PlanContext';
import { useAuth } from '@/contexts/AuthContext';
import UpgradeModal from '@/components/UpgradeModal';
import { useLiveStatus } from '@/hooks/useLiveStatus';
import { useLocalizedNavigate, useCurrentLang, useCurrentVariant, unlocalizedPath, type SupportedLang } from '@/i18n/LanguageProvider';
import { useTranslation } from 'react-i18next';

/* ══════════════════════════════════════════════════════════════
   NAVEGAÇÃO LATERAL — só no desktop (≥ 1024px, `lg`).

   No celular a navegação é a pílula do BottomNav; aqui ela vira uma
   coluna fixa à esquerda, com as mesmas rotas, mais Biblioteca, Perfil e
   (pra equipe) o painel. O AppLayout reserva o espaço com `lg:pl-64`.
   Mesma regra de bloqueio por plano do BottomNav (UpgradeModal).
   ══════════════════════════════════════════════════════════════ */

export const WHATSAPP_GROUP_URL: Record<SupportedLang, string> = {
  pt: 'https://chat.whatsapp.com/JUUOZVbvbLh1vMvDTC4D7P?mode=gi_t',
  es: 'https://chat.whatsapp.com/BlR0LA49cxVE4uPlY9XUPm?mode=gi_t',
};

const SideNav: React.FC<{ recolhida: boolean; onToggle: () => void }> = ({ recolhida, onToggle }) => {
  const location = useLocation();
  const navigate = useLocalizedNavigate();
  const { t } = useTranslation();
  const { hasFullAccess, canUseChatTrial } = usePlan();
  const { isExpert } = useAuth();
  const lang = useCurrentLang();
  const variant = useCurrentVariant();
  const pathname = unlocalizedPath(location.pathname, variant);
  const [upgradeModal, setUpgradeModal] = useState<string | null>(null);
  const { status: liveStatus } = useLiveStatus();
  const isLiveActive = liveStatus.is_active && !!liveStatus.stream_url;

  const chatLocked = !hasFullAccess && !canUseChatTrial;

  const items = [
    { path: '/home',       Icon: Home,     label: t('nav.titles.cursos'),     locked: false,          match: (p: string) => p === '/home' || p.startsWith('/modulo') },
    { path: '/ao-vivo',    Icon: Radio,    label: t('nav.titles.aoVivo'),     locked: false,          match: (p: string) => p === '/ao-vivo' },
    { path: '/community',  Icon: Users,    label: t('nav.titles.comunidade'), locked: !hasFullAccess, match: (p: string) => p.startsWith('/community') },
    { path: '/chat',       Icon: Sparkles, label: t('nav.titles.agentes'),    locked: chatLocked,     match: (p: string) => p.startsWith('/chat') },
    { path: '/biblioteca', Icon: Library,  label: t('header.biblioteca'),     locked: chatLocked,     match: (p: string) => p.startsWith('/biblioteca') },
  ];

  const go = (path: string, label: string, locked: boolean) => {
    if (locked) { setUpgradeModal(label); return; }
    navigate(path);
  };

  const itemCls = (active: boolean) =>
    `w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] font-bold transition-colors ${
      active
        ? 'bg-[#FFF7E6] border border-[#F6D6DC] text-[#BE0D3E]'
        : 'border border-transparent text-[#5B4041] hover:bg-[#FFF7E6]/70 hover:text-[#BE0D3E]'
    }`;

  /* Recolhida: a coluna some e sobra só o botão fixo no canto inferior
     esquerdo pra trazer de volta (lá não briga com os botões de voltar das
     telas, que ficam no topo). */
  if (recolhida) {
    return (
      <button
        onClick={onToggle}
        className="hidden lg:flex fixed bottom-6 left-6 z-40 h-11 w-11 items-center justify-center rounded-full bg-white border border-[#F6D6DC] text-[#BE0D3E] shadow-[0_10px_24px_-10px_rgba(190,13,62,0.45)] hover:bg-[#FFF7E6] transition-colors"
        title={t('nav.expandir')}
        aria-label={t('nav.expandir')}
      >
        <PanelLeftOpen size={19} strokeWidth={1.9} />
      </button>
    );
  }

  return (
    <>
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bg-white border-r border-[#F6D6DC] px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-3 px-2"
            aria-label={t('header.logoApp')}
          >
            <img src="/logo-app.webp" alt="" className="h-12 w-12" draggable={false} />
            <span className="font-viral text-[18px] text-[#1E1B11] leading-none">{t('common.marca')}</span>
          </button>
          <button
            onClick={onToggle}
            className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl text-[#5B4041]/60 hover:bg-[#FFF7E6] hover:text-[#BE0D3E] transition-colors"
            title={t('nav.recolher')}
            aria-label={t('nav.recolher')}
          >
            <PanelLeftClose size={18} strokeWidth={1.9} />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {items.map(({ path, Icon, label, locked, match }) => {
            const active = match(pathname);
            return (
              <button key={path} onClick={() => go(path, label, locked)} className={itemCls(active)} title={label}>
                <span className="relative">
                  <Icon size={19} strokeWidth={1.9} />
                  {path === '/ao-vivo' && isLiveActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#F6B43A] ring-2 ring-white" />
                  )}
                </span>
                <span>{label}</span>
              </button>
            );
          })}

          <a
            href={WHATSAPP_GROUP_URL[lang]}
            target="_blank"
            rel="noopener noreferrer"
            className={itemCls(false)}
            title={t('nav.titles.grupoWhatsapp')}
          >
            <MessageCircle size={19} strokeWidth={1.9} />
            <span>{t('nav.titles.grupoWhatsapp')}</span>
          </a>
        </nav>

        <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-[#F6D6DC]">
          {isExpert && (
            <button onClick={() => navigate('/admin')} className={itemCls(pathname === '/admin')}>
              <ShieldCheck size={19} strokeWidth={1.9} />
              <span>Painel</span>
            </button>
          )}
          <button onClick={() => navigate('/profile')} className={itemCls(pathname === '/profile')}>
            <User size={19} strokeWidth={1.9} />
            <span>{t('header.perfil')}</span>
          </button>
        </div>
      </aside>

      {upgradeModal && <UpgradeModal featureName={upgradeModal} onClose={() => setUpgradeModal(null)} />}
    </>
  );
};

export default SideNav;
