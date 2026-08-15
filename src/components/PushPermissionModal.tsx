import React, { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentLang } from '@/i18n/LanguageProvider';
import { inscreverParaPush, permissaoAtual, pushConfigurado } from '@/lib/push';

/* ═══════════════════════════════════════════════════════════════════════
 *  Convite para ativar notificação — pop-up no centro da tela.
 *
 *  Aparece uma vez, depois que a aluna JÁ INSTALOU o app e voltou por ele
 *  (display-mode: standalone). Esse é o momento certo por dois motivos: no
 *  iPhone o push só existe com o app instalado, e a aluna acabou de passar
 *  pelo tutorial — está no contexto.
 *
 *  Não volta a aparecer se ela já respondeu (permissão concedida ou negada
 *  ficam guardadas no navegador) nem por 14 dias se ela adiar.
 * ═══════════════════════════════════════════════════════════════════════ */

const ADIADO_KEY = 'push_prompt_adiado';
const ADIAR_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const ATRASO_MS = 1500; // deixa a tela carregar antes de interromper

const estaInstalado = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (navigator as any).standalone === true;

const adiadoRecentemente = () => {
  const raw = localStorage.getItem(ADIADO_KEY);
  if (!raw) return false;
  const ts = parseInt(raw, 10);
  return !isNaN(ts) && Date.now() - ts < ADIAR_TTL_MS;
};

const PushPermissionModal: React.FC = () => {
  const { t } = useTranslation();
  const lang = useCurrentLang();
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!user || !pushConfigurado() || !estaInstalado()) return;

    const permissao = permissaoAtual();

    // Já permitiu antes (outro aparelho, ou reinstalou): registra em silêncio,
    // sem pop-up. Sem isto a aluna aparece como "permitiu" no navegador mas
    // não recebe nada, porque não existe linha no banco.
    if (permissao === 'granted') {
      inscreverParaPush(lang);
      return;
    }

    // 'denied' é decisão dela e só o próprio navegador reverte — insistir aqui
    // não abre nada, só atrapalha.
    if (permissao !== 'default' || adiadoRecentemente()) return;

    const timer = window.setTimeout(() => setAberto(true), ATRASO_MS);
    return () => window.clearTimeout(timer);
  }, [user, lang]);

  const adiar = () => {
    localStorage.setItem(ADIADO_KEY, String(Date.now()));
    setAberto(false);
  };

  const permitir = async () => {
    setEnviando(true);
    const r = await inscreverParaPush(lang);
    setEnviando(false);
    setAberto(false);

    if (r.ok) {
      toast.success(t('push.sucesso'));
      return;
    }
    // Negar é uma resposta válida: guarda pra não perguntar de novo amanhã.
    localStorage.setItem(ADIADO_KEY, String(Date.now()));
    if (r.motivo === 'negado') toast(t('push.negado'));
    else toast.error(t('push.erro'));
  };

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-[#1E1B11]/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-titulo"
    >
      <div className="bg-white rounded-3xl w-full max-w-[340px] overflow-hidden shadow-[0_24px_60px_rgba(190,13,62,0.35)]">
        {/* Topo com o sino */}
        <div className="relative px-5 pt-7 pb-5 text-center" style={{ background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)' }}>
          <button
            onClick={adiar}
            aria-label={t('push.agoraNao')}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center active:scale-95 transition-transform"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <X size={15} />
          </button>
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
            <BellRing size={26} className="text-white" strokeWidth={2.2} />
          </div>
          <h2 id="push-titulo" className="text-[19px] leading-tight font-black text-white">
            {t('push.titulo')}
          </h2>
        </div>

        <div className="px-5 pt-4 pb-5">
          <p className="text-[13px] text-[#5B4041] leading-relaxed text-center">{t('push.subtitulo')}</p>

          <ul className="mt-4 space-y-2">
            {['push.beneficio1', 'push.beneficio2', 'push.beneficio3'].map(k => (
              <li key={k} className="flex items-start gap-2 text-[12px] text-[#1E1B11] leading-snug">
                <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-[#BE0D3E] shrink-0" />
                {t(k)}
              </li>
            ))}
          </ul>

          <button
            onClick={permitir}
            disabled={enviando}
            className="w-full mt-5 py-3.5 rounded-2xl text-white text-[13px] font-black uppercase tracking-widest disabled:opacity-60 active:scale-[0.99] transition-transform"
            style={{ background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)', boxShadow: '0 10px 24px -8px rgba(190,13,62,0.6)' }}
          >
            {enviando ? t('push.ativando') : t('push.permitir')}
          </button>
          <button
            onClick={adiar}
            className="w-full mt-2 py-2.5 text-[12px] font-bold text-[#5B4041]/70"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {t('push.agoraNao')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PushPermissionModal;
