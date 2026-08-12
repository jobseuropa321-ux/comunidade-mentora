import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/* ─────────────────────────────────────────────────────────────
   Camada de dados dos CURSOS (área de membros) — lê do Supabase.
   Tabelas: modules → lessons → lesson_materials + lesson_progress.
   A interface pública dos hooks é a MESMA de antes (mock), então as
   telas Home / ModuleDetail / AulaDetail / Admin não mudam.
   Segurança real = RLS (membro vê publicado; expert vê/escreve tudo).
   ───────────────────────────────────────────────────────────── */

export interface Module {
  id: string;
  slug: string;
  title1: string;
  title2: string;
  tag: string | null;
  tag_color: string | null;
  descricao: string;
  instructor: string;
  duracao: string;
  nivel: string;
  cor_acento: string;
  cor_fundo: string;
  position: number;
  is_published: boolean;
  cover_url: string | null;
  /** Capa em espanhol. Opcional de propósito: a coluna ainda não existe no
   *  banco de produção (a migration está escrita, não aplicada), então as
   *  queries com select('*') simplesmente não trazem o campo e o app cai no
   *  cover_url normal. */
  cover_url_es?: string | null;
  material_url: string | null;
  home_section: 'inicio' | 'modulos' | 'materiais' | null;
  created_at?: string;
  updated_at?: string;
}

export interface Lesson {
  id: string;
  module_id: string;
  titulo: string;
  duracao: string;
  descricao: string | null;
  conteudo: string | null;
  video_url: string | null;
  position: number;
  created_at?: string;
  updated_at?: string;
}

export interface LessonMaterial {
  id: string;
  lesson_id: string;
  nome: string;
  tipo: 'pdf' | 'video' | 'planilha' | 'checklist';
  tamanho: string;
  url: string | null;
  position: number;
  created_at?: string;
}

export interface ModuleWithLessons extends Module {
  lessons: Lesson[];
}

export interface LessonWithMaterials extends Lesson {
  materials: LessonMaterial[];
}

/* ── Paleta de gradientes dos módulos ──
   Os valores de `cor_fundo` são classes Tailwind arbitrárias
   (`from-[#..] to-[#..]`). Pra o JIT gerá-las mesmo vindas do banco,
   elas precisam existir como texto literal em algum arquivo escaneado.
   O admin (`Admin.tsx`) exporta MODULE_GRADIENTS com esses literais —
   é lá que ficam listadas. Escolha sempre um gradiente da lista no admin. */

/** Lista enxuta de todos os módulos (sem aulas). Usado em Home/Admin. */
export function useAllModules(includeUnpublished = false) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      let q = supabase.from('modules').select('*').order('position', { ascending: true });
      if (!includeUnpublished) q = q.eq('is_published', true);
      const { data, error } = await q;
      if (cancel) return;
      if (!error && data) setModules(data as Module[]);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [includeUnpublished, version]);

  const reload = useCallback(() => setVersion(v => v + 1), []);
  return { modules, loading, reload };
}

/** Módulo + suas aulas, por slug. Usado em ModuleDetail. */
export function useModuleBySlug(slug: string | undefined) {
  const [data, setData] = useState<ModuleWithLessons | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data: mod } = await supabase.from('modules').select('*').eq('slug', slug).maybeSingle();
      if (cancel) return;
      if (!mod) { setData(null); setLoading(false); return; }
      const { data: lessons } = await supabase
        .from('lessons')
        .select('*')
        .eq('module_id', (mod as Module).id)
        .order('position', { ascending: true });
      if (cancel) return;
      setData({ ...(mod as Module), lessons: (lessons ?? []) as Lesson[] });
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [slug]);

  return { data, loading };
}

/** Progresso de aulas: Set de lesson_ids concluídos pelo user atual (filtrado). */
export function useLessonProgress(lessonIds: string[]) {
  const { user } = useAuth();
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const lessonIdsKey = useMemo(() => lessonIds.slice().sort().join(','), [lessonIds]);

  useEffect(() => {
    if (!user || lessonIds.length === 0) {
      setCompleted(new Set());
      setLoading(false);
      return;
    }
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('lesson_progress')
        .select('lesson_id')
        .eq('user_id', user.id)
        .in('lesson_id', lessonIds);
      if (cancel) return;
      setCompleted(new Set((data ?? []).map((r: { lesson_id: string }) => r.lesson_id)));
      setLoading(false);
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, lessonIdsKey]);

  const toggle = useCallback(async (lessonId: string, done: boolean) => {
    if (!user) return;
    setCompleted(prev => {
      const next = new Set(prev);
      if (done) next.add(lessonId); else next.delete(lessonId);
      return next;
    });
    if (done) {
      const { error } = await supabase.from('lesson_progress').insert({ user_id: user.id, lesson_id: lessonId });
      if (error && error.code !== '23505') {
        setCompleted(prev => { const n = new Set(prev); n.delete(lessonId); return n; });
      }
    } else {
      const { error } = await supabase.from('lesson_progress').delete().eq('user_id', user.id).eq('lesson_id', lessonId);
      if (error) {
        setCompleted(prev => { const n = new Set(prev); n.add(lessonId); return n; });
      }
    }
  }, [user]);

  return { completed, toggle, loading };
}

/** Aula completa + módulo + aulas irmãs + materiais. Usado em AulaDetail. */
export function useLesson(moduleSlug: string | undefined, lessonIndex: number | undefined) {
  const [data, setData] = useState<{ module: Module; lessons: Lesson[]; lesson: LessonWithMaterials } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!moduleSlug || lessonIndex === undefined) { setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data: mod } = await supabase.from('modules').select('*').eq('slug', moduleSlug).maybeSingle();
      if (cancel || !mod) { setData(null); setLoading(false); return; }
      const { data: lessons } = await supabase
        .from('lessons')
        .select('*')
        .eq('module_id', (mod as Module).id)
        .order('position', { ascending: true });
      if (cancel || !lessons || lessons.length === 0) { setData(null); setLoading(false); return; }
      const lesson = (lessons as Lesson[])[lessonIndex];
      if (!lesson) { setData(null); setLoading(false); return; }
      const { data: materials } = await supabase
        .from('lesson_materials')
        .select('*')
        .eq('lesson_id', lesson.id)
        .order('position', { ascending: true });
      if (cancel) return;
      setData({
        module: mod as Module,
        lessons: lessons as Lesson[],
        lesson: { ...lesson, materials: (materials ?? []) as LessonMaterial[] },
      });
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [moduleSlug, lessonIndex]);

  return { data, loading };
}
