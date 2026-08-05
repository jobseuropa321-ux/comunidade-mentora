# Analisar Meu Perfil (agente-12) — Setup de Backend

Agente **BÔNUS** do Estúdio de Criação que não é chat: a aluna manda uma **print
do topo do perfil dela no Instagram** e uma IA **com visão** devolve um parecer
de **foto de perfil**, **nome de exibição** e **bio**, com sugestões prontas pra
copiar e colar.

## Arquitetura

```
/chat/agente-12  →  <AnalisarPerfilAgent />   (src/components/estudio/)
      │  print → FileReader → base64 SEM o prefixo "data:"
      ▼
edge function `analisar-perfil`
      │ 1. valida JWT (401 sem sessão)
      │ 2. valida payload (base64 + mime) ANTES da cota
      │ 3. consome cota → RPC consume_ai_quota('analisar-perfil') → 5/dia
      │ 4. OpenAI com visão (image_url + detail:'high' + json_object)
      │ 5. NORMALIZA o JSON e devolve { analise }
      │    (falhou depois do passo 3? → ai_usage_log.status='failed' = estorno)
      ▼
os 3 cards + botão "Salvar na Biblioteca" (saved_viral_outputs, slug agente-12)
```

| Recurso | Observação |
|---|---|
| function `analisar-perfil` | **o prompt mora nela**, não em `viral_models` — é acoplado ao JSON que a tela renderiza campo a campo |
| `consume_ai_quota` | kind `'analisar-perfil'` = **5 análises/dia**; `expert`/`tester` seguem ilimitados |
| teto de tentativas | 3× o limite/dia contando as falhas (só pros kinds que não são `chat-viral`) |
| secrets | usa os mesmos `OPENAI_API_KEY` e `ALLOWED_ORIGIN` do `chat-viral` |

## Deploy

```bash
supabase functions deploy analisar-perfil --project-ref joqajomzignamixxqeet
```

A migration da cota é `supabase/migrations/20260805120000_quota_analisar_perfil.sql`
(um `CREATE OR REPLACE` da `consume_ai_quota` acrescentando o kind novo).

## Onde mexer

| Quero mudar… | Onde |
|---|---|
| **Limite diário** (5) | `WHEN 'analisar-perfil' THEN 5` no `CASE` da `consume_ai_quota` (SQL, sem deploy) |
| O **prompt** da análise | `SYSTEM_PROMPT_TEMPLATE` na function → redeploy |
| **Modelo** da OpenAI | `MODEL` no topo da function (precisa ter **visão** e aceitar `json_object`) |
| Cores/textos da tela | `src/components/estudio/AnalisarPerfilAgent.tsx` |
| Robô e cena do card | `src/components/estudio/AgentRobot.tsx` (`kind === 'perfil'`) |

## Armadilhas (o que quebra a ferramenta)

1. **Kind fora do `CASE`** da `consume_ai_quota` → cai no `ELSE 0`, limite zero, e
   a tela diz "você já usou suas 5 análises de hoje" **na primeira vez**.
2. **Base64 com o prefixo `data:`** → o frontend manda só o miolo (depois da
   vírgula); quem monta `data:<mime>;base64,...` é a function.
3. **`detail: 'low'`** → a IA não lê a bio e começa a inventar. Se precisar cortar
   custo, corte no `max_completion_tokens`.
4. **Tirar o `AbortController`** → fechar/reabrir no meio da análise faz a resposta
   antiga renderizar por cima, e a OpenAI travada deixa spinner eterno.
5. **Confiar no shape cru da IA** → mesmo com `json_object` ela às vezes manda
   `sugestoes` como string; a normalização na function é o que evita
   `.map is not a function` na frente da aluna.
6. **Cota é consumida ANTES da IA** (senão dá pra chamar a OpenAI de graça em
   loop). Por isso existe o estorno com service role — nunca exponha o estorno
   como RPC: a usuária zeraria o próprio limite.
7. **Policy de INSERT/UPDATE/DELETE em `ai_usage_log`**: não crie. Só `SELECT` do
   próprio consumo; quem escreve é a RPC (`SECURITY DEFINER`) e o service role.

## Testar

- [ ] print real do topo do perfil → parecer + 2-3 sugestões de nome + bio pronta
- [ ] uma imagem qualquer (um gato) → `is_perfil: false` e a mensagem gentil
- [ ] deslogada → 401
- [ ] 6ª análise no mesmo dia (numa conta **sem** papel expert/tester) → tela de
      limite, não erro genérico
- [ ] fechar no meio da análise e voltar → tela limpa, sem spinner preso

```sql
-- quem usou hoje
select user_id,
       count(*) filter (where status='ok')     as ok,
       count(*) filter (where status='failed') as falhas
  from ai_usage_log
 where kind='analisar-perfil' and created_at >= date_trunc('day', now())
 group by 1 order by 2 desc;

-- zerar a cota de alguém pra testar de novo hoje
delete from ai_usage_log
 where kind='analisar-perfil'
   and user_id='UUID_DA_USUARIA'
   and created_at >= date_trunc('day', now());
```
