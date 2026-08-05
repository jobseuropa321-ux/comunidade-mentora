/* ═════════════════════════════════════════════
   O ROBÔ DOS AGENTES (Estúdio de Criação)

   Base comum + ferramenta/rosto próprios de cada profissão, e a cena
   ambiente que roda atrás dele no palco do card.

   Mora aqui (e não no Chat.tsx) porque as telas dos agentes-FERRAMENTA
   — ex.: <AnalisarPerfilAgent /> — também desenham o robô, e importar
   do Chat.tsx criaria ciclo de import.
═════════════════════════════════════════════ */
import React from 'react';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export type RobotKind =
  | 'estrutura' | 'roteiro' | 'apostila' | 'pesquisa'
  | 'nome' | 'promessa' | 'ganchos' | 'narrado' | 'carrossel'
  | 'anuncioPS' | 'anuncioAula' | 'perfil';

export const ACCENT: Record<RobotKind, { main: string; deep: string; soft: string; cta: string }> = {
  estrutura: { main: '#BE0D3E', deep: '#7C0026', soft: '#F6D6DC', cta: '#BE0D3E' },
  roteiro:   { main: '#F6B43A', deep: '#B96F0E', soft: '#FBE3BC', cta: '#C77E14' },
  apostila:  { main: '#E06B85', deep: '#B04967', soft: '#F6D6DC', cta: '#D06A85' },
  pesquisa:  { main: '#94002D', deep: '#5E001C', soft: '#ECA6BB', cta: '#94002D' },
  // oferta (marca)
  nome:      { main: '#C81F5C', deep: '#94002D', soft: '#F6D6DC', cta: '#BE0D3E' },
  promessa:  { main: '#E06B85', deep: '#B04967', soft: '#F6D6DC', cta: '#D06A85' },
  // bônus de viralização (lime + rosa choque)
  ganchos:   { main: '#FF2D7A', deep: '#C8005A', soft: '#FFD1E4', cta: '#E8226C' },
  narrado:   { main: '#C8F000', deep: '#7FA000', soft: '#EEFFC0', cta: '#6E8B00' },
  carrossel: { main: '#FF2D7A', deep: '#C8005A', soft: '#FFD1E4', cta: '#E8226C' },
  perfil:    { main: '#FF2D7A', deep: '#8A0040', soft: '#FFD1E4', cta: '#B0004E' },
  // anúncios (resposta direta) — tons de azul
  anuncioPS:   { main: '#2563EB', deep: '#1E3A8A', soft: '#DBEAFE', cta: '#1D4ED8' },
  anuncioAula: { main: '#0EA5E9', deep: '#075985', soft: '#E0F2FE', cta: '#0369A1' },
};

