import React from 'react';
import { motion } from 'framer-motion';

/* ══════════════════════════════════════════════════════════════
   Ilustrações SVG animadas do onboarding (/onboarding).
   Tudo com framer-motion em cima de <svg> puro: traço que se desenha
   (pathLength), órbitas, brilhos piscando. Sem imagem pesada, sem lib nova.
   Quem monta envolve a página em <MotionConfig reducedMotion="user">.
   ══════════════════════════════════════════════════════════════ */

const VERMELHO = '#BE0D3E';
const VINHO = '#94002D';
const ROSA = '#E06B85';
const OURO = '#F6B43A';

const desenha = (delay = 0, duration = 1.1) => ({
  initial: { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1 },
  transition: { pathLength: { delay, duration, ease: 'easeInOut' as const }, opacity: { delay, duration: 0.2 } },
});

/* Estrelinha de 4 pontas que pisca */
const Brilho: React.FC<{ x: number; y: number; s?: number; cor?: string; delay?: number }> = ({ x, y, s = 1, cor = OURO, delay = 0 }) => (
  <motion.path
    d="M0 -10 C1.5 -2 2 -1.5 10 0 C2 1.5 1.5 2 0 10 C-1.5 2 -2 1.5 -10 0 C-2 -1.5 -1.5 -2 0 -10Z"
    fill={cor}
    style={{ x, y }}
    initial={{ scale: 0, rotate: 0, opacity: 0 }}
    animate={{ scale: [0, s, s * 0.6, s], rotate: [0, 90, 90, 180], opacity: [0, 1, 0.6, 1] }}
    transition={{ delay, duration: 2.4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
  />
);

/* ── Boas-vindas: logo no centro, anéis se desenhando, bolinhas em órbita ── */
export const ArteBoasVindas: React.FC = () => (
  <div className="relative w-[220px] h-[220px] mx-auto">
    <svg viewBox="-110 -110 220 220" className="absolute inset-0 w-full h-full overflow-visible">
      <defs>
        <linearGradient id="ob-anel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={ROSA} />
          <stop offset="55%" stopColor={VERMELHO} />
          <stop offset="100%" stopColor={OURO} />
        </linearGradient>
        <radialGradient id="ob-halo">
          <stop offset="0%" stopColor={OURO} stopOpacity="0.45" />
          <stop offset="100%" stopColor={OURO} stopOpacity="0" />
        </radialGradient>
      </defs>

      <motion.circle r="100" fill="url(#ob-halo)"
        animate={{ scale: [0.9, 1.05, 0.9] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />

      <motion.circle r="92" fill="none" stroke="url(#ob-anel)" strokeWidth="2" strokeDasharray="4 8" strokeLinecap="round"
        initial={{ rotate: 0, opacity: 0 }} animate={{ rotate: 360, opacity: 1 }}
        transition={{ rotate: { duration: 40, repeat: Infinity, ease: 'linear' }, opacity: { duration: 0.6 } }} />
      <motion.circle r="74" fill="none" stroke="url(#ob-anel)" strokeWidth="3" strokeLinecap="round" {...desenha(0.15, 1.4)} />
      <motion.circle r="60" fill="none" stroke={VERMELHO} strokeOpacity="0.18" strokeWidth="10" {...desenha(0.4, 1.2)} />

      {/* órbitas */}
      {[
        { r: 74, dur: 7, cor: OURO, tam: 6 },
        { r: 92, dur: 11, cor: VERMELHO, tam: 5 },
        { r: 74, dur: 9, cor: ROSA, tam: 4, rev: true },
      ].map((o, i) => (
        <motion.g key={i} initial={{ rotate: i * 120 }} animate={{ rotate: i * 120 + (o.rev ? -360 : 360) }}
          transition={{ duration: o.dur, repeat: Infinity, ease: 'linear' }}>
          {/* pivô invisível: o framer gira o <g> em volta do centro da caixa dele */}
          <circle r={o.r + o.tam} fill="none" />
          <circle cx={o.r} cy="0" r={o.tam} fill={o.cor} />
        </motion.g>
      ))}

      <Brilho x={-82} y={-62} s={1.1} delay={0.6} />
      <Brilho x={86} y={-40} s={0.7} cor={ROSA} delay={1.1} />
      <Brilho x={70} y={78} s={0.9} delay={1.6} />
      <Brilho x={-90} y={52} s={0.6} cor={VERMELHO} delay={0.9} />
    </svg>

    <motion.img src="/logo-icon.png" alt=""
      className="absolute left-1/2 top-1/2 w-[104px] h-[104px] -ml-[52px] -mt-[52px] rounded-full object-cover"
      style={{ boxShadow: '0 18px 40px -14px rgba(190,13,62,0.7)' }}
      initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
      transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 12 }} />

    {/* mãozinha acenando */}
    <motion.span className="absolute right-3 top-6 text-[34px] select-none" aria-hidden
      style={{ originX: 0.7, originY: 0.9 }}
      initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, 18, -8, 18, -4, 12, 0] }}
      transition={{ scale: { delay: 0.9, type: 'spring' }, rotate: { delay: 1.1, duration: 1.6, repeat: Infinity, repeatDelay: 2.2 } }}>
      👋
    </motion.span>
  </div>
);

