import React, { useState } from 'react';

import { CircleAlert, Mail, Lock, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isAccessDenied } from '@/lib/subscription';
import { useTranslation } from 'react-i18next';
import { useLocalizedNavigate } from '@/i18n/LanguageProvider';

/* Só login. Conta não se cria aqui: quem compra na Hubla recebe a conta
   pronta (com senha) por email — ver supabase/functions/hubla-webhook. */
const Auth: React.FC = () => {
  const navigate = useLocalizedNavigate();
  const { t } = useTranslation();
  const { signIn, accessDeniedStatus, clearAccessDeniedNotice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // O motivo do bloqueio é resolvido pelo dicionário no render, a partir do
  // status. Assim a aluna espanhola lê o motivo em espanhol sem que o gate de
  // acesso (que roda fora do React) precise saber de idioma.
  const accessDeniedMessage = accessDeniedStatus ? t(`auth.negado.${accessDeniedStatus}.msg`) : null;
  const visibleError = accessDeniedMessage ?? error;
  const errorTitle = accessDeniedStatus
    ? t(`auth.negado.${accessDeniedStatus}.titulo`)
    : t('auth.erroTitulo');

  const clearErrors = () => {
    setError(null);
    clearAccessDeniedNotice();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    if (!email || !password) {
      setError(t('auth.preenchaCampos'));
      return;
    }
    setLoading(true);
    const res = await signIn(email, password);
    setLoading(false);
    if (res.error) {
      // Acesso negado pelo gate de assinatura → mostra o motivo real.
      // Erro cru do Supabase Auth → mensagem genérica (vem em inglês).
      if (!isAccessDenied(res.error)) {
        setError(t('auth.credenciaisInvalidas'));
      }
      return;
    }
    navigate('/home', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FFF9EE] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo-app.webp" alt="Amentora" className="h-28 w-auto" draggable={false} />
        </div>

        <div className="bg-white border border-[#BE0D3E]/15 rounded-3xl p-6 shadow-[0_12px_40px_rgba(255,45,122,0.12)]">
          <div className="mb-5">
            <h1 className="text-[18px] font-black text-[#1E1B11] leading-tight">{t('auth.titulo')}</h1>
            <p className="text-[11px] text-[#5B4041]/75 mt-1 leading-relaxed">
              {t('auth.subtitulo')}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div className="flex items-center gap-2 input-instagram">
              <Mail size={16} className="text-[#BE0D3E]/60 shrink-0" />
              <input
                className="flex-1 bg-transparent outline-none text-[14px]"
                placeholder={t('auth.email')}
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  clearErrors();
                }}
              />
            </div>
            <div className="flex items-center gap-2 input-instagram">
              <Lock size={16} className="text-[#BE0D3E]/60 shrink-0" />
              <input
                className="flex-1 bg-transparent outline-none text-[14px]"
                placeholder={t('auth.senha')}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  clearErrors();
                }}
              />
            </div>

            {visibleError && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800"
              >
                <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-[12px] font-black leading-tight">{errorTitle}</p>
                  <p className="mt-1 text-[11px] font-medium leading-relaxed">{visibleError}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl text-[13px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)', boxShadow: '0 8px 25px rgba(255,45,122,0.4)' }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={15} />}
              {t('auth.entrar')}
            </button>
          </form>

          <button
            onClick={() => navigate('/reset-password')}
            className="w-full text-center text-[11px] text-[#5B4041] mt-4 hover:text-[#BE0D3E] transition-colors"
          >
            {t('auth.esqueciSenha')}
          </button>
        </div>

        <p className="text-[10px] text-[#5B4041]/60 text-center mt-5 leading-relaxed">
          {t('auth.termos')}
        </p>
      </div>
    </div>
  );
};

export default Auth;
