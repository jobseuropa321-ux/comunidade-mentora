import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useAdminLang } from '@/components/admin/AdminLang';
import { Loader2, Power, Save, ExternalLink, Plus, Pencil, Trash2, X, Video, Calendar, Eye, EyeOff } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   ADMIN · AO VIVO — a live (live_settings, uma linha por idioma, tempo real)
   + os replays (live_replays). Escreve direto no Supabase (RLS expert).
   Vídeo = URL colada (YouTube embeda / Meet abre nova aba no membro).
   ══════════════════════════════════════════════════════════════ */

/* ── A LIVE ──
   Uma linha por idioma: sem isso a transmissão em espanhol aparecia como
   "ao vivo agora" também para a aluna brasileira. O idioma vem do seletor
   do topo da administração. */
const AdminLive: React.FC = () => {
  const { user } = useAuth();
  const { adminLang: lang } = useAdminLang();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [streamUrl, setStreamUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [presenter, setPresenter] = useState('');
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase.from('live_settings').select('*').eq('lang', lang).maybeSingle();
      if (cancel) return;
      setStreamUrl(data?.stream_url ?? '');
      setTitle(data?.title ?? '');
      setDescription(data?.description ?? '');
      setPresenter(data?.presenter ?? '');
      setIsActive(data?.is_active ?? false);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [lang]);

  const validUrl = (() => {
    try {
      if (!streamUrl.trim()) return false;
      const u = new URL(streamUrl.trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch { return false; }
  })();

  const persist = async (overrides: Record<string, unknown> = {}) => {
    if (!user) return false;
    const payload = {
      stream_url: streamUrl.trim() || null,
      title: title.trim() || null,
      description: description.trim() || null,
      presenter: presenter.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
      ...overrides,
    };
    const { error } = await supabase.from('live_settings').update(payload).eq('lang', lang);
    if (error) { toast.error('Erro ao salvar', { description: error.message }); return false; }
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await persist();
    setSaving(false);
    if (ok) toast.success('Dados da live salvos');
  };

  const handleToggle = async () => {
    if (!isActive && !validUrl) {
      toast.error('Cole um link válido primeiro', { description: 'Precisa ter URL pra ativar.' });
      return;
    }
    setToggling(true);
    const next = !isActive;
    const ok = await persist({ is_active: next });
    setToggling(false);
    if (ok) {
      setIsActive(next);
      const versao = lang === 'es' ? 'espanhol' : 'português';
      toast.success(next ? `Live ativada no ${versao}` : `Live desativada no ${versao}`);
    }
  };

  const inputCls = 'w-full bg-[#FFF7E6] border border-[#BE0D3E]/15 text-[#1E1B11] text-[12px] rounded-xl px-3 py-2 focus:border-[#BE0D3E]/50 focus:outline-none transition-colors';
  const labelCls = 'text-[10px] font-black uppercase tracking-widest text-[#5B4041]';

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-[#BE0D3E] animate-spin" /></div>
      ) : (
      <>
      {/* Status atual */}
      <div className={`rounded-2xl p-4 border-2 ${isActive ? 'bg-gradient-to-br from-[#BE0D3E] to-[#E06B85] border-[#94002D] text-white' : 'bg-white border-[#BE0D3E]/15 text-[#1E1B11]'}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isActive && (
                <span className="relative flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-75" />
                  <span className="relative rounded-full w-2 h-2 bg-white" />
                </span>
              )}
              <span className="text-[10px] font-black uppercase tracking-widest">{isActive ? 'Ao vivo agora' : 'Inativa'}</span>
            </div>
            <p className={`text-[13px] font-bold truncate ${isActive ? 'text-white' : 'text-[#1E1B11]'}`}>{title || 'Sem título configurado'}</p>
          </div>
          <button onClick={handleToggle} disabled={toggling}
            className={`shrink-0 px-4 py-2.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all ${isActive ? 'bg-white text-[#BE0D3E]' : 'bg-[#1E1B11] text-white hover:bg-[#2A2620]'}`}
            style={{ WebkitTapHighlightColor: 'transparent' }}>
            {toggling ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />}
            {isActive ? 'Desativar' : 'Ativar'}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white border border-[#BE0D3E]/15 rounded-2xl p-4 space-y-3">
        <div>
          <label className={labelCls}>Link da live (YouTube ou Google Meet)</label>
          <div className="flex gap-2 mt-1.5">
            <input value={streamUrl} onChange={e => setStreamUrl(e.target.value)}
              placeholder="https://youtube.com/live/... ou https://meet.google.com/..." className={`flex-1 ${inputCls}`} />
            {validUrl && (
              <a href={streamUrl} target="_blank" rel="noopener noreferrer" title="Testar link"
                className="shrink-0 w-10 h-10 rounded-lg border border-[#BE0D3E]/20 flex items-center justify-center text-[#BE0D3E] hover:bg-[#FFF7E6] transition-colors">
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          {streamUrl.trim() && !validUrl && <p className="text-[10px] text-red-500 mt-1">URL inválida — precisa começar com http:// ou https://</p>}
        </div>
        <div>
          <label className={labelCls}>Título</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Estratégias de Reels para 2026" className={`mt-1.5 ${inputCls}`} />
        </div>
        <div>
          <label className={labelCls}>Descrição (opcional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Sobre o que é a aula..." className={`mt-1.5 resize-none ${inputCls}`} />
        </div>
        <div>
          <label className={labelCls}>Apresentador (opcional)</label>
          <input value={presenter} onChange={e => setPresenter(e.target.value)} placeholder="Ex: Equipe Amentora" className={`mt-1.5 ${inputCls}`} />
        </div>
        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#BE0D3E] to-[#E06B85] text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(190,13,62,0.3)] disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] transition-transform">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar dados da live
        </button>
      </div>

      <p className="text-[10px] text-[#5B4041] leading-relaxed px-1">
        Quando ativa, o ícone "Ao vivo" pisca vermelho na barra inferior (em tempo real) e a página Ao Vivo mostra a transmissão —
        só para as alunas da versão em {lang === 'es' ? 'espanhol' : 'português'}.
      </p>
      </>
      )}

      <div className="border-t border-[#BE0D3E]/15 my-6" />

      <AdminLiveReplays />
    </div>
  );
};

/* ── OS REPLAYS ── */
interface Replay {
  id: string; title: string; description: string | null; video_url: string;
  cover_url: string | null; duration_label: string | null; recorded_at: string | null;
  position: number; is_published: boolean;
}
interface DraftReplay {
  id?: string; title: string; description: string; video_url: string;
  cover_url: string; duration_label: string; recorded_at: string; is_published: boolean;
}
const EMPTY_DRAFT: DraftReplay = { title: '', description: '', video_url: '', cover_url: '', duration_label: '', recorded_at: '', is_published: true };

const AdminLiveReplays: React.FC = () => {
  const { adminLang: lang } = useAdminLang();
  const [items, setItems] = useState<Replay[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftReplay | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Replay | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('live_replays').select('*')
      .eq('lang', lang)
      .order('position', { ascending: false }).order('recorded_at', { ascending: false, nullsFirst: false });
    if (error) toast.error('Erro ao carregar replays', { description: error.message });
    else setItems((data ?? []) as Replay[]);
    setLoading(false);
  }, [lang]);
  // Troca de idioma no topo recarrega a lista: cada versão tem as suas gravações.
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const startNew = () => setDraft({ ...EMPTY_DRAFT });
  const startEdit = (r: Replay) => setDraft({
    id: r.id, title: r.title, description: r.description ?? '', video_url: r.video_url,
    cover_url: r.cover_url ?? '', duration_label: r.duration_label ?? '', recorded_at: r.recorded_at ?? '', is_published: r.is_published,
  });

  const handleSave = async () => {
    if (!draft) return;
    if (draft.title.trim().length < 2) { toast.error('Título obrigatório'); return; }
    if (!draft.video_url.trim()) { toast.error('Cole a URL do vídeo'); return; }
    setSaving(true);
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      video_url: draft.video_url.trim(),
      cover_url: draft.cover_url.trim() || null,
      duration_label: draft.duration_label.trim() || null,
      recorded_at: draft.recorded_at || null,
      is_published: draft.is_published,
      updated_at: new Date().toISOString(),
    };
    const { error } = draft.id
      ? await supabase.from('live_replays').update(payload).eq('id', draft.id)
      : await supabase.from('live_replays').insert({ ...payload, lang });
    setSaving(false);
    if (error) { toast.error('Erro ao salvar', { description: error.message }); return; }
    toast.success(draft.id ? 'Replay atualizado' : 'Replay adicionado');
    setDraft(null);
    fetchAll();
  };

  const togglePublished = async (r: Replay) => {
    const { error } = await supabase.from('live_replays').update({ is_published: !r.is_published, updated_at: new Date().toISOString() }).eq('id', r.id);
    if (error) { toast.error('Erro', { description: error.message }); return; }
    fetchAll();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from('live_replays').delete().eq('id', confirmDelete.id);
    if (error) { toast.error('Erro', { description: error.message }); return; }
    toast.success('Replay excluído');
    setConfirmDelete(null);
    fetchAll();
  };

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-[#BE0D3E] animate-spin" /></div>;

  const inputCls = 'w-full bg-[#FFF7E6] border border-[#BE0D3E]/15 text-[#1E1B11] text-[12px] rounded-xl px-3 py-2 focus:border-[#BE0D3E]/50 focus:outline-none transition-colors';
  const labelCls = 'text-[10px] font-black uppercase tracking-widest text-[#5B4041]';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-black text-[#1E1B11] uppercase tracking-widest">
          Replays em {lang === 'es' ? 'espanhol' : 'português'} ({items.length})
        </h3>
        {!draft && (
          <button onClick={startNew} className="flex items-center gap-1.5 bg-[#BE0D3E] text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg hover:bg-[#E06B85] transition-colors">
            <Plus size={12} /> Novo
          </button>
        )}
      </div>

      {draft && (
        <div className="bg-white border-2 border-[#BE0D3E]/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#BE0D3E]">{draft.id ? 'Editar replay' : 'Novo replay'}</p>
            <button onClick={() => setDraft(null)} className="w-7 h-7 rounded-full bg-[#FFF7E6] flex items-center justify-center hover:bg-[#F6D6DC]"><X size={14} /></button>
          </div>
          <div>
            <label className={labelCls}>URL do vídeo (YouTube ou embed)</label>
            <input value={draft.video_url} onChange={e => setDraft({ ...draft, video_url: e.target.value })}
              placeholder="https://youtube.com/watch?v=... ou embed" className={`mt-1.5 ${inputCls}`} />
          </div>
          <div>
            <label className={labelCls}>Título</label>
            <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Ex: Como achar o seu nicho viral" className={`mt-1.5 ${inputCls}`} />
          </div>
          <div>
            <label className={labelCls}>Descrição (opcional)</label>
            <textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} rows={2} className={`mt-1.5 resize-none ${inputCls}`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Duração</label>
              <input value={draft.duration_label} onChange={e => setDraft({ ...draft, duration_label: e.target.value })} placeholder="58min" className={`mt-1.5 ${inputCls}`} />
            </div>
            <div>
              <label className={labelCls}>Data da live</label>
              <input type="date" value={draft.recorded_at} onChange={e => setDraft({ ...draft, recorded_at: e.target.value })} className={`mt-1.5 ${inputCls}`} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Capa (URL da imagem 3:4)</label>
            <input value={draft.cover_url} onChange={e => setDraft({ ...draft, cover_url: e.target.value })} placeholder="https://... (thumbnail)" className={`mt-1.5 ${inputCls}`} />
            {draft.cover_url && (
              <img src={draft.cover_url} alt="preview" className="mt-2 w-24 h-32 object-cover rounded-lg border border-[#BE0D3E]/20"
                onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
            )}
          </div>
          <label className="flex items-center gap-2 text-[11px] cursor-pointer">
            <input type="checkbox" checked={draft.is_published} onChange={e => setDraft({ ...draft, is_published: e.target.checked })} className="w-4 h-4 accent-[#BE0D3E]" />
            <span className="font-bold text-[#1E1B11]">Publicado (visível pra todas)</span>
          </label>
          <button onClick={handleSave} disabled={saving}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#BE0D3E] to-[#E06B85] text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} {draft.id ? 'Salvar alterações' : 'Adicionar replay'}
          </button>
        </div>
      )}

      {items.length === 0 && !draft && (
        <div className="bg-[#FFF7E6] border border-[#BE0D3E]/15 rounded-2xl p-6 text-center">
          <Video size={20} className="text-[#BE0D3E]/50 mx-auto mb-2" />
          <p className="text-[11px] text-[#5B4041]">Nenhum replay ainda. Clique em "Novo" pra adicionar.</p>
        </div>
      )}

      <div className="space-y-2">
        {items.map(r => (
          <div key={r.id} className={`bg-white border rounded-xl p-3 flex items-center gap-3 ${r.is_published ? 'border-[#BE0D3E]/15' : 'border-[#1E1B11]/10 opacity-60'}`}>
            <div className="shrink-0 w-12 h-16 rounded-lg overflow-hidden bg-[#FFF7E6] border border-[#BE0D3E]/10">
              {r.cover_url ? <img src={r.cover_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Video size={14} className="text-[#BE0D3E]/40" /></div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-black text-[#1E1B11] truncate">{r.title}</p>
              <div className="flex items-center gap-2 mt-0.5 text-[9px] text-[#5B4041]">
                {r.duration_label && <span>{r.duration_label}</span>}
                {r.recorded_at && (<><span>·</span><span className="flex items-center gap-1"><Calendar size={9} /> {new Date(r.recorded_at).toLocaleDateString('pt-BR')}</span></>)}
                {!r.is_published && (<><span>·</span><span className="font-black text-[#BE0D3E]/70 uppercase">rascunho</span></>)}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => togglePublished(r)} title={r.is_published ? 'Despublicar' : 'Publicar'} className="w-7 h-7 rounded-lg bg-[#FFF7E6] flex items-center justify-center hover:bg-[#F6D6DC] text-[#BE0D3E]">
                {r.is_published ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
              <button onClick={() => startEdit(r)} className="w-7 h-7 rounded-lg bg-[#FFF7E6] flex items-center justify-center hover:bg-[#F6D6DC] text-[#BE0D3E]"><Pencil size={12} /></button>
              <button onClick={() => setConfirmDelete(r)} className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 text-red-500"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[200] bg-[#1E1B11]/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h4 className="text-[14px] font-black text-[#1E1B11] mb-1">Excluir replay?</h4>
            <p className="text-[11px] text-[#5B4041] mb-4">"{confirmDelete.title}" será removido. Essa ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-lg bg-[#F6D6DC] text-[#5B4041] text-[11px] font-black uppercase tracking-widest">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-lg bg-red-500 text-white text-[11px] font-black uppercase tracking-widest">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLive;
