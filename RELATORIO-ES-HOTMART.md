# Versão em espanhol + Hotmart — relatório da implementação

Executado automaticamente em 2026-08-12, madrugada, a partir do kit em
`~/Downloads/kit-espanhol-hotmart`. Branch **`feat/espanhol-hotmart`**, 9 commits.

**Nada foi para produção.** Sem `git push`, sem deploy de edge function, sem
deploy na Vercel, e o banco de produção não recebeu nenhuma escrita — só
leituras para levantar o estado real. As migrations existem como arquivo.

---

## Como conferir rápido

```bash
git checkout feat/espanhol-hotmart
npm install
npm run build          # passa
npm run i18n:check     # paridade pt/es: 785 chaves de cada lado, 0 divergências
node scripts/audit-i18n.mjs   # o que ainda falta traduzir, arquivo a arquivo
npm run dev -- --port 5199    # a porta 5173 está ocupada por outro projeto seu
```

Depois abra `http://127.0.0.1:5199/es/auth` e `http://127.0.0.1:5199/auth`.

Verificado no navegador durante a execução:

| Checagem | Resultado |
|---|---|
| `/es/auth` renderiza em espanhol | ok |
| `/auth` continua idêntico em português | ok |
| `html lang` | `es` no /es, `pt-BR` no / |
| manifest injetado | `/manifest-es.webmanifest` no /es, `/manifest.webmanifest` no / |
| `og:locale` | `es_ES` no /es, `pt_BR` no / |
| `/es/home` deslogado | cai em **`/es/auth`**, não em `/auth` |
| rota profunda `/es/modulo/x` deslogado | cai em `/es/auth` |
| console | só os avisos pré-existentes de future flag do React Router |

---

## O que ficou pronto

**FASE 1 — motor de i18n.** `src/i18n/` com `getLangFromPath`, `localizedPath`,
`unlocalizedPath`, `useLocalizedNavigate`, `LanguageSync` e `aiLang.ts`. O bloco
de rotas do layout é montado duas vezes (`/` e `/es`) e as rotas de tela cheia
foram declaradas nas duas árvores. Os 17 arquivos com `useNavigate` migraram.
Aplicada a melhoria que o guia recomenda: o i18next inicia no idioma da URL em
vez de `'pt'` fixo, para não renderizar um frame em português ao abrir `/es`.

**Cinco vazamentos de prefixo** que o `useNavigate` não pega foram corrigidos:
comparação de rota ativa da BottomNav, regex de tela cheia do AppLayout, `<Link>`
do BannerCarousel, `<Link>` do upsell na Home e o `<Navigate>` de aula-que-é-página
no AulaDetail. Mais dois que o kit não cita: os links enviados **por e-mail**
(recuperação de senha e confirmação de cadastro) levavam a aluna espanhola de
volta para a tela em português.

**FASE 2 — tradução.** Toda a interface fora do painel Admin, incluindo os
formulários de briefing dos 8 agentes (43 perguntas) e todos os arrays de
dados, que ficaram neutros com o texto resolvido no render.

**FASE 3 — PWA.** `manifest-es.webmanifest` (start_url `/es/home`, scope `/es/`,
lang `es-ES`), registrado no `includeAssets`. O `<link rel="manifest">` estático
saiu do `index.html`: o manifest é injetado por script inline, que é o fix da
race do iOS descrita no kit. O mesmo script troca `title`, `description` e as
`og:`/`twitter:`. A guarda de boot (a tela de socorro que roda fora do React)
também fala espanhol.

**FASE 4 — comunidade por idioma.** Leitura, realtime e escrita filtrando por
`locale`. Migrations escritas (ver abaixo).

**FASE 5 — IA em espanhol.** Técnica A (sufixo invisível) no `chat-viral`,
técnica B (troca de diretivas no template) no `analisar-perfil`, técnica C
(idioma no Whisper) no `transcribe-audio`. Mais as mensagens de erro das três
funções, que o app original esqueceu e o frontend imprime cruas.

