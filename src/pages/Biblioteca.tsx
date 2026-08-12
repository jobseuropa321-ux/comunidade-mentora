import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Library as LibraryIcon, Copy, Check,
  Pencil, Trash2, X, Save, BookOpen, Search, Clock3,
  ChevronRight, Layers3, Sparkles,
} from 'lucide-react';
import { supabase, SUPABASE_READY } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAgents } from '@/data/agents';
import { useTranslation } from 'react-i18next';
import { useLocalizedNavigate } from '@/i18n/LanguageProvider';
import { formatDateNumeric } from '@/lib/formatLocale';
import { useCurrentLang, type SupportedLang } from '@/i18n/LanguageProvider';

/* ─────────────────────────────────────────────
   TEXTOS DA TELA (toda a "escrita" daqui)
───────────────────────────────────────────── */
/* Textos do dicionário, mantendo a forma do objeto TXT. */
const makeTxt = (t: (k: string) => string) => ({
  back: t('biblioteca.back'),
  title: t('biblioteca.title'),
  subtitle: t('biblioteca.subtitle'),
  empty: t('biblioteca.empty'),
  empty_desc: t('biblioteca.empty_desc'),
  saved_one: t('biblioteca.saved_one'),
  saved_many: t('biblioteca.saved_many'),
  model_empty: t('biblioteca.model_empty'),
  save_title: t('biblioteca.save_title'),
  cancel: t('biblioteca.cancel'),
  copied: t('biblioteca.copied'),
  copy: t('biblioteca.copy'),
  rename: t('biblioteca.rename'),
  delete: t('biblioteca.delete'),
  briefing: t('biblioteca.briefing'),
  ai_response: t('biblioteca.ai_response'),
  edit: t('biblioteca.edit'),
  save: t('biblioteca.save'),
  toast_error: t('biblioteca.toast_error'),
  toast_title_updated: t('biblioteca.toast_title_updated'),
  toast_delete_error: t('biblioteca.toast_delete_error'),
  toast_removed: t('biblioteca.toast_removed'),
  toast_updated: t('biblioteca.toast_updated'),
  load_error: t('biblioteca.load_error'),
  search_placeholder: t('biblioteca.search_placeholder'),
  no_results: t('biblioteca.no_results'),
});

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

const formatDate = (ts: string, lang: SupportedLang) => formatDateNumeric(ts, lang);

interface LibraryGroup {
  slug: string;
  name: string;
  count: number;
  latest: string;
}

const LIBRARY_SECTIONS = [
  {
    id: 'curso',
    title: 'Construção do curso',
    description: 'Estrutura, aulas e material de apoio',
    slugs: ['agente-1', 'agente-2', 'agente-3'],
    Icon: Layers3,
  },
  {
    id: 'estrategia',
    title: 'Estratégia e oferta',
    description: 'Pesquisa, nome e promessa do produto',
    slugs: ['agente-4', 'agente-5', 'agente-6'],
    Icon: Sparkles,
  },
  {
    id: 'conteudo',
    title: 'Conteúdo e divulgação',
    description: 'Roteiros, anúncios e formatos virais',
    slugs: ['agente-7', 'agente-8', 'agente-9', 'agente-10', 'agente-11', 'agente-12'],
    Icon: BookOpen,
  },
];

