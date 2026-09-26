import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, Ticket, X, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentLang, useLocalizedNavigate } from '@/i18n/LanguageProvider';
import { useMinhaMatricula } from '@/lib/matricula';
import Confetti from '@/components/Confetti';

/* ═══════════════════════════════════════════════════════════════════════
 *  Pop-up do prêmio de R$ 500 (ingresso do evento Agora Mentora 100K).
 *
 *  Aparece TODA VEZ que a aluna abre o app enquanto não tiver ficha de
 *  matrícula. "Abrir o app" = sessão do navegador: o sessionStorage zera
 *  quando o app é fechado, então navegar entre telas não repete o pop-up,
 *  mas fechar e abrir de novo, sim. Preencheu a ficha → nunca mais aparece.
 *
 *  Campanha em português: no app em espanhol não aparece.
 *  Textos direto no código, como na página /matricula.
 * ═══════════════════════════════════════════════════════════════════════ */

const VISTO_KEY = 'premio_matricula_visto';
const ATRASO_MS = 900; // deixa a tela carregar antes de interromper

/** Só em desenvolvimento: `?premio=1` na URL força o pop-up, mesmo com
 *  ficha preenchida — pra ver o visual sem mexer no banco. */
const forcarPreview = () =>
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('premio') === '1';

const jaViuNestaSessao = () => {
  try { return sessionStorage.getItem(VISTO_KEY) === '1'; } catch { return false; }
};
const marcarVisto = () => {
  try { sessionStorage.setItem(VISTO_KEY, '1'); } catch { /* sem storage: aparece de novo, tudo bem */ }
};

/** `onResolvido` avisa o layout que este pop-up já saiu do caminho (não vai
 *  aparecer, ou foi fechado) — é o sinal pro convite de notificação poder
 *  aparecer sem empilhar um pop-up em cima do outro. */
const PremioMatriculaModal: React.FC<{ onResolvido: () => void }> = ({ onResolvido }) => {
  const { user } = useAuth();
  const lang = useCurrentLang();
  const navigate = useLocalizedNavigate();
  const { matricula, loading } = useMinhaMatricula();
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (forcarPreview()) { setAberto(true); return; }
    if (!user || lang !== 'pt' || matricula || jaViuNestaSessao()) { onResolvido(); return; }
    const timer = window.setTimeout(() => { marcarVisto(); setAberto(true); }, ATRASO_MS);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, lang, matricula]);

  const fechar = () => { setAberto(false); onResolvido(); };
  const garantir = () => { setAberto(false); navigate('/matricula'); };

  if (!aberto) return null;

  return (
    <>
      <Confetti zIndex={140} duracaoMs={5000} quantidade={200} />
      <motion.div
        className="fixed inset-0 z-[130] bg-[#1E1B11]/65 backdrop-blur-sm flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        role="dialog" aria-modal="true" aria-labelledby="premio-titulo"
      >
        <motion.div
          className="bg-white rounded-3xl w-full max-w-[360px] max-h-[92dvh] overflow-y-auto shadow-[0_24px_60px_rgba(190,13,62,0.45)]"
          initial={{ scale: 0.7, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        >
          {/* Topo: presente + valor */}
          <div className="relative px-5 pt-7 pb-6 text-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #BE0D3E 0%, #94002D 100%)' }}>
            <div className="absolute -top-16 -right-10 w-44 h-44 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(246,180,58,0.45) 0%, transparent 65%)' }} />
            <div className="absolute -bottom-16 -left-10 w-40 h-40 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 65%)' }} />

            <button
              onClick={fechar}
              aria-label="Fechar"
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center active:scale-95 transition-transform"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <X size={15} />
            </button>

            <motion.div
              className="relative w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'linear-gradient(135deg, #FBC85F 0%, #F6B43A 100%)', boxShadow: '0 10px 24px -6px rgba(246,180,58,0.7)' }}
              animate={{ rotate: [0, -10, 10, -6, 6, 0], scale: [1, 1.08, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.4 }}
            >
              <Gift size={30} className="text-[#94002D]" strokeWidth={2.4} />
            </motion.div>

            <p className="relative text-[11px] font-black uppercase tracking-widest text-[#FBC85F]">Parabéns!</p>
            <h2 id="premio-titulo" className="relative text-[18px] leading-tight font-black text-white mt-1">
              Você acaba de ganhar uma premiação de
            </h2>
            <motion.p
              className="relative text-[44px] leading-none font-black mt-2"
              style={{ color: '#FBC85F', textShadow: '0 4px 18px rgba(246,180,58,0.55)' }}
              animate={{ scale: [1, 1.07, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            >
              R$ 500
            </motion.p>
          </div>

          <div className="px-5 pt-4 pb-5">
            <p className="text-[13px] text-[#1E1B11] leading-relaxed">
              Esse é o valor do ingresso para o nosso evento de implementação{' '}
              <strong className="text-[#BE0D3E]">Agora Mentora 100K no Digital. Suas Primeiras Vendas em 48 Horas.</strong>{' '}
              E você vai participar <strong>sem pagar nada</strong> por ele! 💛
            </p>
            <p className="text-[13px] text-[#5B4041] leading-relaxed mt-3">
              Serão dois dias de imersão, totalmente focados no seu negócio. Vamos trabalhar para você sair do evento com o seu funil estruturado, o seu curso pré-gravado e pronta para fazer suas primeiras vendas no digital.
            </p>

            <div className="mt-4 rounded-2xl px-3.5 py-3 flex items-center gap-2.5" style={{ background: '#FFF3D6', border: '1px solid #FBC85F' }}>
              <Ticket size={18} className="text-[#BE0D3E] shrink-0" strokeWidth={2.4} />
              <p className="text-[12px] font-bold text-[#1E1B11] leading-snug">
                Para resgatar, é só preencher sua ficha de matrícula.
              </p>
            </div>

            <motion.button
              onClick={garantir}
              className="w-full mt-4 py-3.5 rounded-2xl text-white text-[13px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)', boxShadow: '0 10px 24px -8px rgba(190,13,62,0.6)', WebkitTapHighlightColor: 'transparent' }}
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              whileTap={{ scale: 0.97 }}
            >
              Resgatar meu ingresso <ChevronRight size={16} strokeWidth={3} />
            </motion.button>
            <button
              onClick={fechar}
              className="w-full mt-2 py-2.5 text-[12px] font-bold text-[#5B4041]/70"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              Depois
            </button>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
};

export default PremioMatriculaModal;