**FASE 6 — webhook da Hotmart.** `supabase/functions/hotmart-webhook/` com as 6
correções obrigatórias do guia, escrito no padrão do `hubla-webhook` deste
projeto (retry no 403 intermitente do Auth, 500 para forçar replay, e-mail
quando a conta já existe) — que é mais maduro que o webhook do kit.

---

## O que NÃO ficou pronto

### 1. Tradução: concluída fora do Admin

Fechada numa segunda passada. 785 chaves em cada dicionário, paridade
exata, e o `npm run i18n:check` confere três coisas a cada rodada:

| Verificação | Resultado |
|---|---|
| Chaves faltando/sobrando entre pt e es | 0 |
| Arrays de tamanho diferente entre os idiomas | 0 |
| Valores vazios no espanhol | 0 |
| Chaves usadas no código que não existem no dicionário | 0 de 405 |

O painel Admin (6 arquivos, ~70 strings) continua em português **por
decisão do kit** — se um operador espanhol for usar o painel, isso vira
trabalho novo.

Sobram ~21 ocorrências que o `audit-i18n.mjs` ainda aponta. Conferi uma a
uma: são identificadores (`'Todos'`, `'Humor'` são valores de tipo usados
em filtro e como chave de estilo, não rótulos — o texto exibido passa
pelo dicionário), comentários de código, URLs, e `src/data/mockCommunity.ts`,
que está morto (só citado num comentário da Community).

**Uma decisão que tomei e vale revisar:** as funções `compile*` do
Chat.tsx, que montam o briefing enviado à IA, NÃO foram traduzidas. O
guia é explícito em não traduzir string que só serve de entrada pro
modelo — e a diretiva de idioma da FASE 5 já faz a IA responder em
espanhol mesmo recebendo briefing em português.

### 2. Capas e banners em espanhol: prontos, com 4 lacunas de arte

Recebidas em 2026-08-12 e convertidas para o padrão do projeto (WebP, capas
800x1067, banners 1600x720): 600 MB de PNG viraram 1,4 MB.

**12 módulos** já mostram capa em espanhol pela convenção de pasta espelho
(`/covers/modulos/es/<slug>.webp`), que não depende de escrita no banco.
Verificado servindo os caminhos: capa existente devolve `image/webp`, a
inexistente devolve HTML e dispara o `onError`, que cai na capa portuguesa.

**Revisão de decisão.** A primeira passada escolheu a coluna `cover_url_es`
pelo argumento de trocar capa sem deploy. Ao ver o dado real, o argumento caiu:
`cover_url` guarda caminho de arquivo do repositório, então trocar a imagem
exige deploy de qualquer forma. A pasta espelho passou a ser o caminho normal.

A coluna continua valendo como override — e é **obrigatória** para os 7 módulos
criados pelo painel, que guardam URL do Supabase Storage e por isso ficam fora
do espelho (CPF/CNPJ, barbearia, procrastinação, conteúdo 4D, clientes todos os
dias, cursos presenciais e Viral 1 Min). O editor de módulo no Admin já tem o
campo "Capa em espanhol", mas ele **só funciona depois da migration
`20260812020200_modules_cover_url_es.sql`** — antes disso, salvar o módulo falha
com erro de coluna inexistente.

**Sem arte em espanhol** (caem na capa PT): guia de produto, guia de gravação,
guia de área de membro e resultados de alunas.

**Três capas ficaram sem módulo**, guardadas com `_` na frente em
`public/covers/modulos/es/`: a do Zap Voice (módulo apagado a pedido em
2026-08-12), "Cómo funciona el Aplicación" e "Indicaciones para crear contenido
y imágenes" — estas duas não correspondem a nenhum módulo existente.

### 3. Conteúdo do banco continua só em português

Título, subtítulo e descrição dos módulos e das aulas vêm do banco e existem
numa língua só. Um aluno em `/es` vê a interface em espanhol e o **conteúdo** em
português. Resolver isso é uma decisão de produto que ninguém tomou ainda, e há
dois caminhos:

