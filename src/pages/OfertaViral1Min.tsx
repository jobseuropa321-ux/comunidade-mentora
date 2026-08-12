import React, { useEffect, useState } from 'react';
import { trackAscension } from '@/lib/ascension';
import { useTranslation } from 'react-i18next';

/* ══════════════════════════════════════════════════════════════════════
   OFERTA · VIRAL EM 1 MINUTO — primeira seção da /pagb dentro do app.
   Portado de ~/Downloads/pagb-primeira-secao (index.html = fonte da verdade).

   Ordem: faixa de urgência → VSL (VTurb/ConverteAI) → trava → botão.

   ⚠️ O player é carregado de scripts.converteai.net; os domínios da
   ConverteAI/VTurb estão liberados no CSP do vercel.json (script-src,
   connect-src, frame-src). Mexeu em um, confira o outro.
   ══════════════════════════════════════════════════════════════════════ */

/* ── AJUSTES RÁPIDOS ────────────────────────────────────────────────── */
/** Trava do botão, em segundos (430 = 7min10s). */
const DELAY_SECONDS = 430;
/** Chave do localStorage que guarda a 1ª visita (o tempo NÃO zera no reload). */
const DELAY_KEY = 'vsl_first_visit_ts';
/** Os 3 IDs da VSL na ConverteAI (trocar os três ao mudar de vídeo). */
const VTURB_ACCOUNT_ID = '30c1fd3f-8014-4648-b3ff-9d8977fda8b8';
const VTURB_PLAYER_ID = '6a690216565ffb31f360a35b';
const VTURB_VIDEO_ID = '6a6901b622215083f60b5679';
/* Os textos da faixa e do botão vêm do dicionário — resolvidos dentro do
   componente, não aqui, porque t() é hook. */
/** Checkout da Hubla (vai direto pro pagamento, sem passar pela página de vendas). */
const CTA_HREF = 'https://pay.hub.la/soO8SrabzW3POhfXgl16';
/* ───────────────────────────────────────────────────────────────────── */

const VTURB_SCRIPT_SRC = `https://scripts.converteai.net/${VTURB_ACCOUNT_ID}/players/${VTURB_PLAYER_ID}/v4/player.js`;
const VTURB_M3U8 = `https://cdn.converteai.net/${VTURB_ACCOUNT_ID}/${VTURB_VIDEO_ID}/main.m3u8`;

/* Player VTurb montado FORA do React.
   O <vturb-smartplayer> se reescreve sozinho (web component) e só inicializa
   se já estiver no DOM quando o player.js roda. Deixar o React renderizá-lo
   quebra: o StrictMode monta→desmonta→remonta, o React recria o elemento
   depois do script ter rodado e o vídeo nunca aparece (ficou preto no teste).
   Por isso: div vazio no JSX + innerHTML no efeito + script depois. */
const VTurbPlayer: React.FC = () => {
  const hostRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // preload/dns-prefetch: mesma lista do <head> do index.html original
    const hints: Array<{ rel: string; href: string; as?: string }> = [
      { rel: 'preload', href: VTURB_SCRIPT_SRC, as: 'script' },
      { rel: 'preload', href: 'https://scripts.converteai.net/lib/js/smartplayer-wc/v4/smartplayer.js', as: 'script' },
      { rel: 'preload', href: VTURB_M3U8, as: 'fetch' },
      { rel: 'dns-prefetch', href: 'https://cdn.converteai.net' },
      { rel: 'dns-prefetch', href: 'https://scripts.converteai.net' },
      { rel: 'dns-prefetch', href: 'https://images.converteai.net' },
      { rel: 'dns-prefetch', href: 'https://license.vturb.com' },
    ];
    hints.forEach(({ rel, href, as }) => {
      if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
      const link = document.createElement('link');
      link.rel = rel;
      link.href = href;
      if (as) link.setAttribute('as', as);
      if (as === 'fetch') link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });

    // 1) elemento no DOM (idêntico ao markup do index.html original)
    host.innerHTML = `
      <vturb-smartplayer id="vid-${VTURB_PLAYER_ID}" style="display:block;margin:0 auto;width:100%;max-width:400px">
        <div class="vturb-player-placeholder" style="position:relative;width:100%;padding:177.77777777777777% 0 0;z-index:0;background-color:black"></div>
      </vturb-smartplayer>`;

    // 2) script depois. Se já foi carregado antes (voltar e entrar de novo),
    //    recarrega pra reinicializar o elemento novo.
    document.querySelector(`script[src="${VTURB_SCRIPT_SRC}"]`)?.remove();
    const s = document.createElement('script');
    s.src = VTURB_SCRIPT_SRC;
    s.async = true;
    document.head.appendChild(s);

    return () => { host.innerHTML = ''; };
  }, []);

  return <div ref={hostRef} />;
};

