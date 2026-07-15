# Como colocar os PROMPTS nos agentes

Os prompts dos agentes **não ficam no código** — ficam na tabela `viral_models`
do Supabase, protegidos por RLS (só o backend lê; o usuário do app nunca vê).

Isso significa que trocar/ajustar um prompt é **1 comando SQL, sem deploy,
sem mexer em código**. Vale na hora pra todo mundo.

## Colar o prompt de um agente

Cole no SQL Editor do Supabase, trocando o texto entre `$prompt$ ... $prompt$`
pelo prompt real (pode ter aspas, quebras de linha, markdown — o `$prompt$`
protege tudo, não precisa escapar nada):

```sql
-- AGENTE 1
UPDATE public.viral_models SET prompt = $prompt$
COLE AQUI O PROMPT COMPLETO DO AGENTE 1.

Pode ter várias linhas, "aspas", 'apóstrofos', **markdown**, o que quiser.
$prompt$ WHERE slug = 'agente-1';
```

```sql
-- AGENTE 2
UPDATE public.viral_models SET prompt = $prompt$
COLE AQUI O PROMPT COMPLETO DO AGENTE 2.
$prompt$ WHERE slug = 'agente-2';
```

```sql
-- AGENTE 3
UPDATE public.viral_models SET prompt = $prompt$
COLE AQUI O PROMPT COMPLETO DO AGENTE 3.
$prompt$ WHERE slug = 'agente-3';
```

```sql
-- AGENTE 4
UPDATE public.viral_models SET prompt = $prompt$
COLE AQUI O PROMPT COMPLETO DO AGENTE 4.
$prompt$ WHERE slug = 'agente-4';
```

> ⚠️ Única regra: o prompt não pode conter a sequência literal `$prompt$`.
> Se por acaso contiver, troque o delimitador nos dois lados (ex.: `$p2$ ... $p2$`).

## Conferir o que está salvo

```sql
SELECT slug, name, LEFT(prompt, 100) AS inicio_do_prompt, updated_at
FROM public.viral_models ORDER BY slug;
```

## Adicionar um 5º agente

1. **Banco** — insira a linha com o prompt (reexecutável — se já existir, atualiza):
   ```sql
   INSERT INTO public.viral_models (slug, name, prompt)
   VALUES ('agente-5', 'Agente 5', $prompt$ PROMPT DO AGENTE 5 $prompt$)
   ON CONFLICT (slug) DO UPDATE
     SET name = EXCLUDED.name, prompt = EXCLUDED.prompt;
   ```
2. **Frontend** — adicione o objeto correspondente em `src/data/agents.ts`
   (mesmo `slug: 'agente-5'`) com nome, descrição, ícone, cor e mensagem
   de abertura. Pronto — ele aparece na grade automaticamente.

## Renomear um agente

- O **nome exibido** (card, header do chat, Biblioteca) vem do
  `src/data/agents.ts` → mude lá.
- O `name` da tabela é só informativo/organizacional — atualize se quiser:
  `UPDATE public.viral_models SET name = 'Novo Nome' WHERE slug = 'agente-1';`
- **Não mude o `slug`** depois que tiver roteiros salvos — a Biblioteca agrupa
  por slug. Se precisar mesmo, atualize também `saved_viral_outputs.model_slug`.

## Dicas de estrutura do prompt (do jeito que o sistema usa)

O prompt vira a mensagem `system` da conversa; as mensagens do usuário e as
respostas anteriores da IA entram como histórico. Ou seja, escreva o prompt
como as "instruções permanentes" do agente: persona, o que ele produz, formato
da resposta, regras do que evitar. A **mensagem de abertura** que o usuário vê
ao entrar no chat é outra coisa (client-side, em `agents.ts` → `openingMessage`)
— ela não consome tokens e não faz parte do prompt.
