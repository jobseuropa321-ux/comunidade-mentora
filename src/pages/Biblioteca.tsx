import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Library as LibraryIcon, BookOpen, Search, Clock3,
  ChevronRight, Layers3, Sparkles, NotebookPen, Plus, FileText, FileType2,
} from 'lucide-react';
import NoteModal from '@/components/biblioteca/NoteModal';
import { buildDocx, buildPdf, deliverFile, fileSlug } from '@/lib/noteExport';
import { supabase, SUPABASE_READY } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAgents } from '@/data/agents';
import { useTranslation } from 'react-i18next';
import { useLocalizedNavigate } from '@/i18n/LanguageProvider';
import { formatDateNumeric, localeTag } from '@/lib/formatLocale';
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
  anotacoes_nome: t('biblioteca.anotacoes_nome'),
  nova_nota: t('biblioteca.nova_nota'),
  anotacoes_vazio: t('biblioteca.anotacoes_vazio'),
  erro_criar_nota: t('biblioteca.erro_criar_nota'),
  baixar_pdf: t('biblioteca.nota.baixar_pdf'),
  baixar_word: t('biblioteca.nota.baixar_word'),
});

/* ── ANOTAÇÕES LIVRES ──
   A aluna também escreve do zero, sem agente: a nota é uma linha normal de
   saved_viral_outputs com este slug (model_slug é NOT NULL e é o que agrupa
   a Biblioteca). Nasce vazia e abre direto no editor, como no Notas. */
export const NOTES_SLUG = 'anotacoes';

