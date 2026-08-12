import React, { useEffect, useRef, useState } from 'react';
import { Download, X, ChevronRight, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/* ═══════════════════════════════════════════════════════════════════════
 *  InstallPrompt — tutorial de instalação do PWA na 1ª visita (mobile).
 *
 *  Comportamento:
 *  - Só aparece em CELULAR (iOS/Android), nunca no desktop.
 *  - Não aparece se o app já está instalado (rodando em standalone).
 *  - Se a pessoa fechar/pular, não volta por 7 dias (localStorage).
 *  - iOS  → carrossel de prints com o passo a passo do Safari.
 *  - Android → botão "Instalar agora" que dispara a instalação NATIVA
 *    (precisa do evento beforeinstallprompt — o app precisa ser um PWA
 *    instalável: manifest + service worker + HTTPS. Os três já estão de pé
 *    em app.comunidadedigital.com.br; o manifest declara ícone 192 e 512,
 *    exigência do Chrome pra oferecer a instalação).
 *
 *  Prints em /public/install/*.webp — são os do app original. Quando
 *  quiser, tire prints do SEU app instalado e substitua os arquivos
 *  mantendo os mesmos nomes (não precisa mexer no código).
 * ═══════════════════════════════════════════════════════════════════════ */

/* Os textos vivem no dicionário; esta função monta o mesmo objeto TXT que o
   componente já usava, resolvido no idioma da URL. */
const makeTxt = (t: (k: string, o?: Record<string, unknown>) => string) => ({
  close: t('installPrompt.close'),
  before_continue: t('installPrompt.before_continue'),
  ios_headline: t('installPrompt.ios_headline'),
  ios_sub: t('installPrompt.ios_sub'),
  variant: (n: number) => t('installPrompt.variant', { n }),
  next: t('installPrompt.next'),
  done: t('installPrompt.done'),
  skip: t('installPrompt.skip'),
  android_headline: t('installPrompt.android_headline'),
  android_sub: t('installPrompt.android_sub'),
  android_install: t('installPrompt.android_install'),
  android_wait: t('installPrompt.android_wait'),
});

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

// Passos do tutorial iOS. O array guarda só os prints e o slug — título e
// legenda saem do dicionário no render.
//
// ⚠️ Os prints em public/install/*.webp mostram um iPhone EM PORTUGUÊS. A
// aluna espanhola lê a legenda em espanhol e vê a tela em português. Trocar
// isso exige refazer as capturas com o aparelho em espanhol.
const IOS_STEPS: { imgs: string[]; slug: string }[] = [
  { imgs: ['/install/ios-step1a.webp', '/install/ios-step1b.webp'], slug: 'menu' },
  { imgs: ['/install/ios-step2.webp'],                              slug: 'compartilhar' },
  { imgs: ['/install/ios-step-vermais.webp'],                       slug: 'verMais' },
  { imgs: ['/install/ios-step3.webp'],                              slug: 'adicionar' },
  { imgs: [],                                                       slug: 'confirmar' },
];

const InstallPrompt: React.FC = () => {
  const { t } = useTranslation();
  const TXT = makeTxt(t);
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
    <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-[#FFFFFF] to-[#FFF7E6]">
      {/* Topo */}
      <div className="shrink-0 px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-[#BE0D3E]">
            {TXT.before_continue}
          </p>
          <h2 className="text-[19px] font-black text-[#1E1B11] leading-tight mt-0.5">
            {android ? TXT.android_headline : TXT.ios_headline}
          </h2>
        </div>
        <button
          onClick={dismiss}
          aria-label={TXT.close}
          className="shrink-0 w-9 h-9 rounded-full bg-[#1E1B11]/5 text-[#5B4041] hover:bg-[#1E1B11]/10 flex items-center justify-center transition-colors"
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
              background: 'radial-gradient(circle at 30% 25%, #E06B85 0%, #BE0D3E 60%, #94002D 100%)',
              boxShadow: '0 12px 30px rgba(190,13,62,0.4)',
            }}
          >
            <Download size={34} className="text-white" strokeWidth={2.5} />
          </div>
          <p className="text-[14px] text-[#5B4041] font-medium leading-relaxed mb-6 max-w-xs">
            {TXT.android_sub}
          </p>
          <button
            onClick={handleAndroidInstall}
            disabled={!deferred}
            className="w-full max-w-xs px-6 py-4 rounded-2xl bg-[#F6B43A] text-[#1E1B11] text-[13px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_8px_22px_rgba(246,180,58,0.5)] disabled:opacity-50 disabled:scale-100"
          >
            {deferred ? TXT.android_install : TXT.android_wait}
          </button>
        </div>
      ) : (
        /* ───────── iOS: carrossel de prints ───────── */
        <>
          <p className="shrink-0 px-5 text-[12px] text-[#5B4041] font-medium">
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
                  <span className="w-7 h-7 rounded-lg bg-[#F6B43A] text-[#1E1B11] text-[12px] font-black flex items-center justify-center">
                    {i + 1}
                  </span>
                  <p className="text-[15px] font-black text-[#1E1B11]">{t(`installPrompt.steps.${step.slug}.title`)}</p>
                </div>

                {/* Prints */}
                {step.imgs.length > 0 ? (
                  <div className={`flex ${step.imgs.length > 1 ? 'flex-col gap-3' : ''} items-center justify-center w-full max-w-[300px]`}>
                    {step.imgs.map((src, j) => (
                      <div key={j} className="w-full">
                        {step.imgs.length > 1 && (
                          <p className="text-[9px] font-black uppercase tracking-widest text-[#BE0D3E] mb-1 text-center">
                            {TXT.variant(j + 1)}
                          </p>
                        )}
                        <img
                          src={src}
                          alt={t(`installPrompt.steps.${step.slug}.title`)}
                          loading="lazy"
                          className="w-full rounded-xl border border-[#BE0D3E]/15 shadow-[0_8px_22px_rgba(0,0,0,0.12)]"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Passo final sem print */
                  <div className="w-20 h-20 rounded-3xl bg-[#F6B43A] flex items-center justify-center my-4 shadow-[0_10px_26px_rgba(246,180,58,0.5)]">
                    <Check size={40} className="text-[#1E1B11]" strokeWidth={3} />
                  </div>
                )}

                {/* Legenda */}
                <p className="text-[12px] text-[#5B4041] leading-relaxed text-center mt-4 max-w-[300px]">
                  {t(`installPrompt.steps.${step.slug}.desc`)}
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
                  background: i === index ? '#BE0D3E' : 'rgba(190,13,62,0.25)',
                }}
              />
            ))}
          </div>

          {/* Ações */}
          <div className="shrink-0 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] space-y-2">
            {!isLast ? (
              <button
                onClick={() => goTo(index + 1)}
                className="w-full px-6 py-3.5 rounded-2xl bg-[#1E1B11] text-white text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                {TXT.next} <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={dismiss}
                className="w-full px-6 py-3.5 rounded-2xl bg-[#F6B43A] text-[#1E1B11] text-[12px] font-black uppercase tracking-widest active:scale-95 transition-transform shadow-[0_8px_22px_rgba(246,180,58,0.5)]"
              >
                {TXT.done}
              </button>
            )}
            <button
              onClick={dismiss}
              className="w-full py-2 text-[11px] font-bold text-[#5B4041] hover:text-[#1E1B11] transition-colors"
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
