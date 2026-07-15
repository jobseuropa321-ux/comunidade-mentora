# PLANO DE IMPLEMENTAÇÃO DO BACKEND (Supabase) — Amentora

> Roteiro consolidado pra ligar o backend de TODAS as seções do app de uma vez.
> O frontend já está 100% pronto: cada tela roda em modo mock/"backend em
> preparação" e passa a funcionar de verdade só com os passos daqui (nenhuma
> tela precisa ser reescrita — só trocar contexts/hooks e preencher o `.env`).

## Estado da conta Supabase (verificado em 2026-07-13)

| Projeto | Status | Observação |
|---|---|---|
| `gabriel-nalli's Project` (`vnrfzgbqiagxidcaeanr`) | ATIVO | ⚠️ **NÃO USAR** — compartilhado com vários outros apps (CRM de leads, bots, estudo). Já tem tabelas `profiles`, `user_roles`, `community_posts` etc. de OUTRO app → colisão de schema garantida. |
| `LOVABLE TESTES` (`zejrvmvwjujateugmdnw`) | INATIVO | Projeto de testes pausado. |

**Decisão recomendada: criar um projeto NOVO dedicado "amentora"** na organização
`gbdjuyyqoudzkdymnekq`. Custo verificado: **$0/mês** (plano atual). Região sugerida:
`sa-east-1` (São Paulo — usuárias no Brasil).

> ⚠️ Aviso de segurança à parte (não bloqueia nada daqui): o projeto ativo
> `gabriel-nalli's Project` tem **21 tabelas com RLS desligada** (dados expostos
> pra qualquer um com a anon key) — ex.: `documents`, `user_profiles`,
> `chat_messages`, `push_subscriptions`. Vale revisar depois, no contexto daquele app.

---

## Ordem de execução (fazer TUDO numa sessão)

### 1. Criar o projeto
Via MCP do Supabase (`get_cost` → `confirm_cost` → `create_project`) ou dashboard.
Aguardar status `ACTIVE_HEALTHY` (`get_project`).

### 2. Rodar o SQL (nesta ordem — são 4 blocos, um por pacote)
Todos idempotentes; via `apply_migration` (MCP) ou SQL Editor:

1. **Perfil** → `BACKEND_SETUP-perfil.md` — tabela `profiles` + trigger
   `handle_new_user` (cria profile no cadastro) + bucket `avatars` + RLS.
   *É pré-requisito dos demais (auth real e comunidade dependem de `profiles`).*
2. **Agentes IA** → `BACKEND_SETUP-agentes.md` — enum `app_role` + `user_roles` +
   `has_role` + `viral_models` (semeia os 4 slugs `agente-1..4` com prompt
   placeholder) + `saved_viral_outputs` + `ai_usage_log` + RPC `consume_ai_quota`.
3. **Ao Vivo** → `BACKEND_SETUP-aovivo.md` — `live_settings` (linha única id=1,
   realtime) + `live_replays`.
4. **Comunidade** → `BACKEND_SETUP-comunidade.md` — `community_posts/likes/comments` +
   view `community_posts_enriched` + realtime + bucket `community-images` +
   policy de leitura de `profiles` por qualquer logado.

### 3. Deployar as edge functions (já estão no repo)
`supabase/functions/chat-viral/` e `supabase/functions/transcribe-audio/`.
Via MCP (`deploy_edge_function`) ou CLI (`supabase link` + `supabase functions deploy ...`).
- `verify_jwt`: **true** nas duas (elas validam o JWT internamente também).

### 4. Secrets das functions (o Gabriel precisa fazer — envolve a chave da OpenAI)
No dashboard (Edge Functions → Secrets) ou CLI:
```
OPENAI_API_KEY=sk-...           ← obrigatório (chat + transcrição)
ALLOWED_ORIGIN=https://app.com  ← opcional (trava CORS em produção)
```
(`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SERVICE_ROLE_KEY` são injetadas sozinhas.)

### 5. Preencher o `.env` do frontend
```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
```
(Via MCP: `get_project_url` + `get_publishable_keys`.) Com o `.env` preenchido, a
flag `SUPABASE_READY` em `src/integrations/supabase/client.ts` vira `true` e as
telas de Agentes/Biblioteca saem do modo "backend em preparação" sozinhas.

### 6. Trocar o AuthContext mock pelo real
- Base: `docs/backend/AuthContext.supabase.tsx` (do pacote de Perfil — tem
  signUp/signIn/signOut/updateProfile, contrato idêntico ao mock atual).
- Enxertar dele: o `checkRole`/`isExpert` de `docs/backend/AuthContext.supabase-agentes.tsx`
  (lê `user_roles`; no mock `isExpert` é fixo true).
- Substituir `src/contexts/AuthContext.tsx` por essa versão mesclada.
- Efeitos: o auto-login demo morre → login/cadastro reais na tela `/auth`
  (ela já usa o mesmo contrato). Conferir no dashboard se "Confirm email"
  fica ligado ou não (decisão de produto).

### 7. Trocar os mocks restantes pelas versões reais
| Mock atual | Versão real (salva) | O que muda |
|---|---|---|
| `src/hooks/useLiveStatus.ts` | `docs/backend/useLiveStatus.supabase.ts` | live via `live_settings` + realtime |
| `src/pages/Community.tsx` (feed localStorage) | `docs/backend/Community.supabase.tsx` | ⚠️ recolorir pra marca antes (a versão salva está com cores neon antigas) e instalar `date-fns` + shadcn `textarea/dialog/input` OU portar os guards/elementos nativos da versão mock |
| Avatar do Perfil (data URL) | upload real | trocar handlers de `Profile.tsx` pro bucket `avatars` (`{user_id}/avatar.jpg` — código original em `BACKEND_SETUP-perfil.md`) |
| `USER_PLAN` em `PlanContext.tsx` | decisão de produto | hoje fixo `'app'`; ligar a compra/assinatura quando existir |

### 8. Prompts dos agentes (o Gabriel precisa fornecer)
Seguir `PROMPTS_DOS_AGENTES.md` — 1 UPDATE por agente na tabela `viral_models`
(slugs `agente-1..4`). Também personalizar `src/data/agents.ts` (nomes, descrições,
mensagens de abertura, capas em `/public/covers/`).

### 9. Smoke test end-to-end
1. Cadastro → linha aparece em `profiles` (trigger).
2. `/chat/agente-1` → mandar mensagem → resposta da IA (function + OpenAI ok).
3. Salvar resposta → aparece em `/biblioteca`.
4. Microfone → transcrição preenche o input.
5. `UPDATE live_settings SET is_active=true, stream_url='...'` → pulso na navbar +
   player em `/ao-vivo` em tempo real.
6. Post na comunidade com imagem → aparece pra outro usuário logado.
7. `INSERT INTO user_roles (user_id, role) VALUES ('<uuid do Gabriel>', 'expert');`
   → cota ilimitada + linha Admin no perfil.

## Configurações rápidas (onde mexer depois)
| Quero mudar… | Onde |
|---|---|
| Prompt de um agente | `UPDATE viral_models` — sem deploy |
| Modelo OpenAI / máx mensagens (10) / tokens (6000) | topo de `supabase/functions/chat-viral/index.ts` → redeploy |
| Cota diária (50 conversas/dia) | `CASE` dentro de `consume_ai_quota` (SQL) |
| Agenda do Ao Vivo | `src/data/liveSchedule.ts` (local, sem banco) |
