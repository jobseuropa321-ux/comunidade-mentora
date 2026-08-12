import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import { useAllModules, type Module } from '@/hooks/useCourses';
import BannerCarousel from '@/components/BannerCarousel';
import { trackAscension } from '@/lib/ascension';
import { useLocalizedNavigate, useCurrentLang, localizedPath } from '@/i18n/LanguageProvider';
import { useTranslation } from 'react-i18next';

// Pra adicionar/trocar banner: jogue o .webp em `public/covers/` e adicione aqui.
// Slots sem arquivo somem do carrossel (BannerCarousel filtra 404).
// Opcional: `href` pra deixar o banner clicável.
// O array fica NEUTRO: só o arquivo. O texto alternativo é resolvido no render
// pelo dicionário — duplicar o array por idioma foi a armadilha nº 1 do kit.
const HOME_BANNERS = [
  { src: '/covers/banner-1.webp', altKey: 'home.bannerAlt1' },
  { src: '/covers/banner-2.webp', altKey: 'home.bannerAlt2' },
];

/* ── PLACEHOLDER DE IMAGEM ──
   Slot vazio que sinaliza "aqui entra uma imagem" (ícone + borda tracejada).
   Temporário: troque pelas imagens reais quando estiverem prontas. */
const ImagePlaceholder: React.FC<{ label?: string; iconSize?: number; className?: string }> = ({
  label,
  iconSize = 30,
  className = '',
}) => (
  <div className={`relative flex flex-col items-center justify-center gap-2 bg-[#FFF9EE] ${className}`}>
    <div className="absolute inset-2 rounded-xl border border-dashed border-[#BE0D3E]/25 pointer-events-none" />
    <ImageIcon size={iconSize} strokeWidth={1.5} className="text-[#BE0D3E]/30" />
    <span className="text-[10px] font-bold uppercase tracking-widest text-[#5B4041]/35 select-none">{label ?? ''}</span>
  </div>
);

/* ── CARD ── */
const ModuleCard: React.FC<{ modulo: Module; priority?: boolean }> = ({ modulo, priority = false }) => {
  const navigate = useLocalizedNavigate();
  const { t } = useTranslation();
  return (
    <div
      onClick={() => navigate(`/modulo/${modulo.slug}`)}
      className="min-w-[148px] h-[200px] rounded-[1rem] border border-[#BE0D3E]/20 relative overflow-hidden shrink-0 shadow-[0_8px_20px_rgba(255,45,122,0.12)] bg-[#FFF9EE] cursor-pointer active:scale-[0.97] transition-transform"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {modulo.cover_url ? (
        <img
          src={modulo.cover_url}
          alt={`${modulo.title1} ${modulo.title2}`}
          className="absolute inset-0 w-full h-full object-cover z-0 bg-[#FFF9EE]"
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          // @ts-expect-error fetchpriority é suportado em browsers modernos
          fetchpriority={priority ? 'high' : 'auto'}
          draggable={false}
        />
      ) : (
        // Capa vazia por enquanto — placeholder sinalizando que aqui entra uma imagem.
        <ImagePlaceholder className="absolute inset-0 z-0 h-full w-full" iconSize={30} label={t('home.capa')} />
      )}
      {modulo.tag && modulo.tag_color && (
        <span
          className="absolute top-2 right-2 z-30 text-[8px] font-black uppercase tracking-widest text-white px-1.5 py-0.5 rounded-md"
          style={{ background: modulo.tag_color }}
        >
          {modulo.tag}
        </span>
      )}
    </div>
  );
};

const HorizontalCardList: React.FC<{ modules: Module[]; priorityCount?: number }> = ({ modules, priorityCount = 0 }) => (
  <div
    className="flex gap-3 overflow-x-auto pb-2 px-4"
    style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
  >
    {modules.map((m, i) => <ModuleCard key={m.id} modulo={m} priority={i < priorityCount} />)}
    <div className="w-1 shrink-0" />
  </div>
);

const Home: React.FC = () => {
  const { modules, loading } = useAllModules();
  const { t } = useTranslation();
  const lang = useCurrentLang();

  const inicio = modules.filter(m => m.home_section === 'inicio');
  const main = modules.filter(m => m.home_section === 'modulos');
  const materiais = modules.filter(m => m.home_section === 'materiais');

  return (
    <div className="pb-28">
      {/* Banner — placeholder vazio por enquanto (full bleed).
          Pra reativar o carrossel real, troque pela linha comentada abaixo. */}
      <section className="mb-5 -mt-1">
        <BannerCarousel banners={HOME_BANNERS.map(b => ({ src: b.src, alt: t(b.altKey) }))} autoRotateMs={6000} height={180} heightDesktop={360} />
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-7 h-7 text-[#BE0D3E] animate-spin" />
        </div>
      ) : (
        <>
          {inicio.length > 0 && (
            <section className="mb-6">
              <div className="px-4 mb-3">
                <h2 className="font-black text-[11px] tracking-widest text-[#5B4041] uppercase">{t('home.comecePorAqui')}</h2>
              </div>
              <HorizontalCardList modules={inicio} priorityCount={3} />
            </section>
          )}

          {main.length > 0 && (
            <section className="mb-4">
              <div className="px-4 mb-3">
                <h2 className="font-black text-[11px] tracking-widest text-[#5B4041] uppercase">{t('home.modulos')}</h2>
              </div>
              <HorizontalCardList modules={main} />
            </section>
          )}

          {/* Ferramentas — módulos da seção "materiais" do admin (o valor no
              banco continua 'materiais'; só o nome exibido mudou). */}
          {materiais.length > 0 && (
            <section className="mb-4">
              <div className="px-4 mb-3">
                <h2 className="font-black text-[11px] tracking-widest text-[#5B4041] uppercase">{t('home.ferramentas')}</h2>
              </div>
              <HorizontalCardList modules={materiais} />
            </section>
          )}

          {/* Ferramentas avançadas — upsell do Viral 1 Min (produto irmão).
              O card é fixo aqui (o módulo tem home_section NULL de propósito,
              pra não cair junto das fileiras normais). Abre o módulo, que tem
              a aula levando pra oferta com a VSL — tudo dentro do app. */}
          <section className="mb-4">
            <div className="px-4 mb-3">
              <h2 className="font-black text-[11px] tracking-widest text-[#5B4041] uppercase">{t('home.ferramentasAvancadas')}</h2>
            </div>
            <div
              className="flex gap-3 overflow-x-auto pb-2 px-4"
              style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
            >
              <Link
                to={localizedPath("/modulo/viral-em-1-minuto", lang)}
                onClick={() => trackAscension('modulo')}
                className="min-w-[148px] h-[200px] rounded-[1rem] border border-[#BE0D3E]/20 relative overflow-hidden shrink-0 shadow-[0_8px_20px_rgba(255,45,122,0.12)] bg-[#FFF9EE] cursor-pointer active:scale-[0.97] transition-transform block"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <img
                  src="/covers/upsell-viral1min.webp"
                  alt={t('home.upsellAlt')}
                  className="absolute inset-0 w-full h-full object-cover z-0"
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              </Link>
              <div className="w-1 shrink-0" />
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Home;
