import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Library as LibraryIcon, Copy, Check,
  Pencil, Trash2, X, Save, BookOpen,
} from 'lucide-react';
import { supabase, SUPABASE_READY } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

/* ─────────────────────────────────────────────
   TEXTOS DA TELA (toda a "escrita" daqui)
───────────────────────────────────────────── */
const TXT = {
  back: 'Voltar',
  title: 'Biblioteca',
  subtitle: 'Todos os roteiros salvos, agrupados por modelo',
  empty: 'Biblioteca vazia',
  empty_desc: 'Gere um roteiro em algum modelo viral e toque em Salvar pra guardar aqui.',
  saved_one: 'salvo',
  saved_many: 'salvos',
  model_empty: 'Nenhum roteiro salvo nesse modelo ainda.',
  save_title: 'Salvar título',
  cancel: 'Cancelar',
  copied: 'Copiado',
  copy: 'Copiar',
  rename: 'Renomear',
  delete: 'Excluir',
  briefing: 'Seu briefing',
  ai_response: 'Resposta da IA',
  edit: 'Editar',
  save: 'Salvar',
  toast_error: 'Erro',
  toast_title_updated: 'Título atualizado',
  toast_delete_error: 'Erro ao deletar',
  toast_removed: 'Removido da biblioteca',
  toast_updated: 'Roteiro atualizado',
};

interface SavedItem {
  id: string;
  model_slug: string;
  model_name: string;
  title: string;
  user_input: string;
  ai_response: string;
  created_at: string;
}

