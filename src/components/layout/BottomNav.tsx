import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePlan } from '@/contexts/PlanContext';
import UpgradeModal from '@/components/UpgradeModal';
import { useLiveStatus } from '@/hooks/useLiveStatus';

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

const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasFullAccess, canUseChatTrial } = usePlan();
  const pathname = location.pathname;
  const [upgradeModal, setUpgradeModal] = useState<string | null>(null);
  const { status: liveStatus } = useLiveStatus();
  const isLiveActive = liveStatus.is_active && !!liveStatus.stream_url;

  const chatLocked = !hasFullAccess && !canUseChatTrial;

  // Rotas mantidas — só o visual mudou (design "A Mentora")
  const navItems = [
    { path: '/home',      kind: 'home'  as const, label: 'home',       title: 'Início',     locked: false },
    { path: '/ao-vivo',   kind: 'video' as const, label: 'ao vivo',    title: 'Ao vivo',    locked: false },
    { path: '/community', kind: 'users' as const, label: 'comunidade', title: 'Comunidade', locked: !hasFullAccess },
    { path: '/chat',      kind: 'stars' as const, label: 'cursos',     title: 'Cursos',     locked: chatLocked },
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
          <div className="w-[95%] max-w-[380px] bg-white border border-[#F6D6DC] rounded-full flex justify-between items-center p-1 shadow-[0_12px_32px_-8px_rgba(190,13,62,0.20)]">
            {navItems.map(({ path, kind, label, title, locked }) => {
              const active = isItemActive(path);
              return (
                <button
                  key={path}
                  onClick={() => handleNav(path, title, locked)}
                  title={title}
                  className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-[2rem] border w-1/4 transition-all duration-300 ease-in-out ${
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
