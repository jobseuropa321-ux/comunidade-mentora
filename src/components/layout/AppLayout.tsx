import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';
import SideNav from './SideNav';
import { useAppUsageTracking } from '@/hooks/useAppUsageTracking';
import PushPermissionModal from '@/components/PushPermissionModal';
import PremioMatriculaModal from '@/components/PremioMatriculaModal';

/* Barra lateral recolhida (só desktop): escolha da aluna, guardada no
   navegador. A largura vai numa variável CSS (--sidenav-w) pra que tudo que
   precisa desviar dela (padding do conteúdo, telas `fixed` do chat) siga
   junto sem cada tela saber do estado. */
const SIDENAV_KEY = 'dam:sidenav';
const lerNavRecolhida = () => {
  try { return localStorage.getItem(SIDENAV_KEY) === 'off'; } catch { return false; }
};

const AppLayout: React.FC = () => {
  useAppUsageTracking();
  const location = useLocation();
  const [navRecolhida, setNavRecolhida] = useState(lerNavRecolhida);
  useEffect(() => {
    try { localStorage.setItem(SIDENAV_KEY, navRecolhida ? 'off' : 'on'); } catch { /* sem storage */ }
  }, [navRecolhida]);
  const alternarNav = useCallback(() => setNavRecolhida(v => !v), []);
  // O pop-up do prêmio vem primeiro; o convite de notificação só entra depois
  // que ele sair do caminho, pra não empilhar um em cima do outro.
  const [premioResolvido, setPremioResolvido] = useState(false);
  const resolverPremio = useCallback(() => setPremioResolvido(true), []);
  // Oculta header apenas dentro de um chat aberto (com slug), não na grid
  // O `(?:es\/|amanda\/)?` aceita o prefixo da variante: sem ele, as telas
  // cheias do espanhol (e da Amanda) continuariam mostrando header e navbar
  // por cima.
  const isChatOpen = /^\/(?:es\/|amanda\/)?chat\/.+/.test(location.pathname);
  const isModuleOpen = /^\/(?:es\/|amanda\/)?modulo\/.+/.test(location.pathname);
  const isAulaOpen   = /^\/(?:es\/|amanda\/)?modulo\/.+\/aula\/.+/.test(location.pathname);
  const telaCheia = isChatOpen || isModuleOpen || isAulaOpen;

  /* DESKTOP (≥ lg): a navegação vira a coluna fixa do SideNav e o conteúdo
     ganha `lg:pl-64` + container largo. Módulo, aula e chat seguem sem o
     header de cima (têm o próprio), mas a coluna lateral fica — é por ela
     que se navega no desktop. No celular nada muda. */
  return (
    <div className="min-h-screen bg-[#FFF7E6]" style={{ '--sidenav-w': navRecolhida ? '0rem' : '16rem' } as React.CSSProperties}>
      <SideNav recolhida={navRecolhida} onToggle={alternarNav} />
      <div className="lg:pl-[var(--sidenav-w)] min-h-screen flex flex-col transition-[padding] duration-200">
        {!telaCheia && <Header />}
        <main className={`flex-1 ${telaCheia ? '' : 'safe-bottom'}`}>
          <div className={telaCheia ? '' : `${navRecolhida ? 'lg:max-w-7xl' : 'lg:max-w-6xl'} lg:mx-auto lg:w-full lg:px-8 lg:pt-2`}>
            <Outlet />
          </div>
        </main>
      </div>
      {!telaCheia && <BottomNav />}
      {/* Convite de notificação: só dispara com o app instalado, então não
          atrapalha quem ainda está navegando pelo Safari. */}
      <PremioMatriculaModal onResolvido={resolverPremio} />
      {premioResolvido && <PushPermissionModal />}
    </div>
  );
};

export default AppLayout;
