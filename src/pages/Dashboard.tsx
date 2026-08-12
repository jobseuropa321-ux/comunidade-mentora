import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Users, Eye, Heart, Bookmark, BarChart3 } from 'lucide-react';
import { formatNumber } from '@/lib/formatLocale';
import { useCurrentLang, type SupportedLang } from '@/i18n/LanguageProvider';

/* ── TIPOS ── */
interface StatTile {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  Icon: React.ElementType;
}

interface TopPost {
  rank: number;
  title: string;
  views: string;
  gradient: string;
}

/* ── MOCK: cards de estatística ── */
const STAT_TILES: StatTile[] = [
  { label: 'Seguidores', value: '24,7K', change: '+8,4%', positive: true, Icon: Users },
  { label: 'Alcance', value: '182,4K', change: '+12,1%', positive: true, Icon: Eye },
  { label: 'Engajamento', value: '6,8%', change: '-1,2 p.p.', positive: false, Icon: Heart },
  { label: 'Salvamentos', value: '3.920', change: '+21,6%', positive: true, Icon: Bookmark },
];

/* ── MOCK: visualizações dos últimos 7 dias (seg → dom) ── */
const DAY_LABELS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const WEEKLY_VIEWS = [8200, 10400, 7600, 15300, 24800, 31200, 19700];
const MAX_VIEWS = Math.max(...WEEKLY_VIEWS);
const TOTAL_VIEWS = WEEKLY_VIEWS.reduce((sum, v) => sum + v, 0);
const PEAK_DAY_INDEX = WEEKLY_VIEWS.indexOf(MAX_VIEWS);

const formatViews = (n: number, lang: SupportedLang): string => formatNumber(n, lang);

/* ── MOCK: top posts da semana ── */
const TOP_POSTS: TopPost[] = [
  {
    rank: 1,
    title: '3 erros que fazem seu Reels não viralizar',
    views: '184,2K',
    gradient: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)',
  },
  {
    rank: 2,
    title: 'Como gravar 10 Reels em 1 hora (método batelada)',
    views: '152,7K',
    gradient: 'linear-gradient(135deg, #F6B43A 0%, #9FCC00 100%)',
  },
  {
    rank: 3,
    title: 'O hook que triplicou meu alcance em 7 dias',
    views: '97,4K',
    gradient: 'linear-gradient(135deg, #1E1B11 0%, #BE0D3E 100%)',
  },
];

