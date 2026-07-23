import React, { useEffect, useRef, useState } from 'react';
import { Download, X, ChevronRight, Check } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════
 *  InstallPrompt — tutorial de instalação do PWA na 1ª visita (mobile).
 *
 *  Comportamento:
 *  - Só aparece em CELULAR (iOS/Android), nunca no desktop.
 *  - Não aparece se o app já está instalado (rodando em standalone).
 *  - Se a pessoa fechar/pular, não volta por 7 dias (localStorage).
 *  - iOS  → carrossel de prints com o passo a passo do Safari.
 *  - Android → botão "Instalar agora" que dispara a instalação NATIVA
 *    (precisa do evento beforeinstallprompt — ver LEIA-ME: o app precisa
 *    ser um PWA instalável: manifest + service worker + HTTPS).
 *
 *  Prints em /public/install/*.webp (troque pelos seus quando quiser,
 *  mantendo os mesmos nomes de arquivo).
 * ═══════════════════════════════════════════════════════════════════════ */

/* ─── TEXTOS DA TELA (toda a "escrita" daqui) ─── */
const TXT = {
  close: 'Fechar',
  before_continue: 'Antes de continuar',
  ios_headline: 'Instale o app no seu iPhone',
  ios_sub: 'Leva 10 segundos. Arraste pro lado pra ver os passos 👉',
  variant: (n: number) => `Versão ${n}`,
  next: 'Próximo',
  done: 'Entendi, já instalei',
  skip: 'Continuar sem instalar',
  android_headline: 'Instale o app no Android',
  android_sub: 'É um toque só. Instala igual um aplicativo e abre direto da tela inicial.',
  android_install: 'Instalar agora',
  android_wait: 'Preparando instalação...',
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'app_install_dismissed';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (navigator as any).standalone === true;

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
const isAndroid = () => /Android/.test(navigator.userAgent);
const isMobile = () => isIOS() || isAndroid();

const wasDismissedRecently = () => {
  const raw = localStorage.getItem(DISMISSED_KEY);
  if (!raw) return false;
  const ts = parseInt(raw, 10);
  if (isNaN(ts)) return false;
  return Date.now() - ts < DISMISS_TTL_MS;
};

// Passos do tutorial iOS — cada um com 1+ prints, título e legenda
const IOS_STEPS: { imgs: string[]; title: string; desc: string }[] = [
  {
    imgs: ['/install/ios-step1a.webp', '/install/ios-step1b.webp'],
    title: 'Abra o menu do Safari',
    desc: 'Depende do seu iPhone: toque no "•••" na barra OU no ícone de compartilhar. Use a versão que aparecer no seu aparelho.',
  },
  {
    imgs: ['/install/ios-step2.webp'],
    title: 'Toque em "Compartilhar"',
    desc: 'No menu que abrir, toque na opção Compartilhar.',
  },
  {
    imgs: ['/install/ios-step-vermais.webp'],
    title: 'Toque em "Ver Mais"',
    desc: 'Se não achar a opção de adicionar, role pra baixo e toque em Ver Mais.',
  },
  {
    imgs: ['/install/ios-step3.webp'],
    title: 'Adicionar à Tela de Início',
    desc: 'Toque em "Adicionar à Tela de Início".',
  },
  {
    imgs: [],
    title: 'Toque em "Adicionar"',
    desc: 'Por último, é só tocar em Adicionar (canto superior) e o app vai estar na sua tela inicial! 🎉',
  },
];

const InstallPrompt: React.FC = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently() || !isMobile()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Abre a tela cheia na primeira visita (iOS sempre; Android também,
    // com botão de instalar nativo).
    setOpen(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setOpen(false);
  };

  const handleAndroidInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === 'accepted') setOpen(false);
  };

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  const goTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  if (!open) return null;

  const android = isAndroid();
  const total = IOS_STEPS.length;
  const isLast = index >= total - 1;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-[#FFFFFF] to-[#FFF4E6]">
      {/* Topo */}
      <div className="shrink-0 px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-[#FF2D7A]">
            {TXT.before_continue}
          </p>
          <h2 className="text-[19px] font-black text-[#1A1A1A] leading-tight mt-0.5">
            {android ? TXT.android_headline : TXT.ios_headline}
          </h2>
        </div>
        <button
          onClick={dismiss}
          aria-label={TXT.close}
          className="shrink-0 w-9 h-9 rounded-full bg-[#1A1A1A]/5 text-[#6E6E6E] hover:bg-[#1A1A1A]/10 flex items-center justify-center transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {android ? (
        /* ───────── ANDROID: instala sozinho ───────── */
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
            style={{
              background: 'radial-gradient(circle at 30% 25%, #FF5A99 0%, #FF2D7A 60%, #C01B5C 100%)',
              boxShadow: '0 12px 30px rgba(255,45,122,0.4)',
            }}
          >
            <Download size={34} className="text-white" strokeWidth={2.5} />
          </div>
          <p className="text-[14px] text-[#6E6E6E] font-medium leading-relaxed mb-6 max-w-xs">
            {TXT.android_sub}
          </p>
          <button
            onClick={handleAndroidInstall}
            disabled={!deferred}
            className="w-full max-w-xs px-6 py-4 rounded-2xl bg-[#C8F000] text-[#1A1A1A] text-[13px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_8px_22px_rgba(200,240,0,0.5)] disabled:opacity-50 disabled:scale-100"
          >
            {deferred ? TXT.android_install : TXT.android_wait}
          </button>
        </div>
      ) : (
        /* ───────── iOS: carrossel de prints ───────── */
        <>
          <p className="shrink-0 px-5 text-[12px] text-[#6E6E6E] font-medium">
            {TXT.ios_sub}
          </p>

          <div
            ref={scrollerRef}
            onScroll={onScroll}
            className="flex-1 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: 'none' }}
          >
            {IOS_STEPS.map((step, i) => (
              <div key={i} className="snap-center shrink-0 w-full h-full px-5 flex flex-col items-center justify-center">
                {/* Número do passo */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-7 h-7 rounded-lg bg-[#C8F000] text-[#1A1A1A] text-[12px] font-black flex items-center justify-center">
                    {i + 1}
                  </span>
                  <p className="text-[15px] font-black text-[#1A1A1A]">{step.title}</p>
                </div>

                {/* Prints */}
                {step.imgs.length > 0 ? (
                  <div className={`flex ${step.imgs.length > 1 ? 'flex-col gap-3' : ''} items-center justify-center w-full max-w-[300px]`}>
                    {step.imgs.map((src, j) => (
                      <div key={j} className="w-full">
                        {step.imgs.length > 1 && (
                          <p className="text-[9px] font-black uppercase tracking-widest text-[#FF2D7A] mb-1 text-center">
                            {TXT.variant(j + 1)}
                          </p>
                        )}
                        <img
                          src={src}
                          alt={step.title}
                          loading="lazy"
                          className="w-full rounded-xl border border-[#FF2D7A]/15 shadow-[0_8px_22px_rgba(0,0,0,0.12)]"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Passo final sem print */
                  <div className="w-20 h-20 rounded-3xl bg-[#C8F000] flex items-center justify-center my-4 shadow-[0_10px_26px_rgba(200,240,0,0.5)]">
                    <Check size={40} className="text-[#1A1A1A]" strokeWidth={3} />
                  </div>
                )}

                {/* Legenda */}
                <p className="text-[12px] text-[#6E6E6E] leading-relaxed text-center mt-4 max-w-[300px]">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Dots */}
          <div className="shrink-0 flex items-center justify-center gap-1.5 py-3">
            {IOS_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`${i + 1}`}
                className="rounded-full transition-all"
                style={{
                  width: i === index ? 20 : 7,
                  height: 7,
                  background: i === index ? '#FF2D7A' : 'rgba(255,45,122,0.25)',
                }}
              />
            ))}
          </div>

          {/* Ações */}
          <div className="shrink-0 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] space-y-2">
            {!isLast ? (
              <button
                onClick={() => goTo(index + 1)}
                className="w-full px-6 py-3.5 rounded-2xl bg-[#1A1A1A] text-white text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                {TXT.next} <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={dismiss}
                className="w-full px-6 py-3.5 rounded-2xl bg-[#C8F000] text-[#1A1A1A] text-[12px] font-black uppercase tracking-widest active:scale-95 transition-transform shadow-[0_8px_22px_rgba(200,240,0,0.5)]"
              >
                {TXT.done}
              </button>
            )}
            <button
              onClick={dismiss}
              className="w-full py-2 text-[11px] font-bold text-[#6E6E6E] hover:text-[#1A1A1A] transition-colors"
            >
              {TXT.skip}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default InstallPrompt;
