import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, Copy, Check, Download, FileText, FileType2, MoreHorizontal, Trash2,
  Loader2, ChevronDown, CloudOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useKeyboardViewport } from '@/hooks/useKeyboardViewport';
import { useCurrentLang } from '@/i18n/LanguageProvider';
import { formatDateNumeric } from '@/lib/formatLocale';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buildDocx, buildPdf, copyNote, deliverFile, fileSlug, sendToWhatsapp } from '@/lib/noteExport';

// Tiptap só carrega quando alguém abre uma nota — a lista continua leve.
const NoteEditor = lazy(() => import('./NoteEditor'));

export interface NoteItem {
  id: string;
  model_name: string;
  title: string;
  user_input: string;
  ai_response: string;
  created_at: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
const AUTOSAVE_MS = 1000;

const WhatsappIcon: React.FC<{ size?: number }> = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.43 9.43 0 0 1-4.8-1.32l-.35-.2-3.57.93.96-3.48-.23-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.43 9.45-9.43a9.38 9.38 0 0 1 9.43 9.44c0 5.2-4.24 9.44-9.44 9.44m8.03-17.47A11.3 11.3 0 0 0 12.05.7C5.8.7.7 5.79.7 12.05c0 2 .52 3.95 1.52 5.67L.6 23.3l5.7-1.5a11.3 11.3 0 0 0 5.74 1.47h.01c6.26 0 11.35-5.09 11.35-11.35 0-3.03-1.18-5.88-3.32-8.02" />
  </svg>
);

/* Botões da barra: só ícone no celular, ícone + texto a partir do tablet. */
const btn = 'flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest h-8 px-2.5 sm:px-3 rounded-lg shrink-0 disabled:opacity-50';
const btnText = 'hidden sm:inline';
const menuCls = 'z-[130] bg-white border-[#BE0D3E]/20 text-[#1E1B11] shadow-[0_10px_30px_rgba(190,13,62,0.2)] min-w-[12rem]';
const itemCls = 'gap-2 cursor-pointer text-[13px] py-2 hover:bg-[#FFF7E6] focus:bg-[#FFF7E6]';

interface Props {
  item: NoteItem;
  deleting: boolean;
  onClose: () => void;
  onRename: (title: string) => Promise<boolean>;
  onDelete: () => void;
  onContentSaved: (md: string) => void;
}

/* A nota aberta toma a tela inteira, como o Notas do iPhone: barra de ações
   em cima, data centralizada, título grande (editável direto) e a folha. */
