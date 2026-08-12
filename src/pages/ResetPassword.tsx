import React, { useEffect, useState } from 'react';

import { Lock, Mail, ArrowLeft, CheckCircle2, Loader2, Inbox } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLocalizedNavigate, useCurrentLang, localizedPath } from '@/i18n/LanguageProvider';
import { useTranslation, Trans } from 'react-i18next';

/* ── Recuperação de senha REAL (antes era mock do blueprint: fingia sucesso
   sem chamar o Supabase — quem não recebia o email de boas-vindas caía aqui
   e ficava presa pra sempre).

   Duas etapas na MESMA rota /reset-password:
   1. "request": pede o email da compra → resetPasswordForEmail envia o link.
   2. "update": chegando PELO LINK do email, o supabase-js processa o token da
      URL (detectSessionInUrl) e vira sessão de recovery → campos de senha nova
      → updateUser({ password }) → já entra logada.

   Essa página também é o "primeiro acesso" linkado na área de membros da
   Hubla: comprou → clica → digita o email → cria a senha → entra. */

type Stage = 'request' | 'sent' | 'update' | 'done';

const cardCls = 'bg-white border border-[#BE0D3E]/15 rounded-3xl p-6 shadow-[0_12px_40px_rgba(255,45,122,0.12)]';
const btnCls = 'w-full py-3.5 rounded-2xl text-[13px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-60';
const btnStyle: React.CSSProperties = { background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)', boxShadow: '0 8px 25px rgba(255,45,122,0.4)' };

const ResetPassword: React.FC = () => {
  const navigate = useLocalizedNavigate();
  const lang = useCurrentLang();
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>('request');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chegou pelo link do email? O supabase-js transforma o token da URL em
  // sessão; o evento PASSWORD_RECOVERY (ou uma sessão já presente) libera a
  // etapa de trocar a senha.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStage('update');
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStage(s => (s === 'request' ? 'update' : s));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) { setError(t('reset.emailInvalido')); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(clean, {
      // Sem localizedPath aqui, a aluna espanhola clica no link do e-mail e
      // cai na tela em português — o link vive fora do app, o prefixo tem que
      // ir cravado nele.
      redirectTo: `${window.location.origin}${localizedPath('/reset-password', lang)}`,
    });
    setLoading(false);
    if (err) {
      setError(
        err.status === 429
          ? t('reset.muitasTentativas')
          : t('reset.falhaEnviar'),
      );
      return;
    }
    setStage('sent');
  };

  const saveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError(t('reset.senhaCurta')); return; }
    if (password !== confirm) { setError(t('reset.senhasDiferentes')); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(
        err.message?.includes('different from the old')
          ? t('reset.senhaIgualAtual')
          : t('reset.falhaSalvar'),
      );
      return;
    }
    setStage('done');
  };

  return (
    <div className="min-h-screen bg-[#FFF9EE] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <button onClick={() => navigate('/auth')} className="flex items-center gap-1.5 text-[12px] font-bold text-[#5B4041] mb-6 hover:text-[#BE0D3E] transition-colors">
          <ArrowLeft size={14} /> {t('reset.voltarLogin')}
        </button>

        <div className={cardCls}>
          {stage === 'request' && (
            <>
              <h1 className="text-[20px] font-black text-[#1E1B11] mb-1">{t('reset.tituloPedir')}</h1>
              <p className="text-[12px] text-[#5B4041] mb-5 leading-relaxed">
                {t('reset.subPedir')}
              </p>
              <form onSubmit={sendLink} className="space-y-3">
                <div className="flex items-center gap-2 input-instagram">
                  <Mail size={16} className="text-[#BE0D3E]/60 shrink-0" />
                  <input
                    className="flex-1 bg-transparent outline-none text-[14px]"
                    placeholder={t('reset.emailCompra')}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                {error && <p className="text-[11px] text-red-500 font-semibold px-1">{error}</p>}
                <button type="submit" disabled={loading} className={btnCls} style={btnStyle}>
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {t('reset.enviarLink')}
                </button>
              </form>
            </>
          )}

          {stage === 'sent' && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-[#F6B43A] flex items-center justify-center mb-4">
                <Inbox size={30} className="text-[#1E1B11]" />
              </div>
              <h1 className="text-[18px] font-black text-[#1E1B11] mb-1">{t('reset.linkEnviado')}</h1>
              <p className="text-[12px] text-[#5B4041] leading-relaxed mb-2">
                <Trans i18nKey="reset.abraEmail" values={{ email: email.trim().toLowerCase() }}
                  components={{ 1: <strong className="text-[#1E1B11]" /> }} />
              </p>
              <p className="text-[11px] text-[#5B4041]/70 leading-relaxed mb-6">
                <Trans i18nKey="reset.olheSpam" components={{ 1: <strong />, 3: <strong /> }} />
              </p>
              <button onClick={() => setStage('request')} className="text-[11px] font-bold text-[#BE0D3E]">
                {t('reset.enviarDeNovo')}
              </button>
            </div>
          )}

          {stage === 'update' && (
            <>
              <h1 className="text-[20px] font-black text-[#1E1B11] mb-1">{t('reset.novaSenha')}</h1>
              <p className="text-[12px] text-[#5B4041] mb-5">{t('reset.escolhaSenha')}</p>
              <form onSubmit={saveNewPassword} className="space-y-3">
                <div className="flex items-center gap-2 input-instagram">
                  <Lock size={16} className="text-[#BE0D3E]/60 shrink-0" />
                  <input className="flex-1 bg-transparent outline-none text-[14px]" placeholder={t('reset.placeholderNova')} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 input-instagram">
                  <Lock size={16} className="text-[#BE0D3E]/60 shrink-0" />
                  <input className="flex-1 bg-transparent outline-none text-[14px]" placeholder={t('reset.placeholderConfirmar')} type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
                </div>
                {error && <p className="text-[11px] text-red-500 font-semibold px-1">{error}</p>}
                <button type="submit" disabled={loading} className={btnCls} style={btnStyle}>
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {t('reset.salvarSenha')}
                </button>
              </form>
            </>
          )}

          {stage === 'done' && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-[#F6B43A] flex items-center justify-center mb-4">
                <CheckCircle2 size={30} className="text-[#1E1B11]" />
              </div>
              <h1 className="text-[18px] font-black text-[#1E1B11] mb-1">{t('reset.senhaCriada')}</h1>
              <p className="text-[12px] text-[#5B4041] mb-6">{t('reset.jaLogada')}</p>
              <button onClick={() => navigate('/home')} className={btnCls} style={btnStyle}>
                {t('reset.entrarComunidade')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