/* ── Foto: aro tracejado girando em volta do avatar; enviando = arco
      correndo; pronto = anel dourado fechando + selo de check ── */
export const AroFoto: React.FC<{ estado: 'vazio' | 'enviando' | 'ok'; children: React.ReactNode }> = ({ estado, children }) => (
  <div className="relative w-[200px] h-[200px] mx-auto">
    <svg viewBox="-100 -100 200 200" className="absolute inset-0 w-full h-full overflow-visible">
      <defs>
        <linearGradient id="ob-foto" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={OURO} />
          <stop offset="50%" stopColor="#FBC85F" />
          <stop offset="100%" stopColor={OURO} />
        </linearGradient>
      </defs>

      {estado !== 'ok' && (
        <motion.circle r="94" fill="none" stroke={VERMELHO} strokeOpacity="0.45" strokeWidth="3"
          strokeDasharray="10 12" strokeLinecap="round"
          animate={{ rotate: 360 }} transition={{ duration: 14, repeat: Infinity, ease: 'linear' }} />
      )}

      {estado === 'enviando' && (
        <motion.circle r="94" fill="none" stroke={VERMELHO} strokeWidth="5" strokeLinecap="round"
          strokeDasharray="120 480"
          animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
      )}

      {estado === 'ok' && (
        <>
          <motion.circle r="94" fill="none" stroke="url(#ob-foto)" strokeWidth="6" strokeLinecap="round"
            style={{ rotate: -90 }} {...desenha(0, 0.8)} />
          {/* raios de "flash" */}
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <motion.line key={i}
                x1={Math.cos(a) * 104} y1={Math.sin(a) * 104} x2={Math.cos(a) * 118} y2={Math.sin(a) * 118}
                stroke={i % 2 ? VERMELHO : OURO} strokeWidth="4" strokeLinecap="round"
                initial={{ opacity: 0, pathLength: 0 }} animate={{ opacity: [0, 1, 0], pathLength: [0, 1, 1] }}
                transition={{ delay: 0.6, duration: 0.9 }} />
            );
          })}
        </>
      )}
    </svg>

    <div className="absolute inset-[16px] rounded-full overflow-hidden">{children}</div>

    {estado === 'ok' && (
      <motion.div className="absolute bottom-2 right-2 w-12 h-12 rounded-full flex items-center justify-center border-4 border-[#FFF9EE]"
        style={{ background: `linear-gradient(135deg, ${VERMELHO}, ${VINHO})` }}
        initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.7, type: 'spring', stiffness: 260, damping: 12 }}>
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"
            {...desenha(0.95, 0.45)} />
        </svg>
      </motion.div>
    )}
  </div>
);

