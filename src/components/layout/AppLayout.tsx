import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';
import { useAppUsageTracking } from '@/hooks/useAppUsageTracking';

const AppLayout: React.FC = () => {
  useAppUsageTracking();
  const location = useLocation();
  // Oculta header apenas dentro de um chat aberto (com slug), não na grid
  // O `(?:es\/)?` aceita o prefixo de idioma: sem ele, as telas cheias do
  // espanhol continuariam mostrando header e navbar por cima.
  const isChatOpen = /^\/(?:es\/)?chat\/.+/.test(location.pathname);
  const isModuleOpen = /^\/(?:es\/)?modulo\/.+/.test(location.pathname);
  const isAulaOpen   = /^\/(?:es\/)?modulo\/.+\/aula\/.+/.test(location.pathname);

  return (
    <div className="min-h-screen bg-[#FFF7E6]">
      {!isChatOpen && !isModuleOpen && !isAulaOpen && <Header />}
      <main className={isModuleOpen || isAulaOpen ? '' : 'safe-bottom'}>
        <Outlet />
      </main>
      {!isChatOpen && !isModuleOpen && !isAulaOpen && <BottomNav />}
    </div>
  );
};

export default AppLayout;
