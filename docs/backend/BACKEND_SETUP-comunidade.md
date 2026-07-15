# Comunidade — Setup de Backend (Supabase)

> Instruções pro Claude Code do app novo. Rode quando for integrar o Supabase.
> A tela depende de: **3 tabelas** (`community_posts`, `community_comments`, `community_likes`),
> **1 view** (`community_posts_enriched`), a tabela **`profiles`** (mesma do pacote de Perfil)
> e **1 bucket** de storage (`community-images`).

## Como funciona

| Recurso | Pra quê |
|---|---|
| `community_posts` | os posts (texto + 1 imagem opcional) |
| `community_comments` | comentários de cada post |
| `community_likes` | curtidas (1 por usuário por post) |
| view `community_posts_enriched` | junta o post com o autor (`full_name`, `avatar_url`, `instagram`) + contagem de likes/comentários — é o que o feed lê |
| bucket `community-images` | guarda as imagens dos posts em `{user_id}/{timestamp}.ext` |
| **realtime** em `community_posts` | novos posts / posts apagados aparecem/somem pra todo mundo na hora |

> **Pré-requisito:** a tabela `profiles` (com a coluna `instagram`) precisa existir — é a mesma
> do pacote de **Perfil** (`BACKEND_SETUP.md` de lá). Se ainda não criou, crie primeiro.

---

## SQL — cole no SQL Editor do Supabase

```sql
-- ═══════════════════════════════════════════════════════════════
-- 1) TABELAS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.community_posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL DEFAULT '',
  image_url  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.community_likes (
  post_id    UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)          -- 1 curtida por usuário por post
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON public.community_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON public.community_posts(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 2) RLS
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.community_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes    ENABLE ROW LEVEL SECURITY;

-- posts: todos logados leem; só o dono cria; dono apaga o próprio
CREATE POLICY "posts_read"   ON public.community_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "posts_insert" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_delete" ON public.community_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- comentários: todos leem; só o dono cria; dono apaga o próprio
CREATE POLICY "comments_read"   ON public.community_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert" ON public.community_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON public.community_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- curtidas: todos leem (pra contar e saber se você curtiu); só você cria/apaga a sua
CREATE POLICY "likes_read"   ON public.community_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes_insert" ON public.community_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete" ON public.community_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- IMPORTANTE: pra mostrar nome/foto/@ dos OUTROS no feed, os perfis precisam ser
-- legíveis por qualquer logado. Adicione esta policy na tabela profiles:
CREATE POLICY "profiles_read_all_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
-- (Se você já tinha só "view own profile" na profiles, esta amplia a leitura.
--  São dados públicos de comunidade: nome, avatar e @. Se não quiser, restrinja.)

-- Admin apagar QUALQUER post/comentário (opcional — a tela já tenta isso p/ isExpert).
-- Ajuste ao seu modelo de admin. Exemplo com user_roles:
-- CREATE POLICY "posts_admin_delete" ON public.community_posts FOR DELETE TO authenticated
--   USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'expert'));
-- CREATE POLICY "comments_admin_delete" ON public.community_comments FOR DELETE TO authenticated
--   USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'expert'));

-- ═══════════════════════════════════════════════════════════════
-- 3) VIEW enriquecida (o que o feed lê)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.community_posts_enriched
WITH (security_invoker = true) AS
SELECT
  p.id, p.user_id, p.content, p.image_url, p.created_at,
  pr.full_name, pr.avatar_url, pr.instagram,
  (SELECT COUNT(*) FROM public.community_likes    l WHERE l.post_id = p.id) AS likes_count,
  (SELECT COUNT(*) FROM public.community_comments c WHERE c.post_id = p.id) AS comments_count
FROM public.community_posts p
LEFT JOIN public.profiles pr ON pr.user_id = p.user_id;

-- ═══════════════════════════════════════════════════════════════
-- 4) REALTIME (novos posts / posts apagados aparecem na hora)
-- ═══════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;

-- ═══════════════════════════════════════════════════════════════
-- 5) STORAGE: bucket community-images (público) + policies por dono
-- ═══════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('community-images', 'community-images', true, 5 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "community_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'community-images');
CREATE POLICY "community_images_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "community_images_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING      (bucket_id = 'community-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'community-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "community_images_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'community-images' AND (storage.foldername(name))[1] = auth.uid()::text);
```

---

## Push de curtida/comentário (OPCIONAL)

A tela chama a edge function `notify-community-interaction` quando alguém curte/comenta.
**Se seu app não tem push, ignore** — o código engole o erro silenciosamente e a comunidade
funciona normal. Se quiser ativar, crie essa function (envia web-push pro dono do post).

## Variáveis de ambiente (.env)

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA-ANON-KEY
```

## Trocar o mock pelo Supabase real

A tela usa `useAuth()` pra saber quem é o usuário. Igual ao pacote de Perfil:
1. rode o SQL acima (e o da `profiles`, se ainda não fez);
2. apague `src/contexts/AuthContext.tsx` (mock) e renomeie `AuthContext.supabase.tsx` → `AuthContext.tsx`;
3. garanta que o usuário chega logado. A tela não muda.
