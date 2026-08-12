import React, { useMemo, useState } from 'react';
import { useLocalizedNavigate } from '@/i18n/LanguageProvider';
import { useTranslation, Trans } from 'react-i18next';

import {
  Target,
  ListOrdered,
  Eye,
  RefreshCw,
  BookOpen,
  GraduationCap,
  AlertTriangle,
  Clapperboard,
  Scale,
  Flame,
  Sparkles,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

type Objetivo = 'Alcance' | 'Engajamento' | 'Vendas' | 'Autoridade';

interface Modelo {
  id: string;
  icon: LucideIcon;
  /** 'Alcance' | 'Engajamento' | ... — é IDENTIFICADOR, não rótulo. O texto
   *  exibido sai de modelos.objetivos.<id>. */
  objetivo: Objetivo;
}

const OBJETIVOS: Objetivo[] = ['Alcance', 'Engajamento', 'Vendas', 'Autoridade'];

const OBJETIVO_STYLE: Record<Objetivo, { bg: string; text: string }> = {
  Alcance: { bg: '#F6B43A', text: '#1E1B11' },
  Engajamento: { bg: '#E06B85', text: '#FFFFFF' },
  Vendas: { bg: '#BE0D3E', text: '#FFFFFF' },
  Autoridade: { bg: '#1E1B11', text: '#FFFFFF' },
};

/* Só o que NÃO é texto. Nome e descrição vêm do dicionário
   (modelos.itens.<id>), resolvidos no render. */
const MODELOS: Modelo[] = [
  { id: 'problema-solucao', icon: Target,        objetivo: 'Vendas' },
  { id: 'lista-x-coisas',   icon: ListOrdered,   objetivo: 'Alcance' },
  { id: 'pov',              icon: Eye,           objetivo: 'Engajamento' },
  { id: 'antes-depois',     icon: RefreshCw,     objetivo: 'Vendas' },
  { id: 'storytelling-60s', icon: BookOpen,      objetivo: 'Engajamento' },
  { id: 'tutorial-rapido',  icon: GraduationCap, objetivo: 'Autoridade' },
  { id: 'erro-comum',       icon: AlertTriangle, objetivo: 'Autoridade' },
  { id: 'bastidores',       icon: Clapperboard,  objetivo: 'Alcance' },
  { id: 'comparativo',      icon: Scale,         objetivo: 'Vendas' },
  { id: 'trend-remix',      icon: Flame,         objetivo: 'Engajamento' },
];

const Modelos: React.FC = () => {
  const navigate = useLocalizedNavigate();
  const { t } = useTranslation();
  const [filtro, setFiltro] = useState<'Todos' | Objetivo>('Todos');

  const modelosFiltrados = useMemo(() => {
    if (filtro === 'Todos') return MODELOS;
    return MODELOS.filter((m) => m.objetivo === filtro);
  }, [filtro]);

  const handleEscolherModelo = (modelo: Modelo) => {
    navigate('/chat', { state: { modeloId: modelo.id, modeloNome: t(`modelos.itens.${modelo.id}.nome`) } });
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-28">
      <div className="mb-1">
        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50">
          {t('modelos.formatosProntos')}
        </span>
      </div>
      <h1 className="page-title">{t('modelos.titulo')}</h1>
      <p className="text-[13px] text-[#5B4041] leading-snug mt-1 mb-5">
        {t('modelos.subtitulo')}
      </p>

      {/* Filtros por objetivo */}
      <div
        className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 mb-5 -mx-4 px-4"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {(['Todos', ...OBJETIVOS] as const).map((opcao) => {
          const ativo = filtro === opcao;
          return (
            <button
              key={opcao}
              onClick={() => setFiltro(opcao)}
              style={{
                WebkitTapHighlightColor: 'transparent',
                ...(ativo
                  ? {
                      background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)',
                      boxShadow: '0 6px 16px rgba(255,45,122,0.35)',
                      color: '#FFFFFF',
                    }
                  : {
                      background: '#FFFFFF',
                      color: '#1E1B11',
                      border: '1px solid rgba(255,45,122,0.15)',
                    }),
              }}
              className="shrink-0 whitespace-nowrap px-4 py-2 rounded-2xl text-[12.5px] font-black tracking-tight active:scale-[0.96] transition-transform"
            >
              {opcao === 'Todos' ? t('modelos.todos') : t(`modelos.objetivos.${opcao}`)}
            </button>
          );
        })}
      </div>

      {/* Grid de modelos */}
      {modelosFiltrados.length === 0 ? (
        <div className="viral-card p-6 text-center">
          <p className="text-sm text-[#5B4041] font-bold">{t('modelos.vazio')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {modelosFiltrados.map((modelo) => {
            const Icon = modelo.icon;
            const estiloObjetivo = OBJETIVO_STYLE[modelo.objetivo];
            return (
              <button
                key={modelo.id}
                onClick={() => handleEscolherModelo(modelo)}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className="viral-card p-3.5 flex flex-col items-start text-left gap-2.5 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between w-full">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(255,45,122,0.08)' }}
                  >
                    <Icon size={19} strokeWidth={2.3} color="#BE0D3E" />
                  </div>
                  <span
                    className="text-[8.5px] font-black uppercase tracking-widest px-2 py-1 rounded-full leading-none"
                    style={{ background: estiloObjetivo.bg, color: estiloObjetivo.text }}
                  >
                    {t(`modelos.objetivos.${modelo.objetivo}`)}
                  </span>
                </div>

                <div>
                  <h3 className="font-black tracking-tight text-[#1E1B11] text-[14.5px] leading-tight">
                    {t(`modelos.itens.${modelo.id}.nome`)}
                  </h3>
                  <p
                    className="text-[11.5px] text-[#5B4041] leading-snug mt-1"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {t(`modelos.itens.${modelo.id}.desc`)}
                  </p>
                </div>

                <div className="flex items-center gap-1 mt-auto pt-1">
                  <Sparkles size={12} color="#BE0D3E" strokeWidth={2.5} />
                  <span className="text-[10.5px] font-black text-[#BE0D3E]">{t('modelos.gerarRoteiro')}</span>
                  <ArrowRight size={12} color="#BE0D3E" strokeWidth={2.5} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Dica final */}
      <div className="card-glass-liquid-lime mt-5 p-4 rounded-2xl flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#1E1B11] flex items-center justify-center shrink-0">
          <Sparkles size={15} color="#F6B43A" strokeWidth={2.5} />
        </div>
        <p className="text-[12px] text-[#1E1B11] font-bold leading-snug">
          <Trans i18nKey="modelos.dicaRodape" components={{ 1: <span className="text-[#BE0D3E]" /> }} />
        </p>
      </div>
    </div>
  );
};

export default Modelos;
