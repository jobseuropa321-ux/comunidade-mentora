# Ao Vivo — Setup de Backend (Supabase)

> Instruções pro Claude Code do app novo. Rode quando for integrar o Supabase.
> A tela depende de **2 tabelas**: `live_settings` (a live atual) e `live_replays` (gravações).
> A agenda de "Próximas aulas" é **local** (arquivo `src/data/liveSchedule.ts`) — não precisa de banco.

## Como funciona

| Recurso | Pra quê |
|---|---|
| `live_settings` (linha única `id=1`) | liga/desliga a live e guarda o link do stream + título/descrição/mentor. **Realtime**: quando você muda `is_active`/`stream_url`, todos os apps abertos atualizam na hora. |
| `live_replays` | as gravações que aparecem no carrossel "Replays" |

O player entende **YouTube** (vira embed automático: `watch?v=`, `/live/`, `/embed/`, `/shorts/`, `youtu.be`). Se o link não for YouTube (Meet, etc.), a live vira um card com botão "Assistir ao vivo" que abre em nova aba. Nos replays, se não for YouTube ele tenta embutir a própria URL.

---

## SQL — cole no SQL Editor do Supabase

```sql
-- ═══════════════════════════════════════════════════════════════
-- 1) live_settings — 1 linha só (id = 1)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.live_settings (
  id          INT PRIMARY KEY DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT false,
  stream_url  TEXT,
  title       TEXT,
  description TEXT,
  presenter   TEXT,
  updated_by  UUID REFERENCES auth.users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT live_settings_single_row CHECK (id = 1)
);

-- cria a linha única
INSERT INTO public.live_settings (id, is_active) VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.live_settings ENABLE ROW LEVEL SECURITY;

-- todo mundo logado consegue LER o status da live (necessário pro realtime)
CREATE POLICY "live_settings_read" ON public.live_settings
  FOR SELECT TO authenticated USING (true);

-- escrita: só admin. Ajuste ao seu modelo de admin. Exemplo com tabela user_roles:
-- CREATE POLICY "live_settings_admin_write" ON public.live_settings
--   FOR UPDATE TO authenticated
--   USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'expert'));
-- (Sem essa policy, você atualiza a live pelo dashboard do Supabase / service role.)

-- REALTIME: habilita para a tela receber os UPDATEs ao vivo
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_settings;

-- ═══════════════════════════════════════════════════════════════
-- 2) live_replays — gravações (carrossel)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.live_replays (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  description    TEXT,
  video_url      TEXT NOT NULL,          -- link do YouTube (ou outro player)
  cover_url      TEXT,                   -- URL da capa (imagem 3:4). Pode ser externa ou de um bucket
  duration_label TEXT,                   -- ex.: "1h 20min"
  recorded_at    DATE,                   -- data da gravação (YYYY-MM-DD)
  position       INT NOT NULL DEFAULT 0, -- ordena o carrossel (maior primeiro)
  is_published   BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.live_replays ENABLE ROW LEVEL SECURITY;

-- todo mundo logado vê os replays PUBLICADOS
CREATE POLICY "live_replays_read_published" ON public.live_replays
  FOR SELECT TO authenticated USING (is_published = true);

-- escrita: só admin (mesmo padrão da live_settings). Ou gerencie pelo dashboard.

-- mantém updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS update_live_replays_updated_at ON public.live_replays;
CREATE TRIGGER update_live_replays_updated_at
  BEFORE UPDATE ON public.live_replays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

## Como colocar uma live no ar

Atualize a linha `id=1` (pelo dashboard, por um painel admin, ou service role):

```sql
UPDATE public.live_settings SET
  is_active   = true,
  stream_url  = 'https://www.youtube.com/watch?v=XXXXXXXX',
  title       = 'Mentoria da semana',
  description = 'Bora tirar dúvidas ao vivo!',
  presenter   = 'Fulano'
WHERE id = 1;
```

A tela de todos os usuários abertos reflete na hora (realtime). Pra tirar do ar: `is_active = false`.

## Como publicar um replay

```sql
INSERT INTO public.live_replays (title, description, video_url, cover_url, duration_label, recorded_at, position, is_published)
VALUES ('Aula 01 — Introdução', 'Resumo da aula', 'https://youtu.be/XXXXXXXX',
        'https://.../capa.webp', '1h 12min', '2026-07-10', 10, true);
```

## Variáveis de ambiente (.env)

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA-ANON-KEY
```

> Sem o `.env`, a tela ainda abre e mostra os estados vazios + a agenda local. A live real e os replays só aparecem depois de configurar o Supabase e rodar o SQL acima.
