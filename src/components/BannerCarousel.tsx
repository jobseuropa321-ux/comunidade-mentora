import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentLang, localizedPath } from '@/i18n/LanguageProvider';

export interface BannerSlide {
  src: string;
  /** Fonte alternativa para desktop (>=768px). Se omitida, usa `src`. */
  srcDesktop?: string;
  alt: string;
  href?: string;
}

interface Props {
  banners: BannerSlide[];
  autoRotateMs?: number;
  /** altura mobile (px). Default 180. */
  height?: number;
  /** altura desktop (px). Se omitida, usa height. */
  heightDesktop?: number;
}

const BannerImg: React.FC<{
  b: BannerSlide;
  height: number;
  heightDesktop?: number;
  loading?: 'eager' | 'lazy';
  onError: (src: string) => void;
}> = ({ b, height, heightDesktop, loading = 'lazy', onError }) => (
  <picture>
    {b.srcDesktop && (
      <source media="(min-width: 768px)" srcSet={b.srcDesktop} />
    )}
    <img
      src={b.src}
      alt={b.alt}
      className="w-full object-cover object-center"
      style={{
        height,
        // @ts-expect-error CSS custom property for desktop override
        '--banner-h-desktop': heightDesktop ? `${heightDesktop}px` : `${height}px`,
      }}
      loading={loading}
      draggable={false}
      onError={() => onError(b.src)}
    />
  </picture>
);


/* Envolve o slide no link certo: caminho começando com "/" é rota do app
   (navega sem recarregar); o resto é link externo e abre em outra aba. */
const BannerLink: React.FC<{ href: string; className?: string; children: React.ReactNode }> = ({ href, className, children }) => {
  const lang = useCurrentLang();
  return href.startsWith('/')
    ? <Link to={localizedPath(href, lang)} className={className}>{children}</Link>
    : <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
};

const BannerCarousel: React.FC<Props> = ({ banners: rawBanners, autoRotateMs = 6000, height = 180, heightDesktop }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const userInteractingRef = useRef(false);
  const interactionTimeoutRef = useRef<number | null>(null);

  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(new Set());
  const banners = rawBanners.filter(b => !failedSrcs.has(b.src));

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      if (userInteractingRef.current) return;
      setActiveIdx(prev => {
        const next = (prev + 1) % banners.length;
        scrollToIdx(next, 'smooth');
        return next;
      });
    }, autoRotateMs);
    return () => clearInterval(interval);
  }, [banners.length, autoRotateMs]);

  const scrollToIdx = (idx: number, behavior: ScrollBehavior = 'smooth') => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior });
  };

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== activeIdx) setActiveIdx(idx);
  };

  const markUserInteracting = () => {
    userInteractingRef.current = true;
    if (interactionTimeoutRef.current) window.clearTimeout(interactionTimeoutRef.current);
    interactionTimeoutRef.current = window.setTimeout(() => {
      userInteractingRef.current = false;
    }, 8000);
  };

  const handleDotClick = (idx: number) => {
    markUserInteracting();
    setActiveIdx(idx);
    scrollToIdx(idx);
  };

  const handleImgError = (src: string) => {
    setFailedSrcs(prev => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  };

  if (banners.length === 0) return null;

  if (banners.length === 1) {
    const b = banners[0];
    const Wrapper = b.href ? ({ children }: { children: React.ReactNode }) => <BannerLink href={b.href!}>{children}</BannerLink> : React.Fragment;
    return (
      <div className="w-full overflow-hidden banner-carousel-container">
        <Wrapper>
          <BannerImg b={b} height={height} heightDesktop={heightDesktop} loading="eager" onError={handleImgError} />
        </Wrapper>
      </div>
    );
  }

  return (
    <div className="relative w-full banner-carousel-container">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        onTouchStart={markUserInteracting}
        onMouseDown={markUserInteracting}
        className="flex w-full overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      >
        {banners.map((b, i) => (
          <div key={b.src} className="snap-start shrink-0 w-full">
            {b.href ? (
              <BannerLink href={b.href} className="block">
                <BannerImg b={b} height={height} heightDesktop={heightDesktop} loading={i === 0 ? 'eager' : 'lazy'} onError={handleImgError} />
              </BannerLink>
            ) : (
              <BannerImg b={b} height={height} heightDesktop={heightDesktop} loading={i === 0 ? 'eager' : 'lazy'} onError={handleImgError} />
            )}
          </div>
        ))}
      </div>

      {/* Dots */}
      <div className="flex justify-center items-center gap-1.5 mt-2.5">
        {banners.map((_, i) => (
          <button
            key={i}
            onClick={() => handleDotClick(i)}
            aria-label={`Ir pro banner ${i + 1}`}
            className="transition-all"
            style={{
              width: i === activeIdx ? 18 : 6,
              height: 6,
              borderRadius: 999,
              background: i === activeIdx ? '#BE0D3E' : '#BE0D3E40',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default BannerCarousel;
