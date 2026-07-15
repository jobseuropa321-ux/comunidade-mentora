# Amentora

App de **área de membros mobile-first (PWA)** para uma comunidade de criadores de
conteúdo — reproduzido a partir do blueprint `viral-app-blueprint`. É uma **SPA
React 18 + TypeScript + Vite**, com Tailwind CSS + shadcn/ui (Radix), roteamento
com React Router v6 (code-split por rota), TanStack Query e visual "liquid glass".

Roda **100% local, sem backend nenhum** — a camada de dados/autenticação que no
app original era Supabase foi trocada por mocks (dados estáticos + `localStorage`).

## Como rodar

```bash
npm install
npm run dev      # http://localhost:5173  (abre logado, direto na Home)
```

Outros comandos:

```bash
npm run build    # build de produção em dist/
npm run preview  # serve o build de produção localmente
```

> Login: como é uma demo local, **qualquer e-mail e senha entram**. Ao abrir pela
> primeira vez você já entra logado como usuário demo. "Sair da conta" (no Perfil)
> leva pra tela de login.

## O que dá pra navegar

- **Home** — banner em carrossel + grade horizontal de módulos ("Comece por aqui" / "Módulos")
- **Módulo → Aula** — hero colorido, progresso, lista de aulas em accordion, player, materiais e fórum da aula
- **Bottom nav** (liquid glass, com orb deslizante): Início · Ao vivo · Comunidade · Referências · Calendário de alerta · Pet · Chat com IA, + botão central de câmera (seletor de roteiro → Estúdio)
- **Header**: Perfil · Notificações · Dashboard de métricas · Kanban de roteiros
- Telas: Ao vivo, Comunidade, Referências virais, Calendário de alerta, Modelos, Dashboard, Kanban, Chat IA, Biblioteca, Pet, Estúdio de gravação, Perfil, Admin, Install (tutorial PWA), Auth, 404
- **Controle de planos** (`PlanGate` + `UpgradeModal`): mude `USER_PLAN` em `src/contexts/PlanContext.tsx` para `'curso'` e veja o paywall borrado nas features bloqueadas.

## Estrutura

```
src/
├── App.tsx                     # providers globais + todas as rotas
├── main.tsx · index.css        # entrada + design system (CSS vars + classes "liquid glass")
├── components/
│   ├── layout/                 # Header, BottomNav, AppLayout, CameraScriptPicker
│   ├── ui/                     # primitivos shadcn (toast, sonner, tooltip, button)
│   ├── BannerCarousel · PlanGate · UpgradeModal · LessonForum · InstallPrompt ...
├── pages/                      # 1 arquivo por rota
├── contexts/                   # AuthContext (mock), PlanContext, ThemeContext
├── hooks/                      # useCourses (mock), useNotifications, useLiveStatus ...
└── data/mockCourses.ts         # módulos / aulas / materiais (fake)
```

## Onde plugar um backend real (ex: Supabase)

A interface dos hooks/contextos é idêntica à do app original, então trocar a camada
de dados **não toca em nenhuma tela**. Os pontos de troca:

| Trocar isto…                        | …por acesso real a                          |
|-------------------------------------|---------------------------------------------|
| `src/contexts/AuthContext.tsx`      | `supabase.auth` (login, sessão, assinatura) |
| `src/hooks/useCourses.ts`           | `supabase.from('modules'/'lessons'/...)`    |
| `src/data/mockCourses.ts`           | tabelas do banco                            |
| `src/hooks/useNotifications.ts`     | tabela de notificações                      |
| `src/hooks/useLiveStatus.ts`        | status de transmissão ao vivo               |
| `USER_PLAN` em `PlanContext.tsx`    | linha de assinatura do usuário              |

## Deploy

`vercel.json` já vem com rewrite de SPA (`/* → /index.html`), headers de segurança
(CSP, X-Frame-Options etc.) e redirects 404 "camuflados". Conecte o repositório na
Vercel e faça o deploy — é build estático (`vite build` → `dist/`).

---

*Design, layout, animações e arquitetura reproduzidos do blueprint. Nome da marca,
logo e banners são placeholders — troque em `public/` (logo-app.svg, covers/) e nos
textos.*
