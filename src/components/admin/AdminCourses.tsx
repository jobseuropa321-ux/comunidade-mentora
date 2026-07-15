import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Plus, ArrowLeft, ArrowUp, ArrowDown, Pencil, Trash2, Save, Eye, EyeOff,
  Loader2, Video, FileText, BookOpen, CheckSquare, ExternalLink, Upload, X,
} from 'lucide-react';
import type { Module, Lesson, LessonMaterial } from '@/hooks/useCourses';

/* ══════════════════════════════════════════════════════════════
   ADMIN · CURSOS — módulos → aulas → materiais (escreve no Supabase).
   Segurança real = RLS (policies expert_all_*). O frontend é "burro".
   Vídeo = URL de embed colada (YouTube/Panda/etc), não upload.
   Capas → bucket module-covers · materiais → bucket course-materials.
   ══════════════════════════════════════════════════════════════ */

type View = 'list' | 'module' | 'lesson';

const TIPO_OPCOES = ['pdf', 'video', 'planilha', 'checklist'] as const;
const TIPO_ICON: Record<string, React.ReactNode> = {
  pdf: <FileText size={12} />, video: <Video size={12} />, planilha: <BookOpen size={12} />, checklist: <CheckSquare size={12} />,
};

/* Gradientes preset — os literais precisam existir aqui pro Tailwind JIT
   gerar as classes `from-[#..] to-[#..]` (o valor vem do banco em runtime). */
const MODULE_GRADIENTS: { label: string; value: string }[] = [
  { label: 'Vermelho',   value: 'from-[#BE0D3E] to-[#94002D]' },
  { label: 'Rosé',       value: 'from-[#BE0D3E] to-[#E06B85]' },
  { label: 'Vinho',      value: 'from-[#7C0026] to-[#BE0D3E]' },
  { label: 'Pôr do sol', value: 'from-[#BE0D3E] to-[#F6B43A]' },
  { label: 'Laranja',    value: 'from-[#E09A1F] to-[#F6B43A]' },
  { label: 'Suave',      value: 'from-[#E06B85] to-[#ECA6BB]' },
];

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/* ── Helpers de form (elementos nativos, estilo da marca) ── */
const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; hint?: string }> = ({ label, value, onChange, hint }) => (
  <div>
    <label className="text-[10px] font-black uppercase tracking-widest text-[#5B4041]">{label}</label>
    <input value={value} onChange={e => onChange(e.target.value)}
      className="mt-1 w-full bg-[#FFF7E6] border border-[#BE0D3E]/15 text-[#1E1B11] text-[12px] rounded-xl px-3 py-2 focus:border-[#BE0D3E]/50 focus:outline-none transition-colors" />
    {hint && <p className="text-[9px] text-[#5B4041]/60 mt-0.5">{hint}</p>}
  </div>
);
const FieldArea: React.FC<{ label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }> = ({ label, value, onChange, rows = 3, hint }) => (
  <div>
    <label className="text-[10px] font-black uppercase tracking-widest text-[#5B4041]">{label}</label>
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
      className="mt-1 w-full bg-[#FFF7E6] border border-[#BE0D3E]/15 text-[#1E1B11] text-[12px] rounded-xl px-3 py-2 resize-none focus:border-[#BE0D3E]/50 focus:outline-none transition-colors" />
    {hint && <p className="text-[9px] text-[#5B4041]/60 mt-0.5">{hint}</p>}
  </div>
);

