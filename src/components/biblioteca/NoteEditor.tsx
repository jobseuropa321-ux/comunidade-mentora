import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Undo2, Redo2, Check, ChevronDown,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

/* Editor das notas da Biblioteca — a "experiência do bloco de notas do iPhone"
   que o vídeo de 2026-10-19 pediu: abre já formatado (antes aparecia o
   markdown cru, "##" e "**" na tela) e dá pra editar direto, com o mesmo menu
   de estilos do Notas (Título / Cabeçalho / Subtítulo / Corpo).

   Entra e sai markdown: o Chat reaproveita esse texto como contexto da IA. */

/* O serializer escapa o que pareceria sintaxe ("1\.", "\*") e escreve quebra
   de linha como "\" + enter. O Chat mostra o texto quase cru, então essas
   barras apareceriam lá — aqui elas saem. */
const limpaMarkdown = (md: string) =>
  md.replace(/\\\n/g, '\n').replace(/\\([*_#.\-+!>[\]()~`])/g, '$1');

type Estilo = 'h1' | 'h2' | 'h3' | 'p';

const estiloAtual = (ed: Editor): Estilo =>
  ed.isActive('heading', { level: 1 }) ? 'h1'
    : ed.isActive('heading', { level: 2 }) ? 'h2'
      : ed.isActive('heading', { level: 3 }) || ed.isActive('heading', { level: 4 }) ? 'h3'
        : 'p';

const aplicaEstilo = (ed: Editor, e: Estilo) => {
  const c = ed.chain().focus();
  if (e === 'p') c.setParagraph().run();
  else c.setHeading({ level: Number(e[1]) as 1 | 2 | 3 }).run();
};

const Btn: React.FC<{ on?: boolean; label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }> =
  ({ on, label, onClick, disabled, children }) => (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()} // não tira o foco do texto
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${on ? 'bg-[#BE0D3E] text-white' : 'text-[#5B4041] hover:bg-[#FFF7E6]'}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {children}
    </button>
  );

const Toolbar: React.FC<{ editor: Editor }> = ({ editor }) => {
  const { t } = useTranslation();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Re-renderiza a barra a cada mudança de seleção pra os botões acenderem.
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force(n => n + 1);
    editor.on('transaction', f);
    return () => { editor.off('transaction', f); };
  }, [editor]);

  useEffect(() => {
    if (!menu) return;
    const fecha = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('pointerdown', fecha);
    return () => document.removeEventListener('pointerdown', fecha);
  }, [menu]);

  const atual = estiloAtual(editor);
  const ESTILOS: { id: Estilo; label: string; cls: string }[] = [
    { id: 'h1', label: t('biblioteca.nota.estilo_titulo'), cls: 'text-[20px] font-black' },
    { id: 'h2', label: t('biblioteca.nota.estilo_cabecalho'), cls: 'text-[16px] font-black' },
    { id: 'h3', label: t('biblioteca.nota.estilo_subtitulo'), cls: 'text-[14px] font-bold text-[#BE0D3E]' },
    { id: 'p', label: t('biblioteca.nota.estilo_corpo'), cls: 'text-[13px]' },
  ];

  return (
    // O "Aa" fica fora da faixa rolável: overflow-x corta o menu que abre embaixo.
    <div className="flex items-center gap-0.5">
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => setMenu(m => !m)}
          className={`h-8 px-2.5 flex items-center gap-1 rounded-lg text-[13px] font-black transition-colors ${menu ? 'bg-[#BE0D3E] text-white' : 'text-[#5B4041] hover:bg-[#FFF7E6]'}`}
          aria-label={t('biblioteca.nota.estilos')}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Aa <ChevronDown size={12} />
        </button>
        {menu && (
          <div className="absolute left-0 top-10 z-20 w-48 bg-white rounded-xl border border-[#BE0D3E]/15 shadow-[0_12px_32px_rgba(30,27,17,0.18)] p-1">
            {ESTILOS.map(e => (
              <button
                key={e.id}
                type="button"
                onMouseDown={ev => ev.preventDefault()}
                onClick={() => { aplicaEstilo(editor, e.id); setMenu(false); }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-[#1E1B11] hover:bg-[#FFF7E6]"
              >
                <span className="w-3.5 shrink-0 text-[#BE0D3E]">{atual === e.id && <Check size={13} />}</span>
                <span className={e.cls}>{e.label}</span>
              </button>
            ))}
            <div className="my-1 border-t border-[#BE0D3E]/10" />
            <button
              type="button"
              onMouseDown={ev => ev.preventDefault()}
              onClick={() => { editor.chain().focus().toggleBulletList().run(); setMenu(false); }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-[13px] text-[#1E1B11] hover:bg-[#FFF7E6]"
            >
              <span className="w-3.5 shrink-0 text-[#BE0D3E]">{editor.isActive('bulletList') && <Check size={13} />}</span>
              {t('biblioteca.nota.lista_marcadores')}
            </button>
            <button
              type="button"
              onMouseDown={ev => ev.preventDefault()}
              onClick={() => { editor.chain().focus().toggleOrderedList().run(); setMenu(false); }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-[13px] text-[#1E1B11] hover:bg-[#FFF7E6]"
            >
              <span className="w-3.5 shrink-0 text-[#BE0D3E]">{editor.isActive('orderedList') && <Check size={13} />}</span>
              {t('biblioteca.nota.lista_numerada')}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
      <span className="w-px h-5 bg-[#BE0D3E]/15 mx-1 shrink-0" />
      <Btn label={t('biblioteca.nota.negrito')} on={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></Btn>
      <Btn label={t('biblioteca.nota.italico')} on={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></Btn>
      <Btn label={t('biblioteca.nota.riscado')} on={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></Btn>
      <span className="w-px h-5 bg-[#BE0D3E]/15 mx-1 shrink-0" />
      <Btn label={t('biblioteca.nota.lista_marcadores')} on={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></Btn>
      <Btn label={t('biblioteca.nota.lista_numerada')} on={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></Btn>
      <span className="w-px h-5 bg-[#BE0D3E]/15 mx-1 shrink-0" />
      <Btn label={t('biblioteca.nota.desfazer')} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></Btn>
      <Btn label={t('biblioteca.nota.refazer')} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></Btn>
      </div>
    </div>
  );
};

interface Props {
  markdown: string;
  onChange: (md: string) => void;
  /* A barra fica fora do texto (fixa no topo do modal), por isso vem num slot. */
  renderToolbar: (toolbar: React.ReactNode) => React.ReactNode;
  children?: React.ReactNode;
}

const NoteEditor: React.FC<Props> = ({ markdown, onChange, renderToolbar, children }) => {
  const { t } = useTranslation();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, code: false, codeBlock: false }),
      Placeholder.configure({ placeholder: t('biblioteca.nota.placeholder') }),
      // breaks: a IA quebra linha sem deixar linha em branco; sem isso tudo
      // grudava num parágrafo só.
      Markdown.configure({ html: false, breaks: true, tightLists: true, bulletListMarker: '-' }),
    ],
    content: markdown,
    editorProps: { attributes: { class: 'nota-editor outline-none' } },
    // Só edição de verdade dispara: abrir a nota não regrava nada no banco.
    onUpdate: ({ editor: ed }) => {
      onChangeRef.current(limpaMarkdown(ed.storage.markdown.getMarkdown()));
    },
  });

  // Já baixa o gerador de PDF enquanto ela lê: no iPhone a folha de
  // compartilhar só abre se for chamada logo depois do toque.
  useEffect(() => { void import('jspdf'); }, []);

  if (!editor) return null;
  return (
    <>
      {renderToolbar(<Toolbar editor={editor} />)}
      <div className="flex-1 overflow-y-auto overscroll-contain" onClick={e => { if (e.target === e.currentTarget) editor.commands.focus('end'); }}>
        <div className="max-w-3xl mx-auto px-5 sm:px-10 py-5 sm:py-8">
          {children}
          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  );
};

export default NoteEditor;