/* ── O robô: base comum + ferramenta/rosto próprios de cada profissão ── */
export const Robot: React.FC<{ kind: RobotKind; reduce: boolean }> = ({ kind, reduce }) => {
  const a = ACCENT[kind];
  return (
    <svg viewBox="0 0 120 120" className="w-[88px] h-[88px] drop-shadow-[0_12px_14px_rgba(30,27,17,0.30)]" aria-hidden="true">
      {/* antena */}
      <line x1="60" y1="14" x2="60" y2="25" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      <motion.circle
        cx="60" cy="10.5" r="4" fill="#F6B43A" stroke="#FFFFFF" strokeWidth="1.5"
        animate={reduce ? undefined : { scale: [1, 1.45, 1], opacity: [1, 0.7, 1] }}
        transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      />
      {/* orelhas */}
      <rect x="21.5" y="41" width="7" height="15" rx="3.5" fill="#FFFFFF" opacity="0.9" />
      <rect x="91.5" y="41" width="7" height="15" rx="3.5" fill="#FFFFFF" opacity="0.9" />
      {/* cabeça */}
      <rect x="28" y="25" width="64" height="49" rx="16" fill="#FFFDF7" stroke={a.deep} strokeWidth="2.5" />
      {/* visor */}
      <rect x="36" y="33" width="48" height="33" rx="11" fill={a.soft} opacity="0.5" />

      {/* Analisar Perfil — feixe de leitura varrendo o visor (é o robô que "escaneia") */}
      {kind === 'perfil' && (
        <motion.rect
          x="36" width="48" height="2.6" rx="1.3" fill="#C8F000" opacity="0.75"
          animate={reduce ? { y: 48 } : { y: [35, 62, 35] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* chapéus/acessórios de cabeça (desenhados depois da cabeça) */}
      {kind === 'estrutura' && (
        <>
          {/* capacete de obra */}
          <path d="M37 27 Q60 10 83 27 L83 29 L37 29 Z" fill="#F6B43A" stroke="#C77E14" strokeWidth="1.5" />
          <rect x="31.5" y="27" width="57" height="5" rx="2.5" fill="#C77E14" />
        </>
      )}
      {kind === 'roteiro' && (
        <>
          {/* boina de diretora */}
          <ellipse cx="46.5" cy="23" rx="15" ry="6.5" fill={a.deep} />
          <circle cx="46.5" cy="15.5" r="2.6" fill={a.deep} />
        </>
      )}

      {/* olhos */}
      {kind === 'pesquisa' ? (
        <>
          <rect x="46" y="42.5" width="7" height="11.5" rx="3.5" fill="#1E1B11" className="robot-eye" />
          {/* olho direito ampliado pela lupa */}
          <rect x="66" y="41" width="8.5" height="14" rx="4.2" fill="#1E1B11" className="robot-eye" style={{ animationDelay: '0.35s' }} />
          <circle cx="70.2" cy="48" r="11" fill="rgba(255,255,255,0.35)" stroke={a.deep} strokeWidth="3" />
          <line x1="78.4" y1="56.4" x2="86.5" y2="64.5" stroke={a.deep} strokeWidth="4.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <rect x="46" y="42.5" width="7" height="11.5" rx="3.5" fill="#1E1B11" className="robot-eye" />
          <rect x="67" y="42.5" width="7" height="11.5" rx="3.5" fill="#1E1B11" className="robot-eye" style={{ animationDelay: '0.2s' }} />
        </>
      )}
      {kind === 'apostila' && (
        <>
          {/* óculos de leitura */}
          <circle cx="49.5" cy="48" r="8.6" fill="none" stroke={a.deep} strokeWidth="2.3" />
          <circle cx="70.5" cy="48" r="8.6" fill="none" stroke={a.deep} strokeWidth="2.3" />
          <line x1="58.1" y1="48" x2="61.9" y2="48" stroke={a.deep} strokeWidth="2.3" strokeLinecap="round" />
          <line x1="40.9" y1="47" x2="29" y2="45" stroke={a.deep} strokeWidth="2" strokeLinecap="round" />
          <line x1="79.1" y1="47" x2="91" y2="45" stroke={a.deep} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {/* Analisar Perfil — marca de conferido piscando ao lado do olho */}
      {kind === 'perfil' && (
        <motion.path
          d="M76.5 38.5 l2.2 2.4 l4.3 -5"
          fill="none" stroke="#C8F000" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          animate={reduce ? undefined : { opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2.8, times: [0, 0.35, 0.7, 1], repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* sorriso + bochechas */}
      <path d="M53 59.5 Q60 64.5 67 59.5" stroke="#1E1B11" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="42" cy="56" r="3" fill="#ECA6BB" opacity="0.8" />
      <circle cx="78" cy="56" r="3" fill="#ECA6BB" opacity="0.8" />

      {/* corpo */}
      <rect x="41" y="77" width="38" height="21" rx="10" fill={a.main} stroke={a.deep} strokeWidth="2" />
      <motion.circle
        cx="60" cy="87.5" r="4"
        fill="#FFFFFF" opacity="0.45"
        animate={reduce ? undefined : { opacity: [0.3, 0.65, 0.3] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* braços */}
      <rect x="29" y="80" width="9" height="15" rx="4.5" fill={a.deep} />
      <rect x="82" y="80" width="9" height="15" rx="4.5" fill={a.deep} />

      {/* ferramenta da profissão */}
      {kind === 'estrutura' && (
        <g transform="rotate(-22 91 92)">
          <rect x="82" y="88" width="18" height="7" rx="3.5" fill="#FFFDF7" stroke={a.deep} strokeWidth="1.8" />
          <line x1="87" y1="88.5" x2="87" y2="94.5" stroke={a.deep} strokeWidth="1.2" opacity="0.6" />
          <line x1="93" y1="88.5" x2="93" y2="94.5" stroke={a.deep} strokeWidth="1.2" opacity="0.6" />
        </g>
      )}
      {kind === 'roteiro' && (
        <g transform="rotate(28 89 88)">
          <rect x="86" y="74" width="6" height="17" rx="2" fill="#F6B43A" stroke="#B96F0E" strokeWidth="1.5" />
          <path d="M86 91 L92 91 L89 97 Z" fill="#1E1B11" />
        </g>
      )}
      {kind === 'apostila' && (
        <>
          <path d="M44 95 Q52 90 60 95 Q68 90 76 95 L76 104 Q68 99 60 104 Q52 99 44 104 Z" fill="#FFFDF7" stroke={a.deep} strokeWidth="1.8" />
          <line x1="60" y1="95" x2="60" y2="104" stroke={a.deep} strokeWidth="1.2" opacity="0.6" />
        </>
      )}
      {/* Nome Potente — etiqueta de marca */}
      {kind === 'nome' && (
        <g transform="rotate(-16 89 91)">
          <path d="M81 86 h11 a3 3 0 0 1 3 3 v6 a3 3 0 0 1 -3 3 h-11 l-4 -6 z" fill="#FFFDF7" stroke={a.deep} strokeWidth="1.8" />
          <circle cx="82.5" cy="92" r="1.5" fill={a.deep} />
        </g>
      )}
      {/* Promessa — megafone */}
      {kind === 'promessa' && (
        <g transform="rotate(-18 90 90)">
          <rect x="79" y="88" width="5" height="6" rx="1.5" fill={a.deep} />
          <path d="M84 87 L96 83 L96 99 L84 95 Z" fill="#FFFDF7" stroke={a.deep} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M99 87 q3 4 0 8" stroke={a.deep} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>
      )}
      {/* Ganchos — anzol */}
      {kind === 'ganchos' && (
        <g>
          <path d="M90 83 L90 93 a4.2 4.2 0 0 1 -8.4 0 a4.2 4.2 0 0 1 4.2 -4.2" fill="none" stroke={a.deep} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M86 88.5 l-2 -3 l4 0 z" fill={a.deep} />
        </g>
      )}
      {/* Narrado Técnico — microfone */}
      {kind === 'narrado' && (
        <g transform="rotate(20 88 90)">
          <rect x="84.5" y="81" width="7" height="12" rx="3.5" fill="#FFFDF7" stroke={a.deep} strokeWidth="1.8" />
          <line x1="88" y1="93" x2="88" y2="99" stroke={a.deep} strokeWidth="1.8" />
          <line x1="84.5" y1="99" x2="91.5" y2="99" stroke={a.deep} strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )}
      {/* Carrossel — pilha de slides */}
      {kind === 'carrossel' && (
        <g transform="rotate(-10 89 91)">
          <rect x="83" y="85" width="12" height="11" rx="2" fill={a.deep} opacity="0.45" />
          <rect x="80.5" y="87" width="12" height="11" rx="2" fill="#FFFDF7" stroke={a.deep} strokeWidth="1.6" />
        </g>
      )}
      {/* Analisar Perfil — celular com o perfil aberto na tela */}
      {kind === 'perfil' && (
        <g transform="rotate(-12 88 89)">
          <rect x="81" y="78" width="14" height="21" rx="3.6" fill="#FFFDF7" stroke={a.deep} strokeWidth="1.8" />
          <circle cx="88" cy="84.5" r="3" fill={a.main} />
          <line x1="84" y1="90" x2="92" y2="90" stroke={a.deep} strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
          <line x1="84" y1="93.5" x2="90" y2="93.5" stroke={a.deep} strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
        </g>
      )}
      {/* Anúncio Problema/Solução — alvo/bullseye (tráfego, resposta direta) */}
      {kind === 'anuncioPS' && (
        <g>
          <circle cx="89" cy="90" r="8" fill="#FFFDF7" stroke={a.deep} strokeWidth="1.8" />
          <circle cx="89" cy="90" r="5" fill="none" stroke={a.deep} strokeWidth="1.6" />
          <circle cx="89" cy="90" r="2" fill={a.deep} />
        </g>
      )}
      {/* Anúncio Mini-Aula — lousa com giz (ensina um passo) */}
      {kind === 'anuncioAula' && (
        <g transform="rotate(-8 88 90)">
          <rect x="80" y="84" width="17" height="13" rx="2" fill={a.deep} stroke="#FFFDF7" strokeWidth="1.6" />
          <line x1="83" y1="88.5" x2="93.5" y2="88.5" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" opacity="0.92" />
          <line x1="83" y1="92.5" x2="90" y2="92.5" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
        </g>
      )}
    </svg>
  );
};

/* ── Cena ambiente de cada palco (atrás do robô) ── */
export const SceneFX: React.FC<{ kind: RobotKind; reduce: boolean }> = ({ kind, reduce }) => {
  if (kind === 'estrutura') {
    return (
      <>
        {/* grade de blueprint */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.13) 1px, transparent 1px)',
            backgroundSize: '13px 13px',
          }}
        />
        {/* blocos do esqueleto se empilhando */}
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="absolute left-2.5 w-7 h-2 rounded-[3px] bg-white/80"
            style={{ bottom: 8 + i * 9 }}
            animate={reduce ? undefined : { opacity: [0, 1, 1, 0], y: [7, 0, 0, 0] }}
            transition={{ duration: 3, times: [0, 0.2, 0.85, 1], repeat: Infinity, delay: i * 0.5, repeatDelay: 1.2 }}
          />
        ))}
      </>
    );
  }
  if (kind === 'roteiro') {
    return (
      <>
        {/* linhas do roteiro sendo "digitadas" */}
        {[38, 26, 44, 30].map((w, i) => (
          <motion.div
            key={i}
            className="absolute left-2.5 h-[3px] rounded-full bg-white/80"
            style={{ top: 10 + i * 8 }}
            animate={reduce ? { width: w } : { width: [0, w, w, 0] }}
            transition={{ duration: 3.8, times: [0, 0.3, 0.9, 1], repeat: Infinity, delay: i * 0.45 }}
          />
        ))}
      </>
    );
  }
  if (kind === 'apostila') {
    return (
      <>
        {/* fita marcadora da apostila */}
        <motion.div
          className="absolute top-0 right-3 w-2.5 h-9 bg-white/85 rounded-b-[3px]"
          style={{ transformOrigin: 'top center' }}
          animate={reduce ? undefined : { rotate: [0, 5, 0, -4, 0] }}
          transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* linhas de leitura */}
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="absolute left-3 h-[3px] rounded-full bg-white/75"
            style={{ bottom: 11 + i * 8, width: 32 - i * 7 }}
            animate={reduce ? undefined : { opacity: [0.25, 0.95, 0.25] }}
            transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
          />
        ))}
      </>
    );
  }
  if (kind === 'pesquisa') {
    return (
      <>
        {/* radar */}
        <div className="absolute top-2 left-2 w-14 h-14 rounded-full border border-white/40" />
        <div className="absolute top-[13px] left-[13px] w-[34px] h-[34px] rounded-full border border-white/25" />
        <div className="absolute top-2 left-2 w-14 h-14 rounded-full overflow-hidden">
          <motion.div
            className="w-full h-full"
            style={{ background: 'conic-gradient(from 0deg, rgba(255,255,255,0.55), transparent 75deg)' }}
            animate={reduce ? undefined : { rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
        </div>
        <div className="absolute top-[27px] left-[27px] w-1.5 h-1.5 rounded-full bg-white/95" />
        {/* barras do relatório */}
        {[9, 15, 21].map((h, i) => (
          <motion.div
            key={i}
            className="absolute bottom-2 w-2 rounded-t-[3px] bg-white/80"
            style={{ left: 10 + i * 10 }}
            animate={reduce ? { height: h } : { height: [4, h, 4] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
          />
        ))}
      </>
    );
  }
  if (kind === 'anuncioPS') {
    return (
      <>
        {/* ondas de resposta direta expandindo do alvo */}
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="absolute left-3 top-3 w-4 h-4 rounded-full border-2 border-white/55"
            animate={reduce ? undefined : { scale: [1, 3], opacity: [0.65, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, delay: i * 0.9, ease: 'easeOut' }}
          />
        ))}
        <div className="absolute left-[17px] top-[17px] w-1.5 h-1.5 rounded-full bg-white/90" />
      </>
    );
  }
  if (kind === 'anuncioAula') {
    return (
      <>
        {/* passos da mini-aula sendo escritos na lousa */}
        {[30, 22, 34].map((w, i) => (
          <motion.div
            key={i}
            className="absolute left-3 h-[3px] rounded-full bg-white/80"
            style={{ top: 12 + i * 9 }}
            animate={reduce ? { width: w } : { width: [0, w, w, 0] }}
            transition={{ duration: 3.6, times: [0, 0.35, 0.9, 1], repeat: Infinity, delay: i * 0.5 }}
          />
        ))}
        {/* seta pro próximo nível */}
        <motion.div
          className="absolute bottom-3 right-3 text-white/85"
          animate={reduce ? undefined : { x: [0, 4, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ArrowRight size={12} strokeWidth={3} />
        </motion.div>
      </>
    );
  }
  if (kind === 'perfil') {
    return (
      <>
        {/* mini perfil (foto + nome + bio) sendo lido */}
        <div className="absolute left-3 top-3 w-6 h-6 rounded-full border-2 border-white/55" />
        <div className="absolute left-3 top-[38px] w-[30px] h-[3px] rounded-full bg-white/65" />
        <div className="absolute left-3 top-[45px] w-[21px] h-[3px] rounded-full bg-white/40" />
        <div className="absolute left-3 bottom-4 w-[46px] h-[3px] rounded-full bg-white/30" />
        {/* feixe de leitura varrendo o palco de cima a baixo */}
        <motion.div
          className="absolute left-0 right-0 h-[2px]"
          style={{ top: 8, background: 'linear-gradient(90deg, transparent, #C8F000, transparent)' }}
          animate={reduce ? { opacity: 0.5 } : { top: [8, 116, 8], opacity: [0.15, 1, 0.15] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </>
    );
  }
  // genérico (agentes de oferta + bônus): partículas flutuantes brancas
  return (
    <>
      {[0, 1, 2, 3, 4].map(i => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white/70"
          style={{ width: 4 + (i % 3), height: 4 + (i % 3), left: 10 + ((i * 21) % 44), top: 12 + ((i * 27) % 62) }}
          animate={reduce ? undefined : { y: [0, -7, 0], opacity: [0.25, 0.85, 0.25] }}
          transition={{ duration: 2.6 + i * 0.35, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
        />
      ))}
    </>
  );
};