- colunas `_es` nas tabelas (`title1_es`, `descricao_es`…), ou
- gate de frontend com um catálogo próprio para o espanhol, que é o que o app
  original fez (FASE 7 do guia, `esCourse.ts`).

Não implementei nenhum dos dois: qualquer escolha muda o painel Admin e a forma
de cadastrar conteúdo.

### 4. Itens que o kit lista e continuam pendentes

- Logo (`/logo-app.webp`) não tem texto de marca embutido, então passou — mas
  confira em tela cheia.
- Prints do tutorial de instalação (`public/install/*.webp`) mostram um iPhone
  **em português**. A legenda está em espanhol e a imagem não. Exige recapturar.
- E-mail de recuperação de senha usa o template único do Supabase Auth, que não
  tem versão em espanhol. O link já leva para `/es/reset-password`; o corpo do
  e-mail, não.
- Push notifications não recebem idioma (nenhum emissor, nem o `sw.js`).

---

## Migrations

Aplicadas em produção em 2026-08-12 (o nome do arquivo já bate com a versão
registrada no banco, então `supabase db push` não tenta reaplicar):

| Arquivo | O que fez |
|---|---|
| `20260812152357_subscriptions_allow_hotmart_provider.sql` | `hotmart` no CHECK de `provider` — destravou o webhook |
| `20260812152409_modules_cover_url_es.sql` | coluna da capa em espanhol |
| `20260812152428_community_posts_locale.sql` | `locale` na comunidade + CHECK + índice + view recriada |
| `20260812153114_modules_lessons_texto_es.sql` | texto de módulo e aula em espanhol |

**NÃO aplicadas, com extensão `.INERTE` para o `db push` não pegar:**

`20260812020300_check_email_subscription_revoke_anon.sql.INERTE` — desativada
por decisão do dono do produto. A falha continua aberta: a RPC é SECURITY
DEFINER com EXECUTE para `anon`, e como a chave anônima está no bundle,
qualquer pessoa consegue descobrir se um e-mail é cliente e se cancelou ou pediu
reembolso. O motivo de não aplicar é o tamanho do estrago no caso de erro: 685
assinaturas ativas, e o sintoma seria a tela de login negando acesso a todas ao
mesmo tempo, em silêncio. O arquivo tem o comando de rollback no cabeçalho.

`20260812020400_expire_subscriptions_cron.sql.INERTE` — cron de expiração.
Hoje nenhuma assinatura do DAM expira por tempo. Ligar sem conferir os dados
corta acesso de quem tiver `expires_at` errado, e este projeto já teve esse
incidente com a validade da Hubla. As queries de conferência estão no arquivo.

## Variáveis de ambiente a configurar

No painel do Supabase, em Edge Functions → Secrets:

| Variável | Onde consigo |
|---|---|
| `HOTMART_WEBHOOK_SECRET` | o *hottok*, no painel da Hotmart |
| `HOTMART_PRODUCT_IDS` | id(s) do produto do DAM na Hotmart, separados por vírgula |
| `HOTMART_ANNUAL_PRODUCT_IDS` | quais desses ids são plano anual (opcional; o resto vira mensal) |
| `RESEND_API_KEY` | já existe para o `hubla-webhook`; a mesma serve |

`HOTMART_PRODUCT_IDS` **vazia rejeita tudo**, de propósito e com log. Foi escolha
minha: liberar geral por engano de configuração é pior do que não liberar
ninguém e o erro aparecer. No app original a ausência de filtro fez 181 de 190
eventos virem de um produto que nem era o app.

Deploy do webhook (quando for a hora):

```bash
supabase functions deploy hotmart-webhook --no-verify-jwt
```

A flag agora está versionada em `supabase/config.toml` (arquivo que não existia).
Sem ela, a function devolve 401 permanente e as vendas param de liberar acesso em
silêncio — o erro só aparece no painel da Hotmart.

---

## A pergunta do `anon` na RPC: pode revogar

**Pode, e a migration está escrita.** Não apliquei porque a regra desta rodada é
não tocar no banco, mas a investigação fechou.