const renderBold = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-bold text-[#BE0D3E]">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );

const formatDate = (ts: string) => {
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/* ─────────────────────────────────────────────
   LISTA DE MODELOS (com contagens)
───────────────────────────────────────────── */
const ModelsOverview: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [groups, setGroups] = useState<{ slug: string; name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    // Sem Supabase configurado ainda → biblioteca vazia (sem chamada de rede)
    if (!SUPABASE_READY) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('saved_viral_outputs')
      .select('model_slug, model_name')
      .eq('user_id', user.id);

    if (data) {
      const map = new Map<string, { name: string; count: number }>();
      for (const row of data) {
        const existing = map.get(row.model_slug);
        map.set(row.model_slug, {
          name: row.model_name,
          count: (existing?.count ?? 0) + 1,
        });
      }
      const list = Array.from(map.entries()).map(([slug, v]) => ({ slug, name: v.name, count: v.count }));
      list.sort((a, b) => b.count - a.count);
      setGroups(list);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="pb-28 pt-1">
      <div className="pl-2 pr-4 pt-3 mb-4 flex items-center gap-0.5">
        <button
          onClick={() => navigate('/chat')}
          className="w-7 h-9 -ml-1 flex items-center justify-start text-[#5B4041]"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          aria-label={TXT.back}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h2 className="mb-2 flex items-center gap-2">
            <LibraryIcon size={20} className="text-[#BE0D3E] shrink-0" />
            <span className="text-[26px] leading-none font-black text-transparent bg-clip-text bg-gradient-to-r from-[#BE0D3E] to-[#E06B85] tracking-tighter">
              {TXT.title}
            </span>
          </h2>
          <p className="text-[#5B4041] text-[11px] font-light tracking-[0.15em] uppercase opacity-80 leading-tight">{TXT.subtitle}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-[#BE0D3E]" />
        </div>
      ) : groups.length === 0 ? (
        <div className="mx-4 bg-white border border-[#BE0D3E]/20 rounded-2xl p-6 text-center">
          <BookOpen size={28} className="text-[#BE0D3E]/50 mx-auto mb-2" />
          <p className="text-[#1E1B11] font-bold text-[13px] mb-1">{TXT.empty}</p>
          <p className="text-[#5B4041] text-[11px] leading-tight">
            {TXT.empty_desc}
          </p>
        </div>
      ) : (
        <div className="px-4 grid grid-cols-2 gap-3">
          {groups.map(g => (
            <button
              key={g.slug}
              onClick={() => navigate(`/biblioteca/${g.slug}`)}
              className="bg-white border border-[#BE0D3E]/15 rounded-2xl p-4 text-left shadow-[0_6px_18px_rgba(190,13,62,0.08)] hover:border-[#BE0D3E]/40 active:scale-[0.98] transition-all"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <p className="text-[13px] font-black text-[#1E1B11] leading-tight mb-2 line-clamp-2 min-h-[32px]">{g.name}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-[28px] font-black text-[#BE0D3E] leading-none">{g.count}</span>
                <span className="text-[10px] text-[#5B4041]">{g.count === 1 ? TXT.saved_one : TXT.saved_many}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   LISTA DE ITENS DE UM MODELO
───────────────────────────────────────────── */
const ModelItems: React.FC<{ modelSlug: string }> = ({ modelSlug }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingContent, setEditingContent] = useState(false);
  const [contentDraft, setContentDraft] = useState('');
  const [savingContent, setSavingContent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    // Sem Supabase configurado ainda → lista vazia (sem chamada de rede)
    if (!SUPABASE_READY) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('saved_viral_outputs')
      .select('*')
      .eq('user_id', user.id)
      .eq('model_slug', modelSlug)
      .order('created_at', { ascending: false });
    if (data) setItems(data as SavedItem[]);
    setLoading(false);
  }, [user, modelSlug]);

  useEffect(() => { load(); }, [load]);

  const openItem = items.find(i => i.id === openItemId);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSaveTitle = async () => {
    if (!openItemId || !titleDraft.trim()) return;
    const { error } = await supabase
      .from('saved_viral_outputs')
      .update({ title: titleDraft.trim() })
      .eq('id', openItemId);
    if (error) {
      toast({ title: TXT.toast_error, description: error.message, variant: 'destructive' });
      return;
    }
    setItems(prev => prev.map(i => i.id === openItemId ? { ...i, title: titleDraft.trim() } : i));
    setEditingTitle(false);
    toast({ title: TXT.toast_title_updated });
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase
      .from('saved_viral_outputs')
      .delete()
      .eq('id', id);
    setDeletingId(null);
    if (error) {
      toast({ title: TXT.toast_delete_error, description: error.message, variant: 'destructive' });
      return;
    }
    setItems(prev => prev.filter(i => i.id !== id));
    setOpenItemId(null);
    toast({ title: TXT.toast_removed });
  };

  const handleSaveContent = async () => {
    if (!openItemId || !contentDraft.trim()) return;
    setSavingContent(true);
    const { error } = await supabase
      .from('saved_viral_outputs')
      .update({ ai_response: contentDraft })
      .eq('id', openItemId);
    setSavingContent(false);
    if (error) {
      toast({ title: TXT.toast_error, description: error.message, variant: 'destructive' });
      return;
    }
    setItems(prev => prev.map(i => i.id === openItemId ? { ...i, ai_response: contentDraft } : i));
    setEditingContent(false);
    toast({ title: TXT.toast_updated });
  };

  /* No app original havia um botão "Mandar pro Kanban" aqui, que criava um
   * roteiro no quadro Kanban. Quando/se este app tiver Kanban, é só recolocar
   * o botão nas ações do modal chamando a sua integração. */

  // Enquanto os itens carregam, usa o nome derivado do slug (ex: "ganchos-virais"
  // -> "Ganchos Virais") em vez de cair em "Biblioteca" — evita o flash do titulo
  // errado nos primeiros segundos.
  const prettySlug = modelSlug
    ? modelSlug.replace(/-/g, ' ').replace(/(^|\s)\S/g, c => c.toUpperCase())
    : TXT.title;
  const modelName = items[0]?.model_name ?? prettySlug;

  return (
    <div className="pb-28 pt-1">
      <div className="pl-2 pr-4 pt-3 mb-4 flex items-center gap-1">
        <button
          onClick={() => navigate('/biblioteca')}
          className="w-7 h-9 -ml-1 shrink-0 flex items-center justify-start text-[#5B4041]"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          aria-label={TXT.back}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[#5B4041] text-[9px] font-black uppercase tracking-[0.15em] opacity-70 mb-1">{TXT.title}</p>
          <h2 className="text-[22px] leading-none font-black text-transparent bg-clip-text bg-gradient-to-r from-[#BE0D3E] to-[#E06B85] tracking-tighter truncate">{modelName}</h2>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-[#BE0D3E]" />
        </div>
      ) : items.length === 0 ? (
        <div className="mx-4 bg-white border border-[#BE0D3E]/20 rounded-2xl p-6 text-center">
          <p className="text-[#5B4041] text-[11px]">{TXT.model_empty}</p>
        </div>
      ) : (
        <div className="px-4 space-y-2">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setOpenItemId(item.id);
                setEditingTitle(false);
                setTitleDraft(item.title);
              }}
              className="w-full bg-white border border-[#BE0D3E]/15 rounded-2xl p-4 text-left shadow-[0_4px_12px_rgba(190,13,62,0.06)] hover:border-[#BE0D3E]/40 active:scale-[0.99] transition-all"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <p className="text-[13px] font-black text-[#1E1B11] leading-tight mb-1.5 line-clamp-2">{item.title}</p>
              <p className="text-[10px] text-[#5B4041]/70 line-clamp-2 mb-2">{item.ai_response.slice(0, 150)}…</p>
              <p className="text-[9px] text-[#5B4041]/50">{formatDate(item.created_at)}</p>
            </button>
          ))}
        </div>
      )}

      {/* Modal de item aberto */}
      {openItem && (
        <div
          className="fixed inset-0 z-[100] bg-[#1E1B11]/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setOpenItemId(null)}
        >
          <div
            className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-[0_-8px_40px_rgba(0,0,0,0.2)]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="shrink-0 px-5 pt-5 pb-3 border-b border-[#BE0D3E]/10">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  {editingTitle ? (
                    <input
                      type="text"
                      value={titleDraft}
                      onChange={e => setTitleDraft(e.target.value.slice(0, 120))}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); }}
                      className="w-full bg-[#FFF7E6] border-2 border-[#BE0D3E]/30 focus:border-[#BE0D3E] rounded-lg px-2 py-1.5 text-[14px] font-black text-[#1E1B11] outline-none"
                      autoFocus
                    />
                  ) : (
                    <h3 className="text-[16px] font-black text-[#1E1B11] leading-tight">{openItem.title}</h3>
                  )}
                  <p className="text-[10px] text-[#5B4041]/70 mt-1">
                    {openItem.model_name} · {formatDate(openItem.created_at)}
                  </p>
                </div>

                <button
                  onClick={() => setOpenItemId(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#FFF7E6] text-[#5B4041]"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {editingTitle ? (
                  <>
                    <button
                      onClick={handleSaveTitle}
                      className="flex items-center gap-1 bg-[#BE0D3E] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <Save size={11} /> {TXT.save_title}
                    </button>
                    <button
                      onClick={() => { setEditingTitle(false); setTitleDraft(openItem.title); }}
                      className="text-[10px] text-[#5B4041] font-bold uppercase tracking-widest px-2 py-1.5"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      {TXT.cancel}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleCopy(openItem.ai_response)}
                      className="flex items-center gap-1 bg-white border border-[#BE0D3E]/30 text-[#BE0D3E] text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      {copied ? <><Check size={11} /> {TXT.copied}</> : <><Copy size={11} /> {TXT.copy}</>}
                    </button>
                    <button
                      onClick={() => setEditingTitle(true)}
                      className="flex items-center gap-1 bg-white border border-[#5B4041]/25 text-[#5B4041] text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <Pencil size={11} /> {TXT.rename}
                    </button>
                    <button
                      onClick={() => handleDelete(openItem.id)}
                      disabled={deletingId === openItem.id}
                      className="flex items-center gap-1 bg-white border border-red-400/40 text-red-500 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg ml-auto disabled:opacity-50"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      {deletingId === openItem.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} {TXT.delete}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Body scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <p className="text-[9px] font-black text-[#5B4041] uppercase tracking-widest mb-1.5">{TXT.briefing}</p>
                <div className="bg-[#FFF7E6] border border-[#BE0D3E]/15 rounded-xl p-3">
                  <p className="text-[12px] text-[#1E1B11] leading-relaxed whitespace-pre-wrap">{openItem.user_input}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[9px] font-black text-[#5B4041] uppercase tracking-widest">{TXT.ai_response}</p>
                  {!editingContent ? (
                    <button
                      onClick={() => { setEditingContent(true); setContentDraft(openItem.ai_response); }}
                      className="flex items-center gap-1 text-[10px] font-bold text-[#BE0D3E] uppercase tracking-widest"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <Pencil size={10} /> {TXT.edit}
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveContent}
                        disabled={savingContent || !contentDraft.trim()}
                        className="flex items-center gap-1 bg-[#BE0D3E] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg disabled:opacity-50"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        {savingContent ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} {TXT.save}
                      </button>
                      <button
                        onClick={() => { setEditingContent(false); setContentDraft(''); }}
                        className="text-[10px] text-[#5B4041] font-bold uppercase tracking-widest px-2 py-1"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        {TXT.cancel}
                      </button>
                    </div>
                  )}
                </div>
                {editingContent ? (
                  <textarea
                    value={contentDraft}
                    onChange={e => setContentDraft(e.target.value)}
                    className="w-full bg-white border-2 border-[#BE0D3E]/30 focus:border-[#BE0D3E] rounded-xl p-3 text-[12px] text-[#1E1B11] leading-relaxed outline-none min-h-[240px] resize-y"
                    autoFocus
                  />
                ) : (
                  <div className="bg-white border border-[#BE0D3E]/15 rounded-xl p-3">
                    <p className="text-[12px] text-[#1E1B11] leading-relaxed whitespace-pre-wrap">{renderBold(openItem.ai_response)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   ROUTER
───────────────────────────────────────────── */
const Biblioteca: React.FC = () => {
  const { modelSlug } = useParams<{ modelSlug?: string }>();
  if (modelSlug) return <ModelItems modelSlug={modelSlug} />;
  return <ModelsOverview />;
};

export default Biblioteca;