/** Cria a nota vazia e devolve o id (ou null se falhou). */
async function criarNota(userId: string, modelName: string, title: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('saved_viral_outputs')
    .insert({ user_id: userId, model_slug: NOTES_SLUG, model_name: modelName, title, user_input: '', ai_response: '' })
    .select('id')
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/* Botões de download direto no card da lista — pra quem quer imprimir sem
   abrir a nota. Mesmo PDF/Word do editor (src/lib/noteExport.ts). */
const CardDownloads: React.FC<{ item: SavedItem; subtitle: string; onError: (msg: string) => void }> = ({ item, subtitle, onError }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<null | 'pdf' | 'docx'>(null);
  const baixar = async (e: React.MouseEvent, kind: 'pdf' | 'docx') => {
    e.stopPropagation();
    setBusy(kind);
    try {
      const blob = kind === 'pdf'
        ? await buildPdf(item.title, subtitle, item.ai_response)
        : await buildDocx(item.title, subtitle, item.ai_response);
      await deliverFile(blob, `${fileSlug(item.title)}.${kind}`);
    } catch (err) {
      onError((err as Error).message);
    } finally { setBusy(null); }
  };
  const cls = 'flex items-center gap-1 rounded-lg border border-[#BE0D3E]/20 bg-[#FFF7E6] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#BE0D3E] hover:bg-[#F6D6DC]/60 disabled:opacity-50';
  return (
    <div className="mt-2.5 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      <button type="button" onClick={e => void baixar(e, 'pdf')} disabled={!!busy} className={cls} title={t('biblioteca.nota.baixar_pdf_desc')}>
        {busy === 'pdf' ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />} {t('biblioteca.nota.baixar_pdf')}
      </button>
      <button type="button" onClick={e => void baixar(e, 'docx')} disabled={!!busy} className={cls} title={t('biblioteca.nota.baixar_word_desc')}>
        {busy === 'docx' ? <Loader2 size={10} className="animate-spin" /> : <FileType2 size={10} />} Word
      </button>
    </div>
  );
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

// Prévia do card: sem "##" e "**" aparecendo (mesmo corte do seletor do Chat).
const previewText = (md: string) =>
  md.replace(/[#*_>`~-]/g, ' ').replace(/\\/g, '').replace(/\s+/g, ' ').trim().slice(0, 150);

const formatDate = (ts: string, lang: SupportedLang) => formatDateNumeric(ts, lang);

interface LibraryGroup {
  slug: string;
  name: string;
  count: number;
  latest: string;
}

const LIBRARY_SECTIONS = [
  {
    id: 'anotacoes',
    slugs: [NOTES_SLUG],
    Icon: NotebookPen,
  },
  {
    id: 'curso',
    slugs: ['agente-1', 'agente-2', 'agente-3'],
    Icon: Layers3,
  },
  {
    id: 'estrategia',
    slugs: ['agente-4', 'agente-5', 'agente-6'],
    Icon: Sparkles,
  },
  {
    id: 'conteudo',
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
      const currentAgent = AGENTS.find(agent => agent.slug === row.model_slug)
        ?? (row.model_slug === NOTES_SLUG ? { name: TXT.anotacoes_nome } : undefined);
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

  const normalizedSearch = search.trim().toLocaleLowerCase(localeTag(lang));
  const filteredGroups = groups.filter(group =>
    !normalizedSearch
    || group.name.toLocaleLowerCase(localeTag(lang)).includes(normalizedSearch)
    || LIBRARY_SECTIONS.some(section =>
      section.slugs.includes(group.slug)
      && t(`biblioteca.secoes.${section.id}.title`).toLocaleLowerCase(localeTag(lang)).includes(normalizedSearch)
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

  const [criando, setCriando] = useState(false);
  const novaNota = async () => {
    if (!user || criando) return;
    setCriando(true);
    const id = await criarNota(user.id, TXT.anotacoes_nome, TXT.nova_nota);
    setCriando(false);
    if (!id) { toast({ title: TXT.erro_criar_nota, variant: 'destructive' }); return; }
    navigate(`/biblioteca/${NOTES_SLUG}`, { state: { abrir: id } });
  };

  return (
    <div className="pb-28 pt-1 lg:pb-10">
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
              <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/75">{t('biblioteca.seuAcervo')}</span>
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
        {/* Nota livre: abre o editor em branco, estilo Notas. */}
        <button
          onClick={() => void novaNota()}
          disabled={criando}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-[11px] font-black uppercase tracking-widest text-[#BE0D3E] shadow-[0_10px_24px_-14px_rgba(0,0,0,0.5)] hover:bg-[#FFF7E6] disabled:opacity-60 lg:w-auto"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {criando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} strokeWidth={3} />}
          {TXT.nova_nota}
        </button>
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
                  <h3 className="text-[14px] font-black leading-tight text-[#1E1B11]">{t(`biblioteca.secoes.${section.id}.title`)}</h3>
                  <p className="text-[9px] text-[#5B4041]/60">{t(`biblioteca.secoes.${section.id}.description`)}</p>
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
              <h3 className="mb-2.5 px-1 text-[14px] font-black text-[#1E1B11]">{t('biblioteca.outrosConteudos')}</h3>
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
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const ehAnotacoes = modelSlug === NOTES_SLUG;

  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Vindo do botão "Nova anotação" da capa, a nota recém-criada já abre.
  const [openItemId, setOpenItemId] = useState<string | null>(
    () => ((location.state as { abrir?: string } | null)?.abrir ?? null),
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const novaNota = async () => {
    if (!user || criando) return;
    setCriando(true);
    const id = await criarNota(user.id, TXT.anotacoes_nome, TXT.nova_nota);
    setCriando(false);
    if (!id) { toast({ title: TXT.erro_criar_nota, variant: 'destructive' }); return; }
    await load();
    setOpenItemId(id);
  };

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

  const handleSaveTitle = async (title: string) => {
    if (!openItemId) return false;
    const { error } = await supabase
      .from('saved_viral_outputs')
      .update({ title })
      .eq('id', openItemId);
    if (error) {
      toast({ title: TXT.toast_error, description: error.message, variant: 'destructive' });
      return false;
    }
    setItems(prev => prev.map(i => i.id === openItemId ? { ...i, title } : i));
    toast({ title: TXT.toast_title_updated });
    return true;
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

  /* No app original havia um botão "Mandar pro Kanban" aqui, que criava um
   * roteiro no quadro Kanban. Quando/se este app tiver Kanban, é só recolocar
   * o botão nas ações do modal chamando a sua integração. */

  // Enquanto os itens carregam, usa o nome derivado do slug (ex: "ganchos-virais"
  // -> "Ganchos Virais") em vez de cair em "Biblioteca" — evita o flash do titulo
  // errado nos primeiros segundos.
  const prettySlug = modelSlug
    ? modelSlug.replace(/-/g, ' ').replace(/(^|\s)\S/g, c => c.toUpperCase())
    : TXT.title;
  const modelName = ehAnotacoes
    ? TXT.anotacoes_nome
    : (AGENTS.find(agent => agent.slug === modelSlug)?.name ?? items[0]?.model_name ?? prettySlug);

  return (
    <div className="pb-28 pt-1 lg:pb-10">
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

      {ehAnotacoes && (
        <div className="px-4 mb-3">
          <button
            onClick={() => void novaNota()}
            disabled={criando}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#BE0D3E] to-[#E06B85] px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white shadow-[0_6px_18px_rgba(190,13,62,0.3)] disabled:opacity-60 lg:w-auto"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {criando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} strokeWidth={3} />}
            {TXT.nova_nota}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-[#BE0D3E]" />
        </div>
      ) : items.length === 0 ? (
        <div className="mx-4 bg-white border border-[#BE0D3E]/20 rounded-2xl p-6 text-center">
          <p className="text-[#5B4041] text-[11px]">{ehAnotacoes ? TXT.anotacoes_vazio : TXT.model_empty}</p>
        </div>
      ) : (
        /* Desktop: cartões em grade (2–3 por linha) em vez da pilha. */
        <div className="px-4 space-y-2 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 lg:space-y-0">
          {items.map(item => (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => setOpenItemId(item.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenItemId(item.id); } }}
              className="w-full bg-white border border-[#BE0D3E]/15 rounded-2xl p-4 text-left shadow-[0_4px_12px_rgba(190,13,62,0.06)] hover:border-[#BE0D3E]/40 active:scale-[0.99] transition-all cursor-pointer lg:flex lg:flex-col"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <p className="text-[13px] font-black text-[#1E1B11] leading-tight mb-1.5 line-clamp-2">{item.title}</p>
              <p className="text-[10px] text-[#5B4041]/70 line-clamp-2 mb-2 lg:flex-1 lg:line-clamp-3">
                {item.ai_response.trim() ? <>{previewText(item.ai_response)}…</> : t('biblioteca.nota.placeholder')}
              </p>
              <p className="text-[9px] text-[#5B4041]/50">{formatDate(item.created_at, lang)}</p>
              {item.ai_response.trim() && (
                <CardDownloads
                  item={item}
                  subtitle={`${modelName} · ${formatDate(item.created_at, lang)}`}
                  onError={msg => toast({ title: t('biblioteca.nota.erro_exportar'), description: msg, variant: 'destructive' })}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {openItem && (
        <NoteModal
          key={openItem.id}
          item={{ ...openItem, model_name: modelName }}
          deleting={deletingId === openItem.id}
          onClose={() => setOpenItemId(null)}
          onRename={handleSaveTitle}
          onDelete={() => handleDelete(openItem.id)}
          onContentSaved={md => setItems(prev => prev.map(i => i.id === openItem.id ? { ...i, ai_response: md } : i))}
        />
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