/* ── Diálogo de confirmação (excluir) ── */
const Confirm: React.FC<{ title: string; desc: string; onCancel: () => void; onConfirm: () => void }> = ({ title, desc, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-[110] bg-[#1E1B11]/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
    <div className="bg-white rounded-2xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
      <h3 className="text-[15px] font-black text-[#1E1B11] mb-1">{title}</h3>
      <p className="text-[12px] text-[#5B4041] leading-relaxed mb-4">{desc}</p>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-[#F6D6DC] text-[#5B4041]">Cancelar</button>
        <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 transition-colors">Excluir</button>
      </div>
    </div>
  </div>
);

const primaryBtn = 'w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-[#BE0D3E] to-[#E06B85] text-white text-[11px] font-black uppercase tracking-widest py-3 rounded-xl shadow-[0_6px_18px_rgba(190,13,62,0.35)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100 transition-transform';
const accentBtn = 'flex items-center gap-1 bg-[#F6B43A] text-[#1E1B11] text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg hover:brightness-105 active:scale-95 transition-all';

/* ══════════════════════════════════════════════════════════════ */
const AdminCourses: React.FC = () => {
  const [view, setView] = useState<View>('list');
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  return (
    <div>
      {view === 'list' && (
        <ModuleList onEdit={(m) => { setSelectedModule(m); setView('module'); }} />
      )}
      {view === 'module' && selectedModule && (
        <ModuleEditor
          module={selectedModule}
          onBack={() => { setSelectedModule(null); setView('list'); }}
          onEditLesson={(l) => { setSelectedLesson(l); setView('lesson'); }}
          onModuleChanged={(m) => setSelectedModule(m)}
        />
      )}
      {view === 'lesson' && selectedLesson && selectedModule && (
        <LessonEditor
          lesson={selectedLesson}
          moduleTitle={`${selectedModule.title1} ${selectedModule.title2}`}
          onBack={() => { setSelectedLesson(null); setView('module'); }}
          onLessonChanged={(l) => setSelectedLesson(l)}
        />
      )}
    </div>
  );
};

/* ── NÍVEL 1 · LISTA DE MÓDULOS ── */
const ModuleList: React.FC<{ onEdit: (m: Module) => void }> = ({ onEdit }) => {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Module | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('modules').select('*').order('position', { ascending: true });
    if (error) toast.error('Erro', { description: error.message });
    setModules((data ?? []) as Module[]);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const move = async (m: Module, dir: -1 | 1) => {
    const idx = modules.findIndex(x => x.id === m.id);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= modules.length) return;
    const target = modules[targetIdx];
    await supabase.from('modules').update({ position: target.position }).eq('id', m.id);
    await supabase.from('modules').update({ position: m.position }).eq('id', target.id);
    reload();
  };

  const togglePublished = async (m: Module) => {
    await supabase.from('modules').update({ is_published: !m.is_published }).eq('id', m.id);
    reload();
  };

  const createNew = async () => {
    setCreating(true);
    const maxPos = modules.length ? Math.max(...modules.map(x => x.position)) : -1;
    const { data, error } = await supabase.from('modules').insert({
      slug: `modulo-${Date.now()}`,
      title1: 'NOVO', title2: 'MÓDULO',
      descricao: 'Adicione uma descrição.',
      instructor: 'Equipe Amentora',
      duracao: 'A definir', nivel: 'Iniciante',
      cor_acento: '#BE0D3E', cor_fundo: 'from-[#BE0D3E] to-[#E06B85]',
      position: maxPos + 1, is_published: false,
    }).select('*').single();
    setCreating(false);
    if (error || !data) { toast.error('Erro', { description: error?.message ?? 'Falha ao criar módulo' }); return; }
    onEdit(data as Module);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('modules').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    if (error) { toast.error('Erro', { description: error.message }); return; }
    toast.success('Módulo excluído');
    reload();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-[#BE0D3E] animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <button onClick={createNew} disabled={creating} className={primaryBtn}>
        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-3.5 h-3.5" strokeWidth={3} /> Novo módulo</>}
      </button>

      {modules.length === 0 && (
        <p className="text-center text-[12px] text-[#5B4041]/60 py-8">Nenhum módulo ainda. Clique em "Novo módulo" pra começar.</p>
      )}

      {modules.map((m, i) => (
        <div key={m.id} className="bg-white border border-[#BE0D3E]/15 rounded-2xl p-3 flex items-center gap-2">
          <div className="flex flex-col gap-1 shrink-0">
            <button onClick={() => move(m, -1)} disabled={i === 0} className="w-7 h-7 rounded-lg bg-[#F6D6DC] text-[#5B4041] flex items-center justify-center disabled:opacity-30 hover:brightness-95 transition-all"><ArrowUp size={12} /></button>
            <button onClick={() => move(m, 1)} disabled={i === modules.length - 1} className="w-7 h-7 rounded-lg bg-[#F6D6DC] text-[#5B4041] flex items-center justify-center disabled:opacity-30 hover:brightness-95 transition-all"><ArrowDown size={12} /></button>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-black text-[#1E1B11] truncate">{m.title1} {m.title2}</p>
            <p className="text-[10px] text-[#5B4041] truncate">/{m.slug} · {m.is_published ? 'Publicado' : 'Em breve'}</p>
          </div>
          <button onClick={() => togglePublished(m)} className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${m.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {m.is_published ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button onClick={() => onEdit(m)} className="w-8 h-8 rounded-lg bg-[#BE0D3E]/10 text-[#BE0D3E] flex items-center justify-center shrink-0 hover:bg-[#BE0D3E]/20 transition-colors"><Pencil size={13} /></button>
          <button onClick={() => setDeleteTarget(m)} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0 hover:bg-red-100 transition-colors"><Trash2 size={13} /></button>
        </div>
      ))}

      {deleteTarget && (
        <Confirm
          title="Excluir módulo?"
          desc={`"${deleteTarget.title1} ${deleteTarget.title2}" e todas as aulas/materiais serão excluídos. Não tem como desfazer.`}
          onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete}
        />
      )}
    </div>
  );
};

/* ── NÍVEL 2 · EDITOR DE MÓDULO ── */
const ModuleEditor: React.FC<{
  module: Module; onBack: () => void; onEditLesson: (l: Lesson) => void; onModuleChanged: (m: Module) => void;
}> = ({ module: mod, onBack, onEditLesson, onModuleChanged }) => {
  const [draft, setDraft] = useState<Module>(mod);
  const [saving, setSaving] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [deleteLessonTarget, setDeleteLessonTarget] = useState<Lesson | null>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => { setDraft(mod); }, [mod]);

  const reloadLessons = useCallback(async () => {
    setLoadingLessons(true);
    const { data } = await supabase.from('lessons').select('*').eq('module_id', mod.id).order('position', { ascending: true });
    setLessons((data ?? []) as Lesson[]);
    setLoadingLessons(false);
  }, [mod.id]);
  useEffect(() => { reloadLessons(); }, [reloadLessons]);

  const save = async () => {
    setSaving(true);
    const finalSlug = draft.slug || slugify(`${draft.title1}-${draft.title2}`);
    const { data, error } = await supabase.from('modules').update({
      slug: finalSlug, title1: draft.title1, title2: draft.title2, tag: draft.tag, tag_color: draft.tag_color,
      descricao: draft.descricao, instructor: draft.instructor, duracao: draft.duracao, nivel: draft.nivel,
      cor_acento: draft.cor_acento, cor_fundo: draft.cor_fundo, is_published: draft.is_published,
      home_section: draft.home_section, cover_url: draft.cover_url,
    }).eq('id', mod.id).select('*').single();
    setSaving(false);
    if (error) { toast.error('Erro', { description: error.message }); return; }
    if (data) onModuleChanged(data as Module);
    toast.success('Módulo salvo');
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem muito grande', { description: 'Máximo 5MB' }); e.target.value = ''; return; }
    setUploadingCover(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${mod.id}/cover-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('module-covers').upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('module-covers').getPublicUrl(path);
      setDraft(d => ({ ...d, cover_url: publicUrl }));
      toast.success('Capa enviada!', { description: 'Lembre de salvar o módulo.' });
    } catch (err) {
      toast.error('Erro', { description: err instanceof Error ? err.message : 'Falha no upload' });
    } finally { setUploadingCover(false); e.target.value = ''; }
  };

  const moveLesson = async (l: Lesson, dir: -1 | 1) => {
    const idx = lessons.findIndex(x => x.id === l.id);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= lessons.length) return;
    const target = lessons[targetIdx];
    await supabase.from('lessons').update({ position: target.position }).eq('id', l.id);
    await supabase.from('lessons').update({ position: l.position }).eq('id', target.id);
    reloadLessons();
  };

  const createLesson = async () => {
    const maxPos = lessons.length ? Math.max(...lessons.map(x => x.position)) : -1;
    const { data, error } = await supabase.from('lessons')
      .insert({ module_id: mod.id, titulo: 'Nova aula', duracao: '— min', position: maxPos + 1 }).select('*').single();
    if (error || !data) { toast.error('Erro', { description: error?.message ?? 'Falha ao criar aula' }); return; }
    onEditLesson(data as Lesson);
  };

  const deleteLesson = async () => {
    if (!deleteLessonTarget) return;
    const { error } = await supabase.from('lessons').delete().eq('id', deleteLessonTarget.id);
    setDeleteLessonTarget(null);
    if (error) { toast.error('Erro', { description: error.message }); return; }
    toast.success('Aula excluída');
    reloadLessons();
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[11px] font-bold text-[#5B4041] hover:text-[#1E1B11]"><ArrowLeft size={14} /> Voltar pra lista</button>

      <div className="bg-white border border-[#BE0D3E]/15 rounded-2xl p-4 space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#BE0D3E]">Dados do módulo</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Título linha 1" value={draft.title1} onChange={v => setDraft({ ...draft, title1: v })} />
          <Field label="Título linha 2" value={draft.title2} onChange={v => setDraft({ ...draft, title2: v })} />
        </div>
        <Field label="Slug (URL)" value={draft.slug} onChange={v => setDraft({ ...draft, slug: v })} hint="usado em /modulo/{slug}" />
        <FieldArea label="Descrição" value={draft.descricao} onChange={v => setDraft({ ...draft, descricao: v })} rows={3} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Instrutor(a)" value={draft.instructor} onChange={v => setDraft({ ...draft, instructor: v })} />
          <Field label="Duração" value={draft.duracao} onChange={v => setDraft({ ...draft, duracao: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nível" value={draft.nivel} onChange={v => setDraft({ ...draft, nivel: v })} hint="Iniciante | Intermediário | Avançado" />
          <Field label="Tag (opcional)" value={draft.tag ?? ''} onChange={v => setDraft({ ...draft, tag: v || null })} hint="ex: Em alta, Novo, Grátis" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Cor acento (hex)" value={draft.cor_acento} onChange={v => setDraft({ ...draft, cor_acento: v })} hint="ex: #BE0D3E" />
          <Field label="Cor da tag (hex)" value={draft.tag_color ?? ''} onChange={v => setDraft({ ...draft, tag_color: v || null })} />
        </div>

        {/* Gradiente de fundo (preset) */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-[#5B4041]">Gradiente do card</label>
          <div className="grid grid-cols-3 gap-1.5 mt-1.5">
            {MODULE_GRADIENTS.map(g => (
              <button key={g.value} type="button" onClick={() => setDraft({ ...draft, cor_fundo: g.value })}
                className={`relative h-10 rounded-lg overflow-hidden border-2 ${draft.cor_fundo === g.value ? 'border-[#1E1B11]' : 'border-transparent'}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${g.value}`} />
                <span className="relative text-[8px] font-black uppercase tracking-wider text-white drop-shadow">{g.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Capa */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-[#5B4041]">Capa do módulo</label>
          <input ref={coverFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverUpload} />
          {draft.cover_url ? (
            <div className="mt-1.5 relative rounded-xl overflow-hidden border border-[#BE0D3E]/15 max-w-[180px]" style={{ aspectRatio: '3/4' }}>
              <img src={draft.cover_url} alt="Capa" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
                <button onClick={() => coverFileRef.current?.click()} disabled={uploadingCover} className="bg-white text-[#BE0D3E] text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg flex items-center gap-1.5">
                  {uploadingCover ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Upload className="w-3 h-3" /> Trocar</>}
                </button>
                <button onClick={() => setDraft({ ...draft, cover_url: null })} className="bg-white/90 text-[#1E1B11] text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg">Remover</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => coverFileRef.current?.click()} disabled={uploadingCover}
              className="w-full mt-1.5 bg-[#FFF7E6] hover:bg-[#F6D6DC]/50 border border-dashed border-[#BE0D3E]/30 rounded-xl py-6 flex flex-col items-center justify-center gap-1.5 text-[#BE0D3E] disabled:opacity-60">
              {uploadingCover ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              <span className="text-[10px] font-black uppercase tracking-widest">{uploadingCover ? 'Enviando' : 'Subir capa'}</span>
              <span className="text-[9px] text-[#5B4041]">JPG, PNG ou WebP · até 5MB · 3:4</span>
            </button>
          )}
          <input value={draft.cover_url ?? ''} onChange={e => setDraft({ ...draft, cover_url: e.target.value || null })}
            placeholder="ou cole uma URL externa" className="mt-2 w-full bg-[#FFF7E6] border border-[#BE0D3E]/15 text-[#1E1B11] text-[11px] rounded-xl px-3 py-2 focus:border-[#BE0D3E]/50 focus:outline-none" />
        </div>

        {/* Seção da Home */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-[#5B4041]">Seção da Home</label>
          <div className="grid grid-cols-3 gap-1 mt-1.5">
            {([{ value: 'inicio', label: 'Comece por aqui' }, { value: 'modulos', label: 'Módulos' }, { value: null, label: 'Não exibir' }] as const).map(opt => (
              <button key={String(opt.value)} type="button" onClick={() => setDraft({ ...draft, home_section: opt.value })}
                className={`text-[9px] font-bold uppercase tracking-wider py-2 rounded-lg transition-colors ${draft.home_section === opt.value ? 'bg-[#BE0D3E] text-white' : 'bg-[#F6D6DC] text-[#5B4041]'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Publicado */}
        <div className="flex items-center justify-between bg-[#FFF7E6] rounded-xl p-3">
          <div>
            <p className="text-[11px] font-bold text-[#1E1B11]">{draft.is_published ? 'Publicado' : 'Em breve (oculto)'}</p>
            <p className="text-[9px] text-[#5B4041]">Quando desligado, as alunas não veem este módulo.</p>
          </div>
          <button type="button" onClick={() => setDraft({ ...draft, is_published: !draft.is_published })}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${draft.is_published ? 'bg-[#BE0D3E]' : 'bg-[#5B4041]/25'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${draft.is_published ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>

        <button onClick={save} disabled={saving} className={primaryBtn}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5" strokeWidth={3} /> Salvar módulo</>}
        </button>
      </div>

      {/* Aulas */}
      <div className="bg-white border border-[#BE0D3E]/15 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[#BE0D3E]">Aulas ({lessons.length})</h3>
          <button onClick={createLesson} className={accentBtn}><Plus className="w-3 h-3" strokeWidth={3} /> Nova aula</button>
        </div>
        {loadingLessons ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-[#BE0D3E] animate-spin" /></div>
        ) : lessons.length === 0 ? (
          <p className="text-center text-[11px] text-[#5B4041] py-4">Nenhuma aula. Clica em "Nova aula" pra começar.</p>
        ) : lessons.map((l, i) => (
          <div key={l.id} className="bg-[#FFF7E6] rounded-xl p-2.5 flex items-center gap-2">
            <div className="flex flex-col gap-0.5 shrink-0">
              <button onClick={() => moveLesson(l, -1)} disabled={i === 0} className="w-6 h-6 rounded bg-white text-[#5B4041] flex items-center justify-center disabled:opacity-30"><ArrowUp size={10} /></button>
              <button onClick={() => moveLesson(l, 1)} disabled={i === lessons.length - 1} className="w-6 h-6 rounded bg-white text-[#5B4041] flex items-center justify-center disabled:opacity-30"><ArrowDown size={10} /></button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-[#1E1B11] truncate">{i + 1}. {l.titulo}</p>
              <p className="text-[9px] text-[#5B4041] truncate">{l.duracao}{l.video_url ? ' · vídeo OK' : ' · sem vídeo'}</p>
            </div>
            <button onClick={() => onEditLesson(l)} className="w-7 h-7 rounded bg-[#BE0D3E]/10 text-[#BE0D3E] flex items-center justify-center shrink-0"><Pencil size={11} /></button>
            <button onClick={() => setDeleteLessonTarget(l)} className="w-7 h-7 rounded bg-red-50 text-red-500 flex items-center justify-center shrink-0"><Trash2 size={11} /></button>
          </div>
        ))}
      </div>

      {deleteLessonTarget && (
        <Confirm title="Excluir aula?" desc={`"${deleteLessonTarget.titulo}" e seus materiais serão excluídos.`}
          onCancel={() => setDeleteLessonTarget(null)} onConfirm={deleteLesson} />
      )}
    </div>
  );
};

/* ── NÍVEL 3 · EDITOR DE AULA ── */
const LessonEditor: React.FC<{
  lesson: Lesson; moduleTitle: string; onBack: () => void; onLessonChanged: (l: Lesson) => void;
}> = ({ lesson, moduleTitle, onBack, onLessonChanged }) => {
  const [draft, setDraft] = useState<Lesson>(lesson);
  const [saving, setSaving] = useState(false);
  const [materials, setMaterials] = useState<LessonMaterial[]>([]);
  const [loadingMats, setLoadingMats] = useState(true);
  const [editingMat, setEditingMat] = useState<LessonMaterial | null>(null);
  const [deleteMatTarget, setDeleteMatTarget] = useState<LessonMaterial | null>(null);

  useEffect(() => { setDraft(lesson); }, [lesson]);

  const reloadMats = useCallback(async () => {
    setLoadingMats(true);
    const { data } = await supabase.from('lesson_materials').select('*').eq('lesson_id', lesson.id).order('position', { ascending: true });
    setMaterials((data ?? []) as LessonMaterial[]);
    setLoadingMats(false);
  }, [lesson.id]);
  useEffect(() => { reloadMats(); }, [reloadMats]);

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.from('lessons').update({
      titulo: draft.titulo, duracao: draft.duracao, descricao: draft.descricao, conteudo: draft.conteudo, video_url: draft.video_url,
    }).eq('id', lesson.id).select('*').single();
    setSaving(false);
    if (error) { toast.error('Erro', { description: error.message }); return; }
    if (data) onLessonChanged(data as Lesson);
    toast.success('Aula salva');
  };

  const createMaterial = async () => {
    const maxPos = materials.length ? Math.max(...materials.map(x => x.position)) : -1;
    const { data, error } = await supabase.from('lesson_materials')
      .insert({ lesson_id: lesson.id, nome: 'Novo material', tipo: 'pdf', tamanho: '— KB', position: maxPos + 1 }).select('*').single();
    if (error || !data) { toast.error('Erro', { description: error?.message ?? '' }); return; }
    setEditingMat(data as LessonMaterial);
  };

  const moveMat = async (m: LessonMaterial, dir: -1 | 1) => {
    const idx = materials.findIndex(x => x.id === m.id);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= materials.length) return;
    const target = materials[targetIdx];
    await supabase.from('lesson_materials').update({ position: target.position }).eq('id', m.id);
    await supabase.from('lesson_materials').update({ position: m.position }).eq('id', target.id);
    reloadMats();
  };

  const deleteMaterial = async () => {
    if (!deleteMatTarget) return;
    await supabase.from('lesson_materials').delete().eq('id', deleteMatTarget.id);
    setDeleteMatTarget(null);
    toast.success('Material excluído');
    reloadMats();
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[11px] font-bold text-[#5B4041] hover:text-[#1E1B11]"><ArrowLeft size={14} /> Voltar pro módulo</button>
      <p className="text-[10px] font-black uppercase tracking-widest text-[#BE0D3E]">{moduleTitle}</p>

      <div className="bg-white border border-[#BE0D3E]/15 rounded-2xl p-4 space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#BE0D3E]">Dados da aula</h3>
        <Field label="Título" value={draft.titulo} onChange={v => setDraft({ ...draft, titulo: v })} />
        <Field label="Duração" value={draft.duracao} onChange={v => setDraft({ ...draft, duracao: v })} hint="ex: 6 min" />
        <FieldArea label="Descrição (curta)" value={draft.descricao ?? ''} onChange={v => setDraft({ ...draft, descricao: v || null })} rows={2} />
        <FieldArea label="Conteúdo / Resumo / Transcrição" value={draft.conteudo ?? ''} onChange={v => setDraft({ ...draft, conteudo: v || null })} rows={6} />

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-[#5B4041]">URL do vídeo (embed)</label>
          <input value={draft.video_url ?? ''} onChange={e => setDraft({ ...draft, video_url: e.target.value || null })}
            placeholder="cole a URL de embed (YouTube, Panda, Vimeo...)"
            className="mt-1 w-full bg-[#FFF7E6] border border-[#BE0D3E]/15 text-[#1E1B11] text-[12px] rounded-xl px-3 py-2 focus:border-[#BE0D3E]/50 focus:outline-none" />
          <p className="text-[9px] text-[#5B4041]/60 mt-0.5">É a URL de player que vai tocar no iframe da aula (não é upload de arquivo).</p>
        </div>

        {draft.video_url && (
          <div className="bg-[#FFF7E6] rounded-xl p-2 flex items-center gap-2">
            <Video className="w-3.5 h-3.5 text-[#BE0D3E] shrink-0" />
            <span className="text-[10px] text-[#5B4041] truncate flex-1">Vídeo definido · aparece no player da aula</span>
            <a href={draft.video_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#BE0D3E] font-bold flex items-center gap-1 shrink-0">Abrir <ExternalLink size={10} /></a>
          </div>
        )}

        <button onClick={save} disabled={saving} className={primaryBtn}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5" strokeWidth={3} /> Salvar aula</>}
        </button>
      </div>

      <div className="bg-white border border-[#BE0D3E]/15 rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[#BE0D3E]">Materiais ({materials.length})</h3>
          <button onClick={createMaterial} className={accentBtn}><Plus className="w-3 h-3" strokeWidth={3} /> Novo</button>
        </div>
        {loadingMats ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 text-[#BE0D3E] animate-spin" /></div>
        ) : materials.length === 0 ? (
          <p className="text-center text-[11px] text-[#5B4041] py-4">Nenhum material anexado.</p>
        ) : materials.map((m, i) => (
          <div key={m.id} className="bg-[#FFF7E6] rounded-xl p-2.5 flex items-center gap-2">
            <div className="flex flex-col gap-0.5 shrink-0">
              <button onClick={() => moveMat(m, -1)} disabled={i === 0} className="w-5 h-5 rounded bg-white text-[#5B4041] flex items-center justify-center disabled:opacity-30"><ArrowUp size={9} /></button>
              <button onClick={() => moveMat(m, 1)} disabled={i === materials.length - 1} className="w-5 h-5 rounded bg-white text-[#5B4041] flex items-center justify-center disabled:opacity-30"><ArrowDown size={9} /></button>
            </div>
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0 text-[#BE0D3E]">{TIPO_ICON[m.tipo]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-[#1E1B11] truncate">{m.nome}</p>
              <p className="text-[9px] text-[#5B4041] capitalize truncate">{m.tipo} · {m.tamanho}{m.url ? ' · link OK' : ' · sem link'}</p>
            </div>
            <button onClick={() => setEditingMat(m)} className="w-7 h-7 rounded bg-[#BE0D3E]/10 text-[#BE0D3E] flex items-center justify-center shrink-0"><Pencil size={11} /></button>
            <button onClick={() => setDeleteMatTarget(m)} className="w-7 h-7 rounded bg-red-50 text-red-500 flex items-center justify-center shrink-0"><Trash2 size={11} /></button>
          </div>
        ))}
      </div>

      {editingMat && <MaterialDialog material={editingMat} onClose={() => setEditingMat(null)} onSaved={() => { setEditingMat(null); reloadMats(); }} />}
      {deleteMatTarget && (
        <Confirm title="Excluir material?" desc={`"${deleteMatTarget.nome}" será excluído.`}
          onCancel={() => setDeleteMatTarget(null)} onConfirm={deleteMaterial} />
      )}
    </div>
  );
};

/* ── Diálogo de 1 material (upload pro bucket course-materials) ── */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const detectTipoFromMime = (mime: string): typeof TIPO_OPCOES[number] => {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') return 'planilha';
  return 'pdf';
};

const MaterialDialog: React.FC<{ material: LessonMaterial; onClose: () => void; onSaved: () => void }> = ({ material, onClose, onSaved }) => {
  const [draft, setDraft] = useState<LessonMaterial>(material);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error('Arquivo muito grande', { description: 'Máximo 25MB' }); e.target.value = ''; return; }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
      const path = `${material.lesson_id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from('course-materials').upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('course-materials').getPublicUrl(path);
      setDraft(d => ({
        ...d, url: publicUrl, tamanho: formatFileSize(file.size),
        tipo: d.tipo === 'pdf' && file.type !== 'application/pdf' ? detectTipoFromMime(file.type) : d.tipo,
        nome: d.nome === 'Novo material' ? file.name.replace(/\.[^.]+$/, '') : d.nome,
      }));
      toast.success('Arquivo enviado!', { description: `${file.name} (${formatFileSize(file.size)})` });
    } catch (err) {
      toast.error('Erro no upload', { description: err instanceof Error ? err.message : 'Falha no upload' });
    } finally { setUploading(false); e.target.value = ''; }
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('lesson_materials').update({ nome: draft.nome, tipo: draft.tipo, tamanho: draft.tamanho, url: draft.url }).eq('id', material.id);
    setSaving(false);
    if (error) { toast.error('Erro', { description: error.message }); return; }
    toast.success('Material salvo');
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[110] bg-[#1E1B11]/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-4 max-w-md w-full space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-black text-[#1E1B11]">Editar material</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#FFF7E6] text-[#5B4041] flex items-center justify-center"><X size={13} /></button>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-[#5B4041]">Arquivo</label>
          <input ref={fileInputRef} type="file"
            accept="application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
            className="hidden" onChange={handleUpload} />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="w-full mt-1.5 bg-[#FFF7E6] hover:bg-[#F6D6DC]/50 border border-dashed border-[#BE0D3E]/30 rounded-xl p-3 flex items-center justify-center gap-2 text-[11px] font-bold text-[#BE0D3E] disabled:opacity-60">
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : <><Upload className="w-3.5 h-3.5" /> {draft.url ? 'Substituir arquivo' : 'Subir arquivo'}</>}
          </button>
          <p className="text-[9px] text-[#5B4041]/60 mt-1">PDF, Excel, CSV, Word ou imagem · até 25MB</p>
        </div>

        <Field label="Nome" value={draft.nome} onChange={v => setDraft({ ...draft, nome: v })} />

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-[#5B4041]">Tipo</label>
          <div className="grid grid-cols-4 gap-1 mt-1.5">
            {TIPO_OPCOES.map(t => (
              <button key={t} type="button" onClick={() => setDraft({ ...draft, tipo: t })}
                className={`text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg transition-colors ${draft.tipo === t ? 'bg-[#BE0D3E] text-white' : 'bg-[#F6D6DC] text-[#5B4041]'}`}>{t}</button>
            ))}
          </div>
        </div>

        <Field label="Tamanho" value={draft.tamanho} onChange={v => setDraft({ ...draft, tamanho: v })} hint="auto-preenchido pelo upload" />

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-[#5B4041]">URL (link de download)</label>
          <input value={draft.url ?? ''} onChange={e => setDraft({ ...draft, url: e.target.value || null })}
            className="mt-1 w-full bg-[#FFF7E6] border border-[#BE0D3E]/15 text-[#1E1B11] text-[12px] rounded-xl px-3 py-2 focus:border-[#BE0D3E]/50 focus:outline-none" />
          <p className="text-[9px] text-[#5B4041]/60 mt-0.5">preenchido pelo upload, ou cole um link externo (Drive, Dropbox...)</p>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-[#F6D6DC] text-[#5B4041]">Cancelar</button>
          <button onClick={save} disabled={saving || uploading} className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-gradient-to-r from-[#BE0D3E] to-[#E06B85] text-white disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminCourses;
