# Perfil — Setup de Backend (Supabase)

> Instruções pro Claude Code do app novo. Rode isto **quando for integrar o Supabase**.
> A tela de Perfil depende só disto: **1 tabela (`profiles`) + 1 bucket de storage (`avatars`)**.

## O que a tela precisa

| Recurso | Pra quê |
|---|---|
| Tabela `profiles` | guarda `full_name`, `avatar_url`, `instagram` do usuário |
| Trigger em `auth.users` | cria a linha em `profiles` automaticamente quando alguém se cadastra |
| Bucket `avatars` (público) | armazena a foto de perfil em `{user_id}/avatar.jpg` |
| RLS | cada usuário só lê/edita o próprio perfil e a própria pasta de avatar |

O caminho do arquivo de avatar é **`{user_id}/avatar.jpg`** (a 1ª pasta = `auth.uid()`), e é isso que as policies de storage validam. Não mude esse padrão sem ajustar as policies.

---

## SQL — cole no SQL Editor do Supabase (ou salve como migration)

```sql
-- ═══════════════════════════════════════════════════════════════
-- 1) TABELA profiles
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  avatar_url  TEXT,
  instagram   TEXT,                                  -- @ do Instagram (sem o "@")
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Cada usuário só enxerga/edita o próprio perfil
CREATE POLICY "Users can view own profile"   ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- 2) TRIGGER: cria profile automático no cadastro
--    (copia full_name do metadata que o signUp mandou)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════
-- 3) TRIGGER: mantém updated_at
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 4) STORAGE: bucket avatars (público) + policies por dono
-- ═══════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- leitura pública (avatar aparece pra todo mundo)
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- só o dono escreve/atualiza/apaga na própria pasta {user_id}/
CREATE POLICY "avatars_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING      (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
```

> Obs.: o app comprime o avatar pra ~400px JPEG antes de subir, então 2 MB de limite sobra. Se quiser aceitar imagens maiores, aumente o `file_size_limit`.

---

## Variáveis de ambiente (.env do projeto)

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA-ANON-KEY
```

(São lidas em `src/integrations/supabase/client.ts`.)

---

## Trocar o mock pelo Supabase real

1. Confirme que o SQL acima rodou e o `.env` está preenchido.
2. Apague `src/contexts/AuthContext.tsx` (o mock).
3. Renomeie `src/contexts/AuthContext.supabase.tsx` → `src/contexts/AuthContext.tsx`.
4. Garanta que o usuário chega logado nessa tela (fluxo de login do seu app).

**A tela de Perfil (`Profile.tsx`) NÃO muda** — ela só consome a interface `useAuth()` / `usePlan()`, que é a mesma nos dois contextos.

### Contrato que a tela espera (não mude os nomes)

```ts
useAuth() => {
  user:    { id: string; email: string } | null
  profile: { full_name: string|null; avatar_url: string|null; instagram: string|null } | null
  isExpert: boolean                          // mostra/oculta a linha "Admin"
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>
}

usePlan() => {
  plan: 'curso' | 'app' | 'expert'
  hasFullAccess: boolean                      // true = card de plano lime, sem botão Upgrade
}
```