O risco era: `check_email_subscription` tem `GRANT EXECUTE` para `anon`, e como a
chave anônima está no bundle do frontend, qualquer pessoa pode descobrir se um
e-mail é cliente. Revogar resolve — **desde que** o app não chame a RPC antes do
login. Se chamasse, revogar derrubaria o login de todo mundo.

O que verifiquei no código:

- `checkSubscription()` (`src/lib/subscription.ts:44`) tem **um único** chamador:
  `validateAndPublishSession(nextSession)` em `src/contexts/AuthContext.tsx:90`.
- Essa função **recebe uma Session pronta**. É chamada em dois lugares: logo
  depois de `signInWithPassword` ter retornado sessão (`signIn`), e a partir do
  `onAuthStateChange` com `nextSession`. Nos dois casos o supabase-js já manda o
  JWT de `authenticated`.
- O comentário em `subscription.ts` ("RPC com grant pra anon — dá pra checar até
  antes de logar") descreve uma **capacidade que o app não usa**. Foi o que quase
  me fez concluir o contrário; por isso está escrito aqui.

Antes de aplicar, reconfirme com `grep -rn "check_email_subscription" src/`. Se
aparecer chamada fora do fluxo autenticado, não aplique — o sintoma seria a tela
de login dizendo "acesso não liberado" para clientes em dia.

---

## Bugs P0 que continuam lá (fora de escopo por sua decisão)

Você optou por não corrigi-los nesta rodada. Ficam registrados, e o DAM tem os
mesmos arquivos do app do kit, então herda os três:

1. **WhatsApp com `55` na frente.** Em `send-scheduled-reminders`, a regra
   `whatsapp.length > 11 ? whatsapp : '55'+whatsapp` prefixa o Brasil em número
   espanhol: `34` + 9 dígitos dá exatamente 11 caracteres. Medido no app
   original: **9 de 10 lembretes espanhóis falharam**. (Esta função não existe no
   DAM hoje — se for criada, não replique a regra.)
2. **Fuso cravado em Brasília.** `src/pages/Alerta.tsx` e
   `src/pages/Referencias.tsx` montam a data com `-03:00` literal. Quem escolhe
   "noite" na Espanha recebe agendamento para 00:01 de Madrid — e a tela mostra
   o horário de Brasília, então parece certo.
3. **Crons em horário do Brasil.** O banco roda em UTC; um push calibrado para a
   noite brasileira toca de madrugada na Espanha.

O que **foi** corrigido, porque era pré-requisito da tela em espanhol: datas
relativas e números com locale fixo (`toLocaleDateString('pt-BR')` espalhado por
Dashboard, Biblioteca, AoVivo, Community, LessonForum e Header), agora
centralizados em `src/lib/formatLocale.ts`.

---

## Ordem sugerida para retomar

1. Aplicar a migration do `provider` — sem ela o webhook não grava nada.
2. Configurar as env vars e deployar o `hotmart-webhook` com `--no-verify-jwt`.
3. Disparar um evento de teste pela Hotmart e conferir: cria conta, grava
   subscription, manda e-mail em espanhol, e **rejeita** produto fora da lista.
4. Decidir o caminho do conteúdo em espanhol (item 3 de "o que não ficou") — é o
   que trava o resto.
5. Decidir se o painel Admin precisa de espanhol (hoje é a única parte da
   interface que continua em português).
6. Rodar `npm run i18n:check` antes de cada deploy. Com `fallbackLng: 'pt'`, uma
   chave faltando renderiza o texto em português sem erro e sem aviso no
   console — foi assim que 322 strings escaparam no app original.

## Observação sobre o ambiente

`deno check` passa em `hotmart-webhook`, `analisar-perfil` e `chat-viral`. Em
`transcribe-audio` ele falha ao resolver `npm:openai` do `edge-runtime.d.ts` —
confirmei que **já falhava antes das minhas mudanças** (rodei o mesmo comando na
versão da `main`). É limitação do ambiente local, não do código; a sintaxe do
arquivo foi validada com `deno lint`.
