import React, { useMemo, useState } from 'react';
import { Play, Eye, TrendingUp, Bookmark, Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Categoria = 'Todos' | 'Humor' | 'Educativo' | 'Trend' | 'Bastidores';

interface Referencia {
  id: string;
  criador: string;
  metricaIcone: 'eye' | 'trend';
  categoria: Exclude<Categoria, 'Todos'>;
  gradiente: string;
  duracao: string;
}

/* Só o que NÃO é texto. Título e métrica saem do dicionário
   (referencias.itens.<id>) no render — array neutro, conforme o kit. */
const REFERENCIAS: Referencia[] = [
  { id: 'ref-1', criador: '@vitorcria.conteudo', metricaIcone: 'eye',   categoria: 'Educativo',
    gradiente: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 60%, #FFC1D8 100%)', duracao: '0:38' },
  { id: 'ref-2', criador: '@lu.editatudo',       metricaIcone: 'trend', categoria: 'Bastidores',
    gradiente: 'linear-gradient(135deg, #7A2DFF 0%, #BE0D3E 55%, #FF9AC1 100%)', duracao: '1:12' },
  { id: 'ref-3', criador: '@dudu.humor',         metricaIcone: 'eye',   categoria: 'Humor',
    gradiente: 'linear-gradient(135deg, #FF7A2D 0%, #BE0D3E 60%, #E06B85 100%)', duracao: '0:24' },
  { id: 'ref-4', criador: '@carol.trends',       metricaIcone: 'trend', categoria: 'Trend',
    gradiente: 'linear-gradient(135deg, #F6B43A 0%, #BE0D3E 75%)',               duracao: '0:19' },
  { id: 'ref-5', criador: '@thi.criador',        metricaIcone: 'eye',   categoria: 'Educativo',
    gradiente: 'linear-gradient(135deg, #BE0D3E 0%, #B32362 60%, #1E1B11 100%)', duracao: '2:03' },
  { id: 'ref-6', criador: '@nat.bastidores',     metricaIcone: 'trend', categoria: 'Bastidores',
    gradiente: 'linear-gradient(135deg, #E06B85 0%, #BE0D3E 50%, #7A2DFF 100%)', duracao: '0:56' },
];

const CATEGORIAS: Categoria[] = ['Todos', 'Humor', 'Educativo', 'Trend', 'Bastidores'];

const CategoriaBadge: React.FC<{ categoria: Referencia['categoria'] }> = ({ categoria }) => {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#BE0D3E]/10 text-[#BE0D3E] text-[9px] font-black uppercase tracking-widest">
      {t(`referencias.categorias.${categoria}`)}
    </span>
  );
};

const ReferenciaCard: React.FC<{
  referencia: Referencia;
  salvo: boolean;
  onToggleSalvar: () => void;
}> = ({ referencia, salvo, onToggleSalvar }) => {
  const { t } = useTranslation();
  const MetricaIcone = referencia.metricaIcone === 'eye' ? Eye : TrendingUp;

  return (
    <div className="viral-card p-3 flex gap-3">
      {/* Thumbnail */}
      <div
        className="relative shrink-0 w-24 h-32 sm:w-28 sm:h-36 rounded-2xl overflow-hidden flex items-center justify-center"
        style={{ background: referencia.gradiente }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div
          className="relative z-10 w-9 h-9 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <Play className="w-4 h-4 text-white fill-white ml-0.5" strokeWidth={0} />
        </div>
        <span className="absolute bottom-1.5 right-1.5 z-10 text-[8px] font-black text-white bg-black/40 px-1.5 py-0.5 rounded-md">
          {referencia.duracao}
        </span>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <CategoriaBadge categoria={referencia.categoria} />
          <h3 className="mt-1.5 text-[13px] font-black text-[#1E1B11] leading-tight tracking-tight line-clamp-2">
            {t(`referencias.itens.${referencia.id}.titulo`)}
          </h3>
          <p className="mt-1 text-[11px] font-bold text-[#5B4041]">{referencia.criador}</p>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1 text-[#BE0D3E]">
            <MetricaIcone className="w-3.5 h-3.5" strokeWidth={2.5} />
            <span className="text-[11px] font-black">{t(`referencias.itens.${referencia.id}.metrica`)}</span>
          </div>

          <button
            onClick={onToggleSalvar}
            aria-label={salvo ? t('referencias.removerSalvo') : t('referencias.salvar')}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors active:scale-90"
            style={{
              WebkitTapHighlightColor: 'transparent',
              background: salvo ? 'rgba(255,45,122,0.12)' : 'transparent',
            }}
          >
            <Bookmark
              className="w-4 h-4"
              color="#BE0D3E"
              fill={salvo ? '#BE0D3E' : 'none'}
              strokeWidth={2.2}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

const Referencias: React.FC = () => {
  const { t } = useTranslation();
  const [categoriaAtiva, setCategoriaAtiva] = useState<Categoria>('Todos');
  const [salvos, setSalvos] = useState<Record<string, boolean>>({});

  const listaFiltrada = useMemo(() => {
    if (categoriaAtiva === 'Todos') return REFERENCIAS;
    return REFERENCIAS.filter((r) => r.categoria === categoriaAtiva);
  }, [categoriaAtiva]);

  const toggleSalvar = (id: string) => {
    setSalvos((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const totalSalvos = Object.values(salvos).filter(Boolean).length;

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50">
            {t('referencias.bancoInspiracao')}
          </span>
          <h1 className="page-title">{t('referencias.titulo')}</h1>
        </div>
        {totalSalvos > 0 && (
          <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#BE0D3E]/10">
            <Bookmark className="w-3.5 h-3.5" color="#BE0D3E" fill="#BE0D3E" />
            <span className="text-[11px] font-black text-[#BE0D3E]">{totalSalvos}</span>
          </div>
        )}
      </div>

      <p className="mt-2 text-[13px] text-[#5B4041] font-medium leading-relaxed">
        {t('referencias.subtitulo')}
        antes de gravar o seu.
      </p>

      {/* Chips de filtro */}
      <div className="mt-5 -mx-4 px-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {CATEGORIAS.map((cat) => {
          const ativo = cat === categoriaAtiva;
          return (
            <button
              key={t(`referencias.categorias.${cat}`)}
              onClick={() => setCategoriaAtiva(cat)}
              style={{
                WebkitTapHighlightColor: 'transparent',
                ...(ativo
                  ? {
                      background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)',
                      boxShadow: '0 6px 16px rgba(255,45,122,0.35)',
                    }
                  : {}),
              }}
              className={`shrink-0 px-4 py-2 rounded-2xl text-[12px] font-black tracking-tight transition-all active:scale-[0.96] ${
                ativo
                  ? 'text-white'
                  : 'text-[#1E1B11] bg-white border border-[#BE0D3E]/15'
              }`}
            >
              {t(`referencias.categorias.${cat}`)}
            </button>
          );
        })}
      </div>

      {/* Lista de referências */}
      <div className="mt-5 space-y-3">
        {listaFiltrada.map((ref) => (
          <ReferenciaCard
            key={ref.id}
            referencia={ref}
            salvo={!!salvos[ref.id]}
            onToggleSalvar={() => toggleSalvar(ref.id)}
          />
        ))}

        {listaFiltrada.length === 0 && (
          <div className="viral-card p-8 flex flex-col items-center text-center gap-2">
            <Flame className="w-6 h-6 text-[#BE0D3E]" />
            <p className="text-[13px] font-bold text-[#1E1B11]">{t('referencias.vazio')}</p>
            <p className="text-[12px] text-[#5B4041]">{t('referencias.vazioSub')}</p>
          </div>
        )}
      </div>

      {/* Dica final */}
      <div className="card-glass-liquid-lime mt-5 p-4 rounded-2xl">
        <p className="text-[12px] font-black text-[#1E1B11] leading-snug">
          {t('referencias.dicaComunidade')}
        </p>
      </div>
    </div>
  );
};

export default Referencias;
