import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PlanProvider } from "@/contexts/PlanContext";
import PlanGate from "@/components/PlanGate";
import AppLayout from "@/components/layout/AppLayout";
import Auth from "@/pages/Auth";
import Home from "@/pages/Home";
import InstallPrompt from "@/components/InstallPrompt";
import CoinReward from "@/components/CoinReward";
import UpdateBanner from "@/components/UpdateBanner";
import "@/i18n";
import { LanguageSync, localizedPath, useCurrentLang } from "@/i18n/LanguageProvider";

// Rotas carregadas sob demanda (code-split)
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const Kanban        = lazy(() => import("@/pages/Kanban"));
const Referencias   = lazy(() => import("@/pages/Referencias"));
const Alerta        = lazy(() => import("@/pages/Alerta"));
const Modelos       = lazy(() => import("@/pages/Modelos"));
const Profile       = lazy(() => import("@/pages/Profile"));
const Admin         = lazy(() => import("@/pages/Admin"));
const Dashboard     = lazy(() => import("@/pages/Dashboard"));
const Community     = lazy(() => import("@/pages/Community"));
const Install       = lazy(() => import("@/pages/Install"));
const Chat          = lazy(() => import("@/pages/Chat"));
const AoVivo        = lazy(() => import("@/pages/AoVivo"));
const Pet           = lazy(() => import("@/pages/Pet"));
const Biblioteca    = lazy(() => import("@/pages/Biblioteca"));
const ModuleDetail  = lazy(() => import("@/pages/ModuleDetail"));
const AulaDetail    = lazy(() => import("@/pages/AulaDetail"));
const Estudio       = lazy(() => import("@/pages/Estudio"));
const OfertaViral1Min = lazy(() => import("@/pages/OfertaViral1Min"));
const NotFound      = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const Spinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#FFF9EE]">
    <div className="w-10 h-10 border-2 border-[#BE0D3E] border-t-transparent rounded-full animate-spin" />
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const lang = useCurrentLang();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to={localizedPath("/auth", lang)} replace />;

  return (
    <>
      <InstallPrompt />
      {children}
    </>
  );
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const lang = useCurrentLang();

  if (loading) return <Spinner />;
  if (user) return <Navigate to={localizedPath("/home", lang)} replace />;

  return <>{children}</>;
};

/* Rotas de DENTRO do AppLayout, com paths RELATIVOS (sem barra inicial).
   Este mesmo bloco é montado duas vezes: em "/" (português) e em "/es" (espanhol).
   Mexeu aqui, vale para os dois idiomas automaticamente. */
const layoutRoutes = (
  <>
    <Route index element={<Navigate to="home" replace />} />
    <Route path="home" element={<Home />} />
    <Route path="ao-vivo" element={<AoVivo />} />
    <Route path="pet" element={<Pet />} />
    <Route path="referencias" element={<PlanGate featureName="Referências"><Referencias /></PlanGate>} />
    <Route path="alerta" element={<PlanGate featureName="Calendário de Alerta"><Alerta /></PlanGate>} />
    <Route path="modelos" element={<Modelos />} />
    <Route path="dashboard" element={<PlanGate featureName="Dashboard de Métricas"><Dashboard /></PlanGate>} />
    <Route path="kanban" element={<PlanGate featureName="Kanban de Roteiros"><Kanban /></PlanGate>} />
    <Route path="community" element={<PlanGate featureName="Comunidade"><Community /></PlanGate>} />
    <Route path="profile" element={<Profile />} />
    <Route path="admin" element={<Admin />} />
    <Route path="install" element={<Install />} />
    <Route path="chat" element={<PlanGate featureName="Modelos Virais" allowTrial><Chat /></PlanGate>} />
    <Route path="chat/:formatSlug" element={<PlanGate featureName="Modelos Virais" allowTrial><Chat /></PlanGate>} />
    <Route path="biblioteca" element={<PlanGate featureName="Biblioteca" allowTrial><Biblioteca /></PlanGate>} />
    <Route path="biblioteca/:modelSlug" element={<PlanGate featureName="Biblioteca" allowTrial><Biblioteca /></PlanGate>} />
    <Route path="modulo/:moduleId" element={<ModuleDetail />} />
    <Route path="modulo/:moduleId/aula/:aulaId" element={<AulaDetail />} />
  </>
);

/* Rotas de FORA do AppLayout (tela cheia). Estas NÃO são um bloco relativo:
   precisam ser declaradas nas duas árvores na mão. Esquecer a variante /es
   dá 404 silencioso para a aluna espanhola — foi o erro nº 1 do app original. */
const fullscreenRoutes = (prefix: "" | "/es") => (
  <>
    <Route path={`${prefix}/auth`} element={<PublicRoute><Auth /></PublicRoute>} />
    <Route path={`${prefix}/reset-password`} element={<ResetPassword />} />
    <Route path={`${prefix}/estudio`} element={<ProtectedRoute><Estudio /></ProtectedRoute>} />
    <Route path={`${prefix}/estudio/:cardId`} element={<ProtectedRoute><Estudio /></ProtectedRoute>} />
    {/* Oferta do Viral 1 Min — aberta pela "aula" do módulo viral-em-1-minuto.
        Fora do AppLayout: é uma VSL, ocupa a tela toda (tem botão de voltar). */}
    <Route path={`${prefix}/oferta/viral-1-min`} element={<ProtectedRoute><OfertaViral1Min /></ProtectedRoute>} />
  </>
);

const AppRoutes = () => (
  <Suspense fallback={<Spinner />}>
    <Routes>
      {fullscreenRoutes("/es")}
      {fullscreenRoutes("")}

      <Route path="/es" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        {layoutRoutes}
      </Route>
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        {layoutRoutes}
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <CoinReward />
        <UpdateBanner />
        <BrowserRouter>
          <LanguageSync />
          <AuthProvider>
            <PlanProvider>
              <AppRoutes />
            </PlanProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