/** Trava: só renderiza os filhos DELAY_SECONDS após a 1ª visita (persistente). */
const DelayGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const delayMs = DELAY_SECONDS * 1000;

  const readStart = (): number => {
    try {
      const saved = parseInt(localStorage.getItem(DELAY_KEY) ?? '', 10);
      if (saved && !Number.isNaN(saved)) return saved;
      const now = Date.now();
      localStorage.setItem(DELAY_KEY, String(now));
      return now;
    } catch {
      return Date.now(); // modo privado do Safari pode bloquear
    }
  };

  const [unlocked, setUnlocked] = useState(() => Date.now() - readStart() >= delayMs);

  useEffect(() => {
    if (unlocked) return;

    // Só o setTimeout não basta no celular: quando a pessoa troca de app, o
    // iOS/Android congela os timers da aba e o botão nunca apareceria (ela
    // ficaria presa, já que a página não tem botão de voltar). Por isso a
    // conferência é sempre pelo RELÓGIO, em 3 gatilhos:
    //   1. timeout no tempo exato (caso normal, com a tela aberta)
    //   2. ao voltar pro app (visibilitychange/focus) — cobre o congelamento
    //   3. tique de 1s como rede de segurança
    const jaPassou = () => Date.now() - readStart() >= delayMs;
    const conferir = () => { if (jaPassou()) setUnlocked(true); };

    const timeout = window.setTimeout(conferir, Math.max(0, delayMs - (Date.now() - readStart())));
    const intervalo = window.setInterval(conferir, 1000);
    document.addEventListener('visibilitychange', conferir);
    window.addEventListener('focus', conferir);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', conferir);
      window.removeEventListener('focus', conferir);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  if (!unlocked) return null;
  return <>{children}</>;
};

const OfertaViral1Min: React.FC = () => {
  const { t } = useTranslation();
  // Passo 2 do funil: abriu a aula com a VSL. O ref evita contar duas vezes
  // no StrictMode (dev monta → desmonta → monta).
  const jaContou = React.useRef(false);
  useEffect(() => {
    if (jaContou.current) return;
    jaContou.current = true;
    trackAscension('vsl');
  }, []);

  return (
    <div className="oferta-v1m min-h-screen">
      {/* Estilos da seção — escopados em .oferta-v1m pra não vazar pro app.
          Copiados do index.html original (faixa, moldura da VSL, alpha-btn). */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap');
        .oferta-v1m{
          --accent:#FF2D7A;
          --font-head:'Poppins','Be Vietnam Pro',system-ui,-apple-system,'Segoe UI',sans-serif;
          font-family:var(--font-head); color:#1A1A1A;
          background:
            radial-gradient(120% 80% at 0% 0%, rgba(255,45,122,.06) 0%, transparent 55%),
            radial-gradient(120% 80% at 100% 0%, rgba(200,240,0,.10) 0%, transparent 55%),
            #FAF4EE;
          -webkit-font-smoothing:antialiased;
        }
        .oferta-v1m .urgency-bar{
          background:var(--accent); color:#fff; text-align:center; padding:12px 16px;
          font-weight:700; line-height:1.3; text-transform:uppercase; position:relative; z-index:5;
        }
        .oferta-v1m .urgency-bar span{
          display:block; white-space:nowrap;
          font-size:clamp(12px,3.6vw,17px); letter-spacing:.02em;
        }
        .oferta-v1m .hero{padding:20px 0 60px}
        .oferta-v1m .container{max-width:920px;margin:0 auto;padding:0 16px}
        .oferta-v1m .vsl-wrap{
          position:relative; margin:0 auto 10px; max-width:340px;
          animation:v1mFadeUp 1s ease-out forwards;
        }
        @media (max-width:780px){ .oferta-v1m .vsl-wrap{max-width:min(320px,40vh)} }
        .oferta-v1m .vsl-frame{
          border-radius:20px; overflow:hidden; background:#000;
          box-shadow:0 16px 48px rgba(0,0,0,.22);
        }
        .oferta-v1m .cta-block{
          text-align:center; margin-top:32px;
          animation:v1mFadeUp 1s ease-out .1s forwards;
        }
        @media (max-width:780px){ .oferta-v1m .cta-block{margin-top:14px} }
        .oferta-v1m .alpha-btn{
          position:relative; display:inline-flex; align-items:center; justify-content:center;
          white-space:nowrap; padding:20px 60px; border-radius:15.623px; text-decoration:none;
          cursor:pointer; font-family:var(--font-head); font-weight:700;
          font-size:clamp(16px,2vw,20px); letter-spacing:.5px; text-transform:uppercase; color:#fff;
          background:radial-gradient(67.54% 100.03% at 50% 0%, #FFEBF5 0%, #FFB5DF 25.48%, #FF2FAD 62.5%, #C7007A 100%);
          border:1.196px solid rgba(255,255,255,.4);
          box-shadow:0 5.98px 23.203px 0 rgba(255,47,173,.30), 0 14.352px 53.701px 0 rgba(255,47,173,.60);
          overflow:hidden; transition:all .5s cubic-bezier(.4,0,.2,1);
          min-width:280px; isolation:isolate;
          -webkit-box-reflect:below 2px linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,.15));
        }
        .oferta-v1m .alpha-btn::before{
          content:""; height:100%; width:100px; position:absolute; top:0; left:-150px; opacity:0;
          background:#fff; box-shadow:0 0 30px 20px #ffffffaa; transform:skewX(-20deg);
          mix-blend-mode:plus-lighter; pointer-events:none; animation:v1mGlint 3s linear infinite;
        }
        .oferta-v1m .alpha-btn:hover{filter:brightness(1.1) saturate(1.2); transform:translateY(-8px)}
        .oferta-v1m .alpha-btn:active{transform:scale(.95) translateY(-2px)}
        .oferta-v1m .alpha-btn:hover .btn-content{transform:scale(1.05)}
        .oferta-v1m .btn-content{transition:transform .5s cubic-bezier(.4,0,.2,1)}
        @media (max-width:600px){
          .oferta-v1m .alpha-btn{white-space:normal; min-width:0; max-width:300px; padding:13px 30px}
        }
        @keyframes v1mGlint{
          0%{opacity:0;left:-150px} 20%{opacity:.4} 50%{opacity:.6;left:50%} 80%{opacity:.4} 100%{opacity:0;left:150%}
        }
        @keyframes v1mFadeUp{ from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @media (prefers-reduced-motion:reduce){
          .oferta-v1m *{animation:none!important}
          .oferta-v1m .vsl-wrap,.oferta-v1m .cta-block{opacity:1!important}
        }
      `}</style>

      {/* Sem botão de voltar: decisão do produto — a aula prende a atenção
          até o fim (o botão da oferta é a saída). */}

      {/* 1) FAIXA */}
      <div className="urgency-bar">
        <span>{t('oferta.aprenda')}</span>
        <span>{t('oferta.surpresa')}</span>
      </div>

      <header className="hero">
        <div className="container">
          {/* 2) VSL */}
          <div className="vsl-wrap">
            <div className="vsl-frame">
              <VTurbPlayer />
            </div>
          </div>

          {/* 3 + 4) TRAVA → BOTÃO */}
          <DelayGate>
            <div className="cta-block">
              <a
                href={CTA_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="alpha-btn"
                onClick={() => trackAscension('cta')}
              >
                <span className="btn-content">{t('oferta.cta')}</span>
              </a>
            </div>
          </DelayGate>
        </div>
      </header>
    </div>
  );
};

export default OfertaViral1Min;