const NoteModal: React.FC<Props> = ({ item, deleting, onClose, onRename, onDelete, onContentSaved }) => {
  const { t } = useTranslation();
  const lang = useCurrentLang();
  const { toast } = useToast();
  const { ref: shellRef } = useKeyboardViewport<HTMLDivElement>();

  const [briefingOpen, setBriefingOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<null | 'pdf' | 'docx' | 'whats'>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  /* Autosave como no Notas: cada edição reinicia o relógio; ao fechar, o que
     estiver pendente é gravado antes. `draft` é sempre o texto mais novo — é
     dele que saem cópia e downloads, mesmo antes de salvar. */
  const draft = useRef(item.ai_response);
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const onSavedRef = useRef(onContentSaved);
  onSavedRef.current = onContentSaved;

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    if (!pending.current) return true;
    const md = draft.current;
    if (!md.trim()) return true; // não deixa a nota virar vazia no banco por acidente
    pending.current = false;
    setSaveState('saving');
    const { error } = await supabase.from('saved_viral_outputs').update({ ai_response: md }).eq('id', item.id);
    if (error) {
      pending.current = true;
      setSaveState('error');
      return false;
    }
    onSavedRef.current(md);
    setSaveState(pending.current ? 'saving' : 'saved');
    return true;
  }, [item.id]);

  const handleChange = useCallback((md: string) => {
    draft.current = md;
    pending.current = true;
    setSaveState('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void save(); }, AUTOSAVE_MS);
  }, [save]);

  // Fechou a aba/app no meio da digitação: tenta gravar mesmo assim.
  useEffect(() => {
    const flush = () => { if (pending.current) void save(); };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [save]);

  /* Título: grava ao sair do campo (ou Enter). Vazio volta pro que era. */
  const commitTitle = async () => {
    const novo = titleDraft.trim().slice(0, 120);
    if (!novo) { setTitleDraft(item.title); return true; }
    if (novo === item.title) return true;
    const ok = await onRename(novo);
    if (!ok) setTitleDraft(item.title);
    return ok;
  };

  const close = async () => {
    const ok = (await commitTitle()) && (await save());
    if (!ok) {
      toast({ title: t('biblioteca.toast_error'), description: t('biblioteca.nota.erro_salvar'), variant: 'destructive' });
      return;
    }
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const subtitle = `${item.model_name} · ${formatDateNumeric(item.created_at, lang)}`;
  // Downloads e WhatsApp usam o título mais novo, mesmo antes de salvar.
  const tituloAtual = titleDraft.trim() || item.title;

  const handleCopy = async () => {
    try {
      await copyNote(draft.current);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: t('biblioteca.toast_error'), variant: 'destructive' });
    }
  };

  const exportar = async (kind: 'pdf' | 'docx' | 'whats') => {
    setBusy(kind);
    try {
      if (kind === 'whats') await sendToWhatsapp(tituloAtual, subtitle, draft.current);
      else {
        const blob = kind === 'pdf'
          ? await buildPdf(tituloAtual, subtitle, draft.current)
          : await buildDocx(tituloAtual, subtitle, draft.current);
        await deliverFile(blob, `${fileSlug(tituloAtual)}.${kind}`);
      }
    } catch (e) {
      toast({ title: t('biblioteca.nota.erro_exportar'), description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      ref={shellRef}
      className="fixed inset-0 z-[100] bg-white flex flex-col overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Barra de cima: voltar + ações (copiar, baixar, WhatsApp, mais) */}
      <div className="shrink-0 flex items-center gap-1.5 px-2 sm:px-4 py-2 border-b border-[#BE0D3E]/10">
        <button
          onClick={() => void close()}
          className="flex items-center gap-0.5 h-9 pl-1 pr-2.5 rounded-lg text-[#BE0D3E] text-[13px] font-bold shrink-0 hover:bg-[#FFF7E6]"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          aria-label={t('biblioteca.nota.fechar')}
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
          <span className="hidden sm:inline">{t('biblioteca.title')}</span>
        </button>

        <span className="flex-1 min-w-0 flex items-center justify-center text-[10px] text-[#5B4041]/70">
          {saveState === 'saving' && <span className="flex items-center gap-1 truncate"><Loader2 size={9} className="animate-spin" />{t('biblioteca.nota.salvando')}</span>}
          {saveState === 'saved' && <span className="flex items-center gap-1 truncate text-emerald-600"><Check size={10} />{t('biblioteca.nota.salvo')}</span>}
          {saveState === 'error' && (
            <button onClick={() => void save()} className="flex items-center gap-1 truncate text-red-500 font-bold">
              <CloudOff size={10} />{t('biblioteca.nota.tentar_de_novo')}
            </button>
          )}
        </span>

        <button onClick={() => void handleCopy()} className={`${btn} bg-white border border-[#BE0D3E]/30 text-[#BE0D3E]`} aria-label={t('biblioteca.copy')} title={t('biblioteca.copy')}>
          {copied ? <><Check size={13} /><span className={btnText}>{t('biblioteca.copied')}</span></> : <><Copy size={13} /><span className={btnText}>{t('biblioteca.copy')}</span></>}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button disabled={busy === 'pdf' || busy === 'docx'} className={`${btn} bg-[#BE0D3E] text-white`} aria-label={t('biblioteca.nota.baixar')} title={t('biblioteca.nota.baixar')}>
              {busy === 'pdf' || busy === 'docx' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              <span className={btnText}>{t('biblioteca.nota.baixar')}</span> <ChevronDown size={11} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={menuCls}>
            <DropdownMenuItem onClick={() => void exportar('pdf')} className={itemCls}>
              <FileText size={15} className="text-[#BE0D3E]" />
              <div>
                <p className="font-bold">{t('biblioteca.nota.baixar_pdf')}</p>
                <p className="text-[10px] text-[#5B4041]/70">{t('biblioteca.nota.baixar_pdf_desc')}</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void exportar('docx')} className={itemCls}>
              <FileType2 size={15} className="text-[#2B579A]" />
              <div>
                <p className="font-bold">{t('biblioteca.nota.baixar_word')}</p>
                <p className="text-[10px] text-[#5B4041]/70">{t('biblioteca.nota.baixar_word_desc')}</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button onClick={() => void exportar('whats')} disabled={busy === 'whats'} className={`${btn} bg-[#25D366] text-white`} aria-label={t('biblioteca.nota.whatsapp')} title={t('biblioteca.nota.whatsapp')}>
          {busy === 'whats' ? <Loader2 size={13} className="animate-spin" /> : <WhatsappIcon size={13} />}
          <span className={btnText}>{t('biblioteca.nota.whatsapp')}</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={`${btn} bg-white border border-[#5B4041]/20 text-[#5B4041] px-2`} aria-label={t('biblioteca.nota.mais')}>
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <MoreHorizontal size={15} />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={menuCls}>
            <DropdownMenuItem onClick={onDelete} disabled={deleting} className={`${itemCls} text-red-500`}>
              <Trash2 size={14} /> {t('biblioteca.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 size={20} className="animate-spin text-[#BE0D3E]" /></div>}>
        <NoteEditor
          markdown={item.ai_response}
          onChange={handleChange}
          renderToolbar={toolbar => (
            <div className="shrink-0 px-3 sm:px-5 py-1.5 border-b border-[#BE0D3E]/10 bg-white">{toolbar}</div>
          )}
        >
          {/* Folha: data centralizada, título grande, briefing dobrado */}
          <p className="text-center text-[11px] text-[#5B4041]/60 mb-4 truncate">{subtitle}</p>

          <input
            type="text"
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value.slice(0, 120))}
            onBlur={() => void commitTitle()}
            onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
            placeholder={t('biblioteca.nota.estilo_titulo')}
            aria-label={t('biblioteca.rename')}
            className="w-full bg-transparent text-[24px] sm:text-[30px] font-black text-[#1E1B11] leading-tight tracking-tight outline-none placeholder:text-[#5B4041]/30 mb-3"
          />

          {item.user_input?.trim() && (
            <div className="mb-6">
              <button
                onClick={() => setBriefingOpen(o => !o)}
                className="flex items-center gap-1 text-[9px] font-black text-[#5B4041] uppercase tracking-widest"
              >
                {t('biblioteca.briefing')}
                <ChevronDown size={11} className={`transition-transform ${briefingOpen ? 'rotate-180' : ''}`} />
              </button>
              {briefingOpen && (
                <div className="mt-1.5 bg-[#FFF7E6] border border-[#BE0D3E]/15 rounded-xl p-3">
                  <p className="text-[12px] text-[#1E1B11] leading-relaxed whitespace-pre-wrap">{item.user_input}</p>
                </div>
              )}
            </div>
          )}
        </NoteEditor>
      </Suspense>
    </div>
  );
};

export default NoteModal;
