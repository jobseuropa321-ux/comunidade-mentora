import React, { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type ColunaId = 'ideias' | 'gravando' | 'publicado';

type Categoria = 'Humor' | 'Educativo' | 'Trend' | 'Bastidores' | 'Storytime';

interface Roteiro {
  id: string;
  /** Só os cards criados na hora carregam texto próprio; os iniciais vêm do
   *  dicionário por id (kanban.itens.<id>). */
  titulo?: string;
  categoria: Categoria;
  coluna: ColunaId;
}

interface ColunaConfig {
  id: ColunaId;
  emoji: string;
  corBarra: string;
}

/* Sem título: o rótulo da coluna sai de kanban.colunas.<id> no render. */
const COLUNAS: ColunaConfig[] = [
  { id: 'ideias', emoji: '💡', corBarra: '#F6B43A' },
  { id: 'gravando', emoji: '🎬', corBarra: '#E06B85' },
  { id: 'publicado', emoji: '✅', corBarra: '#BE0D3E' },
];

const CATEGORIA_COR: Record<Categoria, { bg: string; texto: string }> = {
  Humor: { bg: 'rgba(255,45,122,0.12)', texto: '#BE0D3E' },
  Educativo: { bg: 'rgba(122,45,255,0.12)', texto: '#7A2DFF' },
  Trend: { bg: 'rgba(200,240,0,0.25)', texto: '#5B6600' },
  Bastidores: { bg: 'rgba(255,122,45,0.14)', texto: '#CC5400' },
  Storytime: { bg: 'rgba(255,90,153,0.15)', texto: '#BE0D3E' },
};

/* Array neutro: o título de cada card vem de kanban.itens.<id>. */
const ROTEIROS_INICIAIS: Roteiro[] = [
  { id: 'rt-1', categoria: 'Educativo',  coluna: 'ideias' },
  { id: 'rt-2', categoria: 'Humor',      coluna: 'ideias' },
  { id: 'rt-3', categoria: 'Trend',      coluna: 'gravando' },
  { id: 'rt-4', categoria: 'Bastidores', coluna: 'gravando' },
  { id: 'rt-5', categoria: 'Storytime',  coluna: 'publicado' },
];



const ORDEM_COLUNA: ColunaId[] = ['ideias', 'gravando', 'publicado'];

const KanbanCard: React.FC<{
  roteiro: Roteiro;
  onMover: (id: string, direcao: 1 | -1) => void;
}> = ({ roteiro, onMover }) => {
  const { t } = useTranslation();
  const indiceAtual = ORDEM_COLUNA.indexOf(roteiro.coluna);
  const podeVoltar = indiceAtual > 0;
  const podeAvancar = indiceAtual < ORDEM_COLUNA.length - 1;
  const cor = CATEGORIA_COR[roteiro.categoria];

  return (
    <div className="kanban-card viral-card p-3.5">
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest"
        style={{ background: cor.bg, color: cor.texto }}
      >
        {t(`kanban.categorias.${roteiro.categoria}`)}
      </span>

      <h3 className="mt-2 text-[13px] font-black text-[#1E1B11] leading-snug tracking-tight">
        {roteiro.titulo ?? t(`kanban.itens.${roteiro.id}`)}
      </h3>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => onMover(roteiro.id, -1)}
          disabled={!podeVoltar}
          aria-label={t('a11y.colunaAnterior')}
          style={{ WebkitTapHighlightColor: 'transparent' }}
          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
            podeVoltar
              ? 'bg-[#BE0D3E]/10 text-[#BE0D3E]'
              : 'bg-[#1E1B11]/5 text-[#1E1B11]/20 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
        </button>

        <span className="text-[9px] font-bold text-[#5B4041]/60 uppercase tracking-widest">
          {roteiro.coluna === 'ideias' && 'Rascunho'}
          {roteiro.coluna === 'gravando' && 'Em produção'}
          {roteiro.coluna === 'publicado' && 'No ar'}
        </span>

        <button
          onClick={() => onMover(roteiro.id, 1)}
          disabled={!podeAvancar}
          aria-label={t('a11y.colunaProxima')}
          style={{ WebkitTapHighlightColor: 'transparent' }}
          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
            podeAvancar
              ? 'bg-[#BE0D3E]/10 text-[#BE0D3E]'
              : 'bg-[#1E1B11]/5 text-[#1E1B11]/20 cursor-not-allowed'
          }`}
        >
          <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};

const Kanban: React.FC = () => {
  const { t } = useTranslation();
  const [roteiros, setRoteiros] = useState<Roteiro[]>(ROTEIROS_INICIAIS);
  const [proximaIdeia, setProximaIdeia] = useState(0);

  const moverCard = (id: string, direcao: 1 | -1) => {
    setRoteiros((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const indiceAtual = ORDEM_COLUNA.indexOf(r.coluna);
        const novoIndice = indiceAtual + direcao;
        if (novoIndice < 0 || novoIndice >= ORDEM_COLUNA.length) return r;
        return { ...r, coluna: ORDEM_COLUNA[novoIndice] };
      })
    );
  };

  const adicionarIdeia = () => {
    const novas = t('kanban.novasIdeias', { returnObjects: true }) as string[];
    const titulo = novas[proximaIdeia % novas.length];
    const novoCard: Roteiro = {
      id: `rt-novo-${Date.now()}`,
      titulo,
      categoria: 'Educativo',
      coluna: 'ideias',
    };
    setRoteiros((prev) => [novoCard, ...prev]);
    setProximaIdeia((n) => n + 1);
  };

  const contagemPorColuna = (colunaId: ColunaId) =>
    roteiros.filter((r) => r.coluna === colunaId).length;

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-28">
      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50">
        {t('kanban.organizacao')}
      </span>
      <h1 className="page-title">{t('kanban.titulo')}</h1>
      <p className="mt-2 text-[13px] text-[#5B4041] font-medium leading-relaxed">
        {t('kanban.subtitulo')}
        entre as etapas.
      </p>

      {/* Board horizontal */}
      <div className="mt-5 -mx-4 px-4 flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {COLUNAS.map((coluna) => {
          const cardsColuna = roteiros.filter((r) => r.coluna === coluna.id);
          return (
            <div
              key={coluna.id}
              className="kanban-column shrink-0 min-w-[260px] w-[260px] bg-white/60 rounded-3xl p-3 flex flex-col"
              style={{ border: '1px solid rgba(255,45,122,0.12)' }}
            >
              {/* Cabeçalho da coluna */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: coluna.corBarra }}
                  />
                  <h2 className="text-[13px] font-black text-[#1E1B11] tracking-tight">
                    {t(`kanban.colunas.${coluna.id}`)}
                  </h2>
                  <span className="text-[10px] font-black text-[#5B4041]/50">
                    {contagemPorColuna(coluna.id)}
                  </span>
                </div>
              </div>

              {coluna.id === 'ideias' && (
                <button
                  onClick={adicionarIdeia}
                  style={{
                    WebkitTapHighlightColor: 'transparent',
                    background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)',
                    boxShadow: '0 8px 25px rgba(255,45,122,0.4)',
                  }}
                  className="mb-3 w-full rounded-2xl py-2.5 flex items-center justify-center gap-1.5 text-white text-[12px] font-black tracking-tight active:scale-[0.98] transition-transform"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                  {t('kanban.novaIdeia')}
                </button>
              )}

              <div className="flex flex-col gap-3">
                {cardsColuna.map((roteiro) => (
                  <KanbanCard key={roteiro.id} roteiro={roteiro} onMover={moverCard} />
                ))}

                {cardsColuna.length === 0 && (
                  <div className="viral-card p-5 flex flex-col items-center text-center gap-2 opacity-60">
                    <FileText className="w-5 h-5 text-[#5B4041]" />
                    <p className="text-[11px] font-bold text-[#5B4041]">
                      {t('kanban.vazio')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dica final */}
      <div className="card-glass-liquid-lime mt-5 p-4 rounded-2xl">
        <p className="text-[12px] font-black text-[#1E1B11] leading-snug">
          {t('kanban.dica')}
        </p>
      </div>
    </div>
  );
};

export default Kanban;