/* ─────────────────────────────────────────────
   ACERVO ORGANIZADO POR ETAPA
───────────────────────────────────────────── */
const ModelsOverview: React.FC = () => {
  const { t } = useTranslation();
  const TXT = makeTxt(t);
  const lang = useCurrentLang();
  const AGENTS = useAgents();
  const navigate = useLocalizedNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<LibraryGroup[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    if (!SUPABASE_READY) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('saved_viral_outputs')
      .select('model_slug, model_name, created_at')
      .eq('user_id', user.id);

    if (error) {
      toast({ title: TXT.load_error, description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const map = new Map<string, LibraryGroup>();
    for (const row of data ?? []) {
      const existing = map.get(row.model_slug);
      const currentAgent = AGENTS.find(agent => agent.slug === row.model_slug);
      const latest = existing && new Date(existing.latest) > new Date(row.created_at)
        ? existing.latest
        : row.created_at;
      map.set(row.model_slug, {
        slug: row.model_slug,
        name: currentAgent?.name ?? row.model_name,
        count: (existing?.count ?? 0) + 1,
        latest,
      });
    }

    setGroups(Array.from(map.values()));
    setLoading(false);
  }, [toast, user]);

  useEffect(() => { load(); }, [load]);

  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
  const filteredGroups = groups.filter(group =>
    !normalizedSearch
    || group.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
    || LIBRARY_SECTIONS.some(section =>
      section.slugs.includes(group.slug)
      && section.title.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
    )
  );
  const visibleSections = LIBRARY_SECTIONS
    .map(section => ({
      ...section,
      groups: section.slugs
        .map(slug => filteredGroups.find(group => group.slug === slug))
        .filter((group): group is LibraryGroup => !!group),
    }))
    .filter(section => section.groups.length > 0);
  const unclassified = filteredGroups.filter(group =>
    !LIBRARY_SECTIONS.some(section => section.slugs.includes(group.slug))
  );
  const totalItems = groups.reduce((sum, group) => sum + group.count, 0);

  return (
    <div className="pb-28 pt-1">
      <section className="mx-4 mt-3 overflow-hidden rounded-[26px] border border-white/70 bg-gradient-to-br from-[#94002D] via-[#BE0D3E] to-[#D94368] p-5 text-white shadow-[0_18px_45px_-20px_rgba(148,0,45,0.65)]">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/chat')}
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            aria-label={TXT.back}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <LibraryIcon size={18} className="shrink-0 text-[#FFD27A]" />
              <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/75">Seu acervo criativo</span>
            </div>
            <h2 className="text-[30px] font-black leading-none tracking-tight text-white">{TXT.title}</h2>
            <p className="mt-2 text-[11px] leading-relaxed text-white/75">{TXT.subtitle}</p>
          </div>
          {!loading && totalItems > 0 && (
            <div className="shrink-0 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-center backdrop-blur">
              <p className="text-[22px] font-black leading-none">{totalItems}</p>
              <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-white/70">itens</p>
            </div>
          )}
        </div>
      </section>

      {!loading && groups.length > 0 && (
        <div className="relative mx-4 mt-4">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#BE0D3E]/60" />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={TXT.search_placeholder}
            className="h-11 w-full rounded-2xl border border-[#BE0D3E]/15 bg-white pl-10 pr-4 text-[12px] text-[#1E1B11] shadow-[0_8px_24px_-16px_rgba(148,0,45,0.3)] placeholder:text-[#5B4041]/45 focus:border-[#BE0D3E]/45"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-[#BE0D3E]" />
        </div>
      ) : groups.length === 0 ? (
        <div className="mx-4 mt-4 rounded-3xl border border-[#BE0D3E]/15 bg-white p-7 text-center shadow-[0_10px_28px_-20px_rgba(148,0,45,0.35)]">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F6D6DC]/70">
            <BookOpen size={26} className="text-[#BE0D3E]/65" />
          </div>
          <p className="mb-1 text-[15px] font-bold text-[#1E1B11]">{TXT.empty}</p>
          <p className="text-[11px] leading-relaxed text-[#5B4041]/75">{TXT.empty_desc}</p>
        </div>
      ) : visibleSections.length === 0 && unclassified.length === 0 ? (
        <p className="px-4 py-12 text-center text-[12px] text-[#5B4041]/65">{TXT.no_results}</p>
      ) : (
        <div className="mt-5 space-y-6 px-4">
          {visibleSections.map(section => (
            <section key={section.id}>
              <div className="mb-2.5 flex items-center gap-2.5 px-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F6D6DC]/70 text-[#BE0D3E]">
                  <section.Icon size={15} />
                </div>
                <div>
                  <h3 className="text-[14px] font-black leading-tight text-[#1E1B11]">{section.title}</h3>
                  <p className="text-[9px] text-[#5B4041]/60">{section.description}</p>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {section.groups.map(group => {
                  const AgentIcon = AGENTS.find(agent => agent.slug === group.slug)?.icon ?? BookOpen;
                  return (
                    <button
                      key={group.slug}
                      onClick={() => navigate(`/biblioteca/${group.slug}`)}
                      className="group flex w-full items-center gap-3 rounded-2xl border border-[#BE0D3E]/12 bg-white p-3.5 text-left shadow-[0_8px_22px_-18px_rgba(148,0,45,0.38)] transition-all hover:border-[#BE0D3E]/35 active:scale-[0.99]"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFF0F3] to-[#F6D6DC] text-[#BE0D3E]">
                        <AgentIcon size={19} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-black text-[#1E1B11]">{group.name}</p>
                        <div className="mt-1 flex items-center gap-2 text-[9px] text-[#5B4041]/60">
                          <span className="font-bold text-[#BE0D3E]">
                            {group.count} {group.count === 1 ? TXT.saved_one : TXT.saved_many}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock3 size={9} />
                            {formatDate(group.latest, lang)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="shrink-0 text-[#BE0D3E]/35 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {unclassified.length > 0 && (
            <section>
              <h3 className="mb-2.5 px-1 text-[14px] font-black text-[#1E1B11]">Outros conteúdos</h3>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {unclassified.map(group => (
                  <button
                    key={group.slug}
                    onClick={() => navigate(`/biblioteca/${group.slug}`)}
                    className="flex items-center justify-between rounded-2xl border border-[#BE0D3E]/12 bg-white p-4 text-left"
                  >
                    <span className="text-[12px] font-black text-[#1E1B11]">{group.name}</span>
                    <span className="text-[11px] font-bold text-[#BE0D3E]">{group.count}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   LISTA DE ITENS DE UM MODELO
───────────────────────────────────────────── */
const ModelItems: React.FC<{ modelSlug: string }> = ({ modelSlug }) => {
  const { t } = useTranslation();
  const TXT = makeTxt(t);
  const lang = useCurrentLang();
  const AGENTS = useAgents();
  const navigate = useLocalizedNavigate();
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
    const { data, error } = await supabase
      .from('saved_viral_outputs')
      .select('*')
      .eq('user_id', user.id)
      .eq('model_slug', modelSlug)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: TXT.load_error, description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    if (data) setItems(data as SavedItem[]);
    setLoading(false);
  }, [modelSlug, toast, user]);

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
  const modelName = AGENTS.find(agent => agent.slug === modelSlug)?.name ?? items[0]?.model_name ?? prettySlug;

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
              <p className="text-[9px] text-[#5B4041]/50">{formatDate(item.created_at, lang)}</p>
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
                    {openItem.model_name} · {formatDate(openItem.created_at, lang)}
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