/* Silhueta + câmera piscando (dentro do aro, quando ainda não tem foto) */
export const SemFoto: React.FC = () => (
  <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #FFF3D6, #F6D6DC)' }}>
    <svg viewBox="0 0 100 100" className="w-[70%] h-[70%]">
      <motion.circle cx="50" cy="38" r="16" fill="none" stroke={VERMELHO} strokeOpacity="0.5" strokeWidth="3" {...desenha(0.1, 0.8)} />
      <motion.path d="M20 86c4-17 16-25 30-25s26 8 30 25" fill="none" stroke={VERMELHO} strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round"
        {...desenha(0.5, 0.8)} />
      <motion.g initial={{ scale: 0 }} animate={{ scale: [1, 1.08, 1] }}
        transition={{ scale: { delay: 1, duration: 1.6, repeat: Infinity } }}>
        <circle cx="74" cy="70" r="16" fill={VERMELHO} />
        <rect x="64" y="64" width="20" height="13" rx="3" fill="none" stroke="white" strokeWidth="2.2" />
        <path d="M70 64l2-3h4l2 3" fill="none" stroke="white" strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="74" cy="70.5" r="3.4" fill="none" stroke="white" strokeWidth="2.2" />
      </motion.g>
    </svg>
  </div>
);

/* ── Instagram: avatar ←→ ícone do Insta ligados por um fio que corre.
      Quando o @ é válido o fio fecha e aparece o check no meio ── */
export const ArteInsta: React.FC<{ avatarUrl?: string | null; ligado: boolean }> = ({ avatarUrl, ligado }) => (
  <div className="relative w-full max-w-[300px] h-[120px] mx-auto">
    <svg viewBox="0 0 300 120" className="absolute inset-0 w-full h-full overflow-visible">
      <defs>
        <linearGradient id="ob-insta" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#FEDA75" />
          <stop offset="30%" stopColor="#FA7E1E" />
          <stop offset="60%" stopColor="#D62976" />
          <stop offset="85%" stopColor="#962FBF" />
          <stop offset="100%" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>

      {/* fio */}
      <motion.path d="M88 60 C130 20, 170 100, 212 60" fill="none"
        stroke={ligado ? VERMELHO : '#E8C4CC'} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={ligado ? '0' : '2 10'}
        animate={ligado ? { pathLength: [0, 1] } : { strokeDashoffset: [0, -24] }}
        transition={ligado ? { duration: 0.6 } : { duration: 0.9, repeat: Infinity, ease: 'linear' }} />

      {/* ícone do Instagram desenhado */}
      <g transform="translate(212 20)">
        <motion.rect x="4" y="4" width="72" height="72" rx="22" fill="none" stroke="url(#ob-insta)" strokeWidth="7" {...desenha(0.1, 1)} />
        <motion.circle cx="40" cy="40" r="16" fill="none" stroke="url(#ob-insta)" strokeWidth="7" {...desenha(0.6, 0.7)} />
        <motion.circle cx="59" cy="21" r="4.5" fill="#D62976"
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2, type: 'spring' }} />
      </g>

      {ligado && (
        <motion.g initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.45, type: 'spring', stiffness: 300, damping: 12 }}
>
          <circle cx="150" cy="60" r="15" fill={OURO} stroke="#FFF9EE" strokeWidth="3" />
          <motion.path d="M143 60.5l4.5 4.5 9-9.5" fill="none" stroke="#1E1B11" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            {...desenha(0.6, 0.35)} />
        </motion.g>
      )}
    </svg>

    {/* avatar à esquerda (HTML por causa do object-fit) */}
    <motion.div className="absolute left-0 top-[20px] w-[80px] h-[80px] rounded-full p-[3px]"
      style={{ background: `linear-gradient(135deg, ${OURO}, ${VERMELHO})` }}
      initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }}>
      {avatarUrl
        ? <img src={avatarUrl} alt="" className="w-full h-full rounded-full object-cover border-2 border-white" />
        : <div className="w-full h-full rounded-full bg-[#F6D6DC] border-2 border-white" />}
    </motion.div>
  </div>
);

