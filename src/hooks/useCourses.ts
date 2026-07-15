import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  MODULES,
  LESSONS,
  MATERIALS,
  type Module,
  type Lesson,
  type LessonMaterial,
} from '@/data/mockCourses';

export type { Module, Lesson, LessonMaterial };

export interface ModuleWithLessons extends Module {
  lessons: Lesson[];
}

export interface LessonWithMaterials extends Lesson {
  materials: LessonMaterial[];
}

/*
  Camada de dados LOCAL. No app original estes hooks liam do Supabase via
  supabase.from(...).select(...). Aqui eles leem dos arrays em
  `data/mockCourses.ts`, mantendo EXATAMENTE a mesma interface pública
  ({ modules, loading } etc), então as telas não mudam. Um pequeno atraso
  simulado mantém os estados de loading visíveis (o "feel" continua igual).
*/

const FAKE_DELAY = 180;

function delay<T>(value: T, cancelRef: { cancel: boolean }): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!cancelRef.cancel) resolve(value);
    }, FAKE_DELAY);
  });
}

/* Paleta de rosa usada nos modulos (ver data/mockCourses.ts) — os
 * gradientes ficam como literais lá pra o Tailwind JIT gerar as classes. */

/** Lista enxuta de todos os modulos (sem aulas). Usado em Home/Admin. */
export function useAllModules(includeUnpublished = false) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const ref = { cancel: false };
    setLoading(true);
    const list = MODULES.filter((m) => includeUnpublished || m.is_published).sort(
      (a, b) => a.position - b.position
    );
    delay(list, ref).then((data) => {
      if (ref.cancel) return;
      setModules(data);
      setLoading(false);
    });
    return () => {
      ref.cancel = true;
    };
  }, [includeUnpublished, version]);

  const reload = () => setVersion((v) => v + 1);
  return { modules, loading, reload };
}

/** Modulo + suas aulas, por slug. Usado em ModuleDetail. */
export function useModuleBySlug(slug: string | undefined) {
  const [data, setData] = useState<ModuleWithLessons | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    const ref = { cancel: false };
    setLoading(true);
    const mod = MODULES.find((m) => m.slug === slug) ?? null;
    if (!mod) {
      delay(null, ref).then(() => {
        if (ref.cancel) return;
        setData(null);
        setLoading(false);
      });
      return () => {
        ref.cancel = true;
      };
    }
    const lessons = LESSONS.filter((l) => l.module_id === mod.id).sort(
      (a, b) => a.position - b.position
    );
    delay({ ...mod, lessons }, ref).then((result) => {
      if (ref.cancel) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      ref.cancel = true;
    };
  }, [slug]);

  return { data, loading };
}

const PROGRESS_KEY = 'dam_lesson_progress';

function readProgress(): Set<string> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeProgress(set: Set<string>) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

/** Progresso de aulas: retorna Set de lesson_ids concluidos pelo user atual,
 *  filtrado pelos lessonIds passados. Toggle marca/desmarca uma aula. */
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
    const all = readProgress();
    const filtered = new Set(lessonIds.filter((id) => all.has(id)));
    setCompleted(filtered);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, lessonIdsKey]);

  const toggle = useCallback(
    async (lessonId: string, done: boolean) => {
      if (!user) return;
      // Optimistic UI + persistência local
      setCompleted((prev) => {
        const next = new Set(prev);
        if (done) next.add(lessonId);
        else next.delete(lessonId);
        return next;
      });
      const all = readProgress();
      if (done) all.add(lessonId);
      else all.delete(lessonId);
      writeProgress(all);
    },
    [user]
  );

  return { completed, toggle, loading };
}

/** Aula completa + modulo + aulas irmas + materiais. Usado em AulaDetail. */
export function useLesson(moduleSlug: string | undefined, lessonIndex: number | undefined) {
  const [data, setData] = useState<{
    module: Module;
    lessons: Lesson[];
    lesson: LessonWithMaterials;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!moduleSlug || lessonIndex === undefined) {
      setLoading(false);
      return;
    }
    const ref = { cancel: false };
    setLoading(true);

    const mod = MODULES.find((m) => m.slug === moduleSlug);
    if (!mod) {
      delay(null, ref).then(() => {
        if (ref.cancel) return;
        setData(null);
        setLoading(false);
      });
      return () => {
        ref.cancel = true;
      };
    }
    const lessons = LESSONS.filter((l) => l.module_id === mod.id).sort(
      (a, b) => a.position - b.position
    );
    const lesson = lessons[lessonIndex];
    if (!lesson) {
      delay(null, ref).then(() => {
        if (ref.cancel) return;
        setData(null);
        setLoading(false);
      });
      return () => {
        ref.cancel = true;
      };
    }
    const materials = MATERIALS.filter((mat) => mat.lesson_id === lesson.id).sort(
      (a, b) => a.position - b.position
    );
    delay({ module: mod, lessons, lesson: { ...lesson, materials } }, ref).then((result) => {
      if (ref.cancel) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      ref.cancel = true;
    };
  }, [moduleSlug, lessonIndex]);

  return { data, loading };
}