/* ── COMPONENTE: tile de estatística ── */
const StatTileCard: React.FC<{ tile: StatTile }> = ({ tile }) => {
  const { label, value, change, positive, Icon } = tile;
  return (
    <div className="viral-card p-4 flex flex-col gap-3">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(255,45,122,0.1)' }}
      >
        <Icon className="w-[18px] h-[18px]" style={{ color: '#BE0D3E' }} strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-2xl font-black tracking-tighter text-[#1E1B11] leading-none">{value}</p>
        <p className="text-[11px] font-bold text-[#5B4041] mt-1.5">{label}</p>
      </div>
      <div
        className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-full text-[10px] font-black"
        style={{
          color: positive ? '#0F9D58' : '#E0245E',
          background: positive ? 'rgba(15,157,88,0.1)' : 'rgba(224,36,94,0.1)',
        }}
      >
        {positive ? <TrendingUp className="w-3 h-3" strokeWidth={3} /> : <TrendingDown className="w-3 h-3" strokeWidth={3} />}
        {change}
      </div>
    </div>
  );
};

/* ── COMPONENTE: linha de post no ranking ── */
const TopPostRow: React.FC<{ post: TopPost }> = ({ post }) => {
  return (
    <div
      className="flex items-center gap-3 p-4 active:bg-[#FFF9EE]/70 transition-colors cursor-pointer"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div
        className="relative shrink-0 w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center"
        style={{ background: post.gradient }}
      >
        <span className="text-white font-black text-lg drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
          #{post.rank}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-bold text-[#1E1B11] leading-snug"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {post.title}
        </p>
        <div className="flex items-center gap-1 mt-1.5 text-[#5B4041]">
          <Eye className="w-3.5 h-3.5" />
          <span className="text-xs font-bold">{post.views} visualizações</span>
        </div>
      </div>
    </div>
  );
};

/* ── TELA: Dashboard de métricas ── */
const Dashboard: React.FC = () => {
  const lang = useCurrentLang();
  const [selectedDay, setSelectedDay] = useState<number>(PEAK_DAY_INDEX);

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-28">
      {/* Cabeçalho */}
      <div className="mb-6">
        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50">
          Painel de desempenho
        </span>
        <h1 className="page-title">Suas métricas</h1>
        <p className="text-sm text-[#5B4041] font-medium mt-1 leading-relaxed">
          Acompanhe o crescimento da sua conta e descubra o que está funcionando pra viralizar mais.
        </p>
      </div>

      {/* Grid de stat tiles */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {STAT_TILES.map((tile) => (
          <StatTileCard key={tile.label} tile={tile} />
        ))}
      </div>

      {/* Gráfico de visualizações */}
      <div className="viral-card p-5 mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,45,122,0.1)' }}
          >
            <BarChart3 className="w-4 h-4" style={{ color: '#BE0D3E' }} strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50 block">
              Últimos 7 dias
            </span>
            <h2 className="text-[15px] font-black tracking-tight text-[#1E1B11] leading-tight">
              Visualizações
            </h2>
          </div>
        </div>

        <div className="flex items-end justify-between gap-2 mt-2 mb-1">
          <p className="text-3xl font-black tracking-tighter text-[#1E1B11] leading-none">
            {formatViews(TOTAL_VIEWS, lang)}
          </p>
          <div
            className="inline-flex items-center gap-1 mb-0.5 px-2 py-0.5 rounded-full text-[10px] font-black"
            style={{ color: '#0F9D58', background: 'rgba(15,157,88,0.1)' }}
          >
            <TrendingUp className="w-3 h-3" strokeWidth={3} />
            +18,3%
          </div>
        </div>
        <p className="text-xs text-[#5B4041] font-medium mb-6">vs. semana anterior · toque numa barra pra ver o dia</p>

        <div className="flex items-end justify-between gap-1.5 sm:gap-2 h-36 sm:h-40">
          {WEEKLY_VIEWS.map((views, i) => {
            const heightPct = Math.max((views / MAX_VIEWS) * 100, 14);
            const isSelected = selectedDay === i;
            return (
              <button
                key={DAY_LABELS[i]}
                type="button"
                onClick={() => setSelectedDay(i)}
                className="flex-1 h-full flex flex-col items-center justify-end gap-2"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="relative w-full flex-1 flex items-end justify-center">
                  {isSelected && (
                    <span
                      className="absolute -top-7 whitespace-nowrap text-[10px] font-black text-white px-2 py-1 rounded-full z-10"
                      style={{ background: '#1E1B11' }}
                    >
                      {formatViews(views, lang)}
                    </span>
                  )}
                  <div
                    className="w-full max-w-[26px] rounded-t-lg transition-all duration-300"
                    style={{
                      height: `${heightPct}%`,
                      background: isSelected
                        ? 'linear-gradient(180deg, #BE0D3E 0%, #E06B85 100%)'
                        : 'linear-gradient(180deg, #E06B85 0%, rgba(255,90,153,0.35) 100%)',
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-black uppercase tracking-wide"
                  style={{ color: isSelected ? '#BE0D3E' : '#5B4041' }}
                >
                  {DAY_LABELS[i]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Top posts da semana */}
      <div className="mb-3">
        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50">
          Top posts
        </span>
        <h2 className="text-xl font-black tracking-tighter text-[#1E1B11] mt-1">
          Melhores da semana
        </h2>
      </div>

      <div className="viral-card overflow-hidden divide-y divide-[#BE0D3E]/10">
        {TOP_POSTS.map((post) => (
          <TopPostRow key={post.rank} post={post} />
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