/* ── Ilustrações pequenas das perguntas (96px) ── */
const Moldura: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div className="w-[96px] h-[96px] rounded-[28px] flex items-center justify-center"
    style={{ background: 'linear-gradient(150deg, #FFFFFF, #FFF3D6)', boxShadow: '0 14px 30px -16px rgba(190,13,62,0.55), inset 0 0 0 1px rgba(190,13,62,0.08)' }}
    initial={{ scale: 0.5, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
    transition={{ type: 'spring', stiffness: 220, damping: 14 }}>
    <svg viewBox="0 0 64 64" className="w-[64px] h-[64px] overflow-visible">{children}</svg>
  </motion.div>
);

/** Profissão: tesoura abrindo e fechando + brilho */
export const ArteProfissao: React.FC = () => (
  <Moldura>
    <motion.g animate={{ rotate: [0, -14, 0] }}
      transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.6, ease: 'easeInOut' }}>
      <circle cx="32" cy="30" r="30" fill="none" />
      <motion.path d="M32 30 L50 10" stroke={VERMELHO} strokeWidth="4.5" strokeLinecap="round" {...desenha(0.1, 0.5)} />
      <motion.circle cx="22" cy="44" r="8" fill="none" stroke={VERMELHO} strokeWidth="4.5" {...desenha(0.3, 0.5)} />
      <path d="M32 30 L26 38" stroke={VERMELHO} strokeWidth="4.5" strokeLinecap="round" />
    </motion.g>
    <motion.g animate={{ rotate: [0, 14, 0] }}
      transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.6, ease: 'easeInOut' }}>
      <circle cx="32" cy="30" r="30" fill="none" />
      <motion.path d="M32 30 L14 10" stroke={VINHO} strokeWidth="4.5" strokeLinecap="round" {...desenha(0.2, 0.5)} />
      <motion.circle cx="42" cy="44" r="8" fill="none" stroke={VINHO} strokeWidth="4.5" {...desenha(0.4, 0.5)} />
      <path d="M32 30 L38 38" stroke={VINHO} strokeWidth="4.5" strokeLinecap="round" />
    </motion.g>
    <circle cx="32" cy="30" r="2.6" fill={OURO} />
    <Brilho x={54} y={50} s={0.5} delay={0.5} />
  </Moldura>
);

/** Tempo na área: ampulheta com areia caindo e virando */
export const ArteTempo: React.FC = () => (
  <Moldura>
    <defs>
      <clipPath id="ob-ampulheta-cima"><path d="M18 10 H46 L32 32 Z" /></clipPath>
      <clipPath id="ob-ampulheta-baixo"><path d="M32 32 L46 54 H18 Z" /></clipPath>
    </defs>
    <motion.g animate={{ rotate: [0, 0, 180] }}
      transition={{ duration: 3.4, times: [0, 0.82, 1], repeat: Infinity, ease: 'easeInOut' }}>
      <g clipPath="url(#ob-ampulheta-cima)">
        <motion.rect x="14" width="36" height="30" fill={OURO}
          animate={{ y: [12, 32, 32] }} transition={{ duration: 3.4, times: [0, 0.82, 1], repeat: Infinity, ease: 'linear' }} />
      </g>
      <g clipPath="url(#ob-ampulheta-baixo)">
        <motion.rect x="14" width="36" height="30" fill={OURO}
          animate={{ y: [54, 34, 34] }} transition={{ duration: 3.4, times: [0, 0.82, 1], repeat: Infinity, ease: 'linear' }} />
      </g>
      <motion.line x1="32" y1="32" x2="32" y2="52" stroke={OURO} strokeWidth="1.6" strokeDasharray="2 3"
        animate={{ strokeDashoffset: [0, -10], opacity: [1, 1, 0] }} transition={{ duration: 3.4, times: [0, 0.8, 0.82], repeat: Infinity, ease: 'linear' }} />
      <motion.path d="M18 10 H46 L32 32 L46 54 H18 L32 32 Z" fill="none" stroke={VERMELHO} strokeWidth="3.5" strokeLinejoin="round" {...desenha(0.1, 0.9)} />
      <path d="M14 8 H50 M14 56 H50" stroke={VINHO} strokeWidth="4.5" strokeLinecap="round" />
    </motion.g>
  </Moldura>
);

/** Objetivo: alvo se desenhando + flecha cravando no centro */
export const ArteObjetivo: React.FC = () => (
  <Moldura>
    <motion.circle cx="30" cy="34" r="22" fill="none" stroke={VERMELHO} strokeWidth="4" {...desenha(0, 0.7)} />
    <motion.circle cx="30" cy="34" r="14" fill="none" stroke={ROSA} strokeWidth="4" {...desenha(0.2, 0.6)} />
    <motion.circle cx="30" cy="34" r="6" fill={OURO} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: 'spring' }}
