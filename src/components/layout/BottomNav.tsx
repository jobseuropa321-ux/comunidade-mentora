import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePlan } from '@/contexts/PlanContext';
import UpgradeModal from '@/components/UpgradeModal';
import { useLiveStatus } from '@/hooks/useLiveStatus';
import { useLocalizedNavigate, useCurrentLang, unlocalizedPath } from '@/i18n/LanguageProvider';
import { useTranslation } from 'react-i18next';

/* ── Ícones (SVG do design "A Mentora", herdam a cor via currentColor) ── */

// Casa: sólida quando inativa, contorno com porta quando ativa
const HomeIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg width={22} height={22} viewBox="0 0 24 24">
    <path
      d="M12 3L4 9v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-8-6z"
      fill="currentColor"
      style={{ opacity: active ? 0 : 1, transition: 'opacity 0.3s ease-in-out' }}
    />
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: active ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }}
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </g>
  </svg>
);

// Vídeo (ao vivo) — com ponto de notificação laranja quando há live
const VideoIcon: React.FC<{ live: boolean }> = ({ live }) => (
  <svg
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <polygon points="10 7 15 10 10 13 10 7" />
    {live && <circle cx="19" cy="5" r="2.5" fill="#F6B43A" stroke="none" />}
  </svg>
);

// Amigos (comunidade)
const UsersIcon: React.FC = () => (
  <svg
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

// Destaques (cursos / estrelinhas)
const SparklesIcon: React.FC = () => (
  <svg
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2L14.4 7.6L20 10L14.4 12.4L12 18L9.6 12.4L4 10L9.6 7.6L12 2Z" />
    <path d="M18 16L19.2 18.8L22 20L19.2 21.2L18 24L16.8 21.2L14 20L16.8 18.8L18 16Z" />
    <path d="M20 4L20.6 5.4L22 6L20.6 6.6L20 8L19.4 6.6L18 6L19.4 5.4L20 4Z" />
  </svg>
);

// Logo oficial do WhatsApp (glifo branco)
const WhatsAppIcon: React.FC = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

/* Link do convite do grupo do WhatsApp da comunidade. */
const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/JUUOZVbvbLh1vMvDTC4D7P?mode=gi_t';

const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useLocalizedNavigate();
  const { t } = useTranslation();
  const { hasFullAccess, canUseChatTrial } = usePlan();
  const lang = useCurrentLang();
  // Desprefixa antes de comparar: em /es/home o pathname é '/es/home',
  // e sem isso nenhum item do menu jamais fica ativo no espanhol.
  const pathname = unlocalizedPath(location.pathname, lang);
  const [upgradeModal, setUpgradeModal] = useState<string | null>(null);
  const { status: liveStatus } = useLiveStatus();
  const isLiveActive = liveStatus.is_active && !!liveStatus.stream_url;

  const chatLocked = !hasFullAccess && !canUseChatTrial;

  // Rotas mantidas — só o visual mudou (design "A Mentora")
  const navItems = [
    { path: '/home',      kind: 'home'  as const, label: t('nav.home'),       title: t('nav.titles.home'),       locked: false },
    { path: '/ao-vivo',   kind: 'video' as const, label: t('nav.aoVivo'),     title: t('nav.titles.aoVivo'),     locked: false },
    { path: '/community', kind: 'users' as const, label: t('nav.comunidade'), title: t('nav.titles.comunidade'), locked: !hasFullAccess },
    { path: '/chat',      kind: 'stars' as const, label: t('nav.cursos'),     title: t('nav.titles.cursos'),     locked: chatLocked },
  ];

  const isItemActive = (path: string) =>
    path === '/chat' ? pathname.startsWith('/chat') : pathname === path;

  const handleNav = (path: string, title: string, locked: boolean) => {
    if (locked) {
      setUpgradeModal(title);
      return;
    }
    navigate(path);
  };

  return (
    <>
      <nav className="bottom-nav">
        <div className="w-full flex justify-center px-4 pb-5 pt-2">
          <div className="w-[95%] max-w-[400px] bg-white border border-[#F6D6DC] rounded-full flex justify-between items-center p-1 shadow-[0_12px_32px_-8px_rgba(190,13,62,0.20)]">
            {navItems.map(({ path, kind, label, title, locked }, i) => {
              const active = isItemActive(path);
              const tab = (
                <button
                  key={path}
                  onClick={() => handleNav(path, title, locked)}
                  title={title}
                  className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-[2rem] border w-1/5 transition-all duration-300 ease-in-out ${
                    active
                      ? 'bg-[#FFF7E6] border-[#F6D6DC] text-[#BE0D3E]'
                      : 'border-transparent text-[#ECA6BB] hover:text-[#BE0D3E] hover:opacity-80'
                  }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {kind === 'home'  && <HomeIcon active={active} />}
                  {kind === 'video' && <VideoIcon live={isLiveActive} />}
                  {kind === 'users' && <UsersIcon />}
                  {kind === 'stars' && <SparklesIcon />}
                  <span className="text-[10px] leading-none font-bold tracking-tight whitespace-nowrap mt-1">
                    {label}
                  </span>
                </button>
              );
              // Botão do WhatsApp "grupo" bem no meio (depois do 2º item)
              if (i === 1) {
                return (
                  <React.Fragment key="tab-1-plus-grupo">
                    {tab}
                    <a
                      href={WHATSAPP_GROUP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t('nav.titles.grupoWhatsapp')}
                      className="flex flex-col items-center justify-center py-1.5 px-0.5 w-1/5 active:scale-95 transition-transform"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <span
                        className="w-[26px] h-[26px] rounded-full flex items-center justify-center shadow-[0_4px_10px_-2px_rgba(190,13,62,0.45)]"
                        style={{ background: 'linear-gradient(135deg, #BE0D3E, #E06B85)' }}
                      >
                        <WhatsAppIcon />
                      </span>
                      <span className="text-[10px] leading-none font-bold tracking-tight whitespace-nowrap mt-1" style={{ color: '#BE0D3E' }}>
                        {t('nav.grupo')}
                      </span>
                    </a>
                  </React.Fragment>
                );
              }
              return tab;
            })}
          </div>
        </div>
      </nav>

      {/* Modal de upgrade */}
      {upgradeModal && (
        <UpgradeModal featureName={upgradeModal} onClose={() => setUpgradeModal(null)} />
      )}
    </>
  );
};

export default BottomNav;