/>
    <motion.g initial={{ x: 30, y: -30, opacity: 0 }} animate={{ x: 0, y: 0, opacity: 1 }}
      transition={{ delay: 0.8, type: 'spring', stiffness: 380, damping: 16 }}>
      <motion.g animate={{ rotate: [0, -3, 3, 0] }} transition={{ delay: 1.1, duration: 0.35 }}>
        <path d="M30 34 L56 8" stroke={VINHO} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M50 6 L58 6 L58 14 M46 10 L54 10 L54 18" fill="none" stroke={OURO} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
    </motion.g>
  </Moldura>
);

/** Expectativa: foguete flutuando com chama piscando */
export const ArteExpectativa: React.FC = () => (
  <Moldura>
    <motion.g animate={{ y: [0, -4, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
      <g transform="rotate(35 32 32)">
        <motion.path d="M32 6 C42 14 44 28 42 40 H22 C20 28 22 14 32 6Z" fill="white" stroke={VERMELHO} strokeWidth="3.5" strokeLinejoin="round"
          {...desenha(0, 0.9)} />
        <circle cx="32" cy="22" r="5" fill={OURO} stroke={VINHO} strokeWidth="2.5" />
        <path d="M22 32 L14 42 L22 40 M42 32 L50 42 L42 40" fill={ROSA} stroke={VERMELHO} strokeWidth="2.5" strokeLinejoin="round" />
        <motion.path d="M26 42 Q32 60 38 42 Z" fill={OURO}
          animate={{ scaleY: [1, 1.35, 0.9, 1.25, 1] }} transition={{ duration: 0.5, repeat: Infinity }}
          style={{ originY: 0 }} />
      </g>
    </motion.g>
    <Brilho x={10} y={14} s={0.45} delay={0.2} />
    <Brilho x={56} y={50} s={0.4} cor={ROSA} delay={0.8} />
  </Moldura>
);

/* ── Fim: check gigante se desenhando + estouro de raios ── */
export const ArteConcluido: React.FC = () => (
  <div className="relative w-[150px] h-[150px] mx-auto">
    <svg viewBox="-75 -75 150 150" className="w-full h-full overflow-visible">
      <defs>
        <linearGradient id="ob-fim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={ROSA} />
          <stop offset="60%" stopColor={VERMELHO} />
          <stop offset="100%" stopColor={VINHO} />
        </linearGradient>
      </defs>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <motion.line key={i} x1={Math.cos(a) * 58} y1={Math.sin(a) * 58} x2={Math.cos(a) * 72} y2={Math.sin(a) * 72}
            stroke={i % 2 ? OURO : ROSA} strokeWidth="5" strokeLinecap="round"
            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: [0, 1, 0.35], scale: [0.6, 1.1, 1] }}
            transition={{ delay: 0.55 + i * 0.02, duration: 0.8 }} />
        );
      })}
      <motion.circle r="50" fill="url(#ob-fim)" initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12 }} />
      <motion.circle r="50" fill="none" stroke={OURO} strokeWidth="4" style={{ rotate: -90 }} {...desenha(0.3, 0.7)} />
      <motion.path d="M-22 2 L-7 17 L24 -16" fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"
        {...desenha(0.6, 0.5)} />
    </svg>
  </div>
);

/* Fundo da página: bolhas da marca respirando devagar */
export const FundoVivo: React.FC = () => (
  <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
    <motion.div className="absolute -top-24 -right-20 w-72 h-72 rounded-full"
      style={{ background: 'radial-gradient(circle, rgba(224,107,133,0.30), transparent 65%)' }}
      animate={{ x: [0, -20, 0], y: [0, 24, 0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} />
    <motion.div className="absolute top-[38%] -left-24 w-64 h-64 rounded-full"
      style={{ background: 'radial-gradient(circle, rgba(246,180,58,0.24), transparent 65%)' }}
      animate={{ x: [0, 26, 0], y: [0, -18, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
    <motion.div className="absolute -bottom-20 right-[-10%] w-80 h-80 rounded-full"
      style={{ background: 'radial-gradient(circle, rgba(190,13,62,0.16), transparent 65%)' }}
      animate={{ x: [0, -16, 0], y: [0, -20, 0] }} transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }} />
  </div>
);
