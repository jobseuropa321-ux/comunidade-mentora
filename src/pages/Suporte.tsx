import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, LifeBuoy, Loader2, MessageCircle, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalizedNavigate } from '@/i18n/LanguageProvider';
import { limparInstagram, limparWhatsapp, mascararWhatsapp } from '@/lib/matricula';
import { SUPORTE, GRUPO_SUPORTE_URL } from '@/lib/leads';

/* ══════════════════════════════════════════════════════════════
   SUPORTE — /suporte (tela cheia, sem guard)

   Uma tela só: quem é, sobre o que precisa de ajuda, mensagem. Grava
   em `leads` (tipo 'suporte') e leva pro grupo de suporte no WhatsApp.
   Identidade do app (creme e vermelho).
   ══════════════════════════════════════════════════════════════ */

const campoCls = 'w-full rounded-2xl bg-white border border-[#BE0D3E]/15 px-4 py-3.5 text-[14px] text-[#1E1B11] placeholder:text-[#5B4041]/35 outline-none focus:border-[#BE0D3E] focus:ring-4 focus:ring-[#BE0D3E]/10 transition-shadow';

const Rotulo: React.FC<{ children: React.ReactNode; opcional?: boolean }> = ({ children, opcional }) => (
  <label className="flex items-baseline justify-between mb-1.5">
    <span className="text-[10px] font-black uppercase tracking-widest text-[#5B4041]">{children}</span>
    {opcional && <span className="text-[9px] font-bold text-[#5B4041]/40">opcional</span>}
  </label>
);

const Suporte: React.FC = () => {
  const navigate = useLocalizedNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const anonimo = !user;

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    setNome(n => n || profile?.full_name || '');
    setInstagram(i => i || profile?.instagram || '');
  }, [authLoading, profile]);

  useEffect(() => {
    const antes = document.title;
    document.title = 'Suporte · Comunidade Amentora';
    return () => { document.title = antes; };
  }, []);

  const emailOk = !anonimo || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const valido = useMemo(() =>
    nome.trim().length >= 2 && emailOk && limparWhatsapp(whatsapp).length >= 10 && !!assunto && mensagem.trim().length >= 5,
  [nome, emailOk, whatsapp, assunto, mensagem]);

  const enviar = async () => {
    setSalvando(true);
    const { error } = await supabase.from('leads').insert({
      user_id: user?.id ?? null,
      tipo: 'suporte',
      origem: user ? 'app' : 'link',
      email: user?.email ?? (email.trim().toLowerCase() || null),
      nome: nome.trim(),
      whatsapp: limparWhatsapp(whatsapp),
      instagram: limparInstagram(instagram) || null,
      respostas: { assunto, mensagem: mensagem.trim() },
    });
    setSalvando(false);
    if (error) { toast.error('Não deu pra enviar', { description: error.message }); return; }
    setEnviado(true);
    window.scrollTo({ top: 0 });
  };

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#FFF9EE] flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-[#BE0D3E] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FFF9EE] relative overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(224,107,133,0.26), transparent 65%)' }} />
        <div className="absolute bottom-[-120px] -left-24 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(246,180,58,0.22), transparent 65%)' }} />
      </div>

      <div className="relative max-w-lg mx-auto px-4 pt-4 pb-12">
        <div className="flex items-center gap-3">
          {user && (
            <button onClick={() => navigate('/modulo/boas-vindas-a-comunidade/aula/1')} aria-label="Voltar"
              className="glass-btn-pink shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-95 transition-transform">
              <ArrowLeft size={17} strokeWidth={2.5} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#BE0D3E]">Suporte</p>
            <p className="text-[11px] font-bold text-[#1E1B11] truncate">Comunidade Amentora</p>
          </div>
        </div>

        {!enviado ? (
          <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }} className="mt-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #BE0D3E, #94002D)', boxShadow: '0 10px 26px -10px rgba(190,13,62,0.6)' }}>
              <LifeBuoy size={26} className="text-white" strokeWidth={2.25} />
            </div>
            <h1 className="mt-5 text-[28px] font-black leading-[1.02] text-[#1E1B11]">
              Precisa de ajuda?<br /><span className="text-[#BE0D3E]">A gente resolve.</span>
            </h1>
            <p className="mt-3 text-[13px] leading-relaxed text-[#5B4041]/80">
              Conta rapidinho o que está acontecendo. Depois de enviar, você entra no grupo de suporte e o time te atende por lá.
            </p>

            <div className="mt-6 space-y-5">
              <div>
                <Rotulo>Seu nome</Rotulo>
                <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Como você quer ser chamada" className={campoCls} />
              </div>
              {anonimo && (
                <div>
                  <Rotulo>E-mail da sua conta</Rotulo>
                  <input type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" className={campoCls} />
                </div>
              )}
              <div>
                <Rotulo>WhatsApp</Rotulo>
                <input type="tel" inputMode="tel" value={whatsapp} onChange={e => setWhatsapp(mascararWhatsapp(e.target.value))} placeholder="(11) 99999-9999" className={campoCls} />
              </div>
              <div>
                <Rotulo opcional>Instagram</Rotulo>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-bold text-[#BE0D3E]">@</span>
                  <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="seu.perfil" className={`${campoCls} pl-9`} />
                </div>
              </div>
              <div>
                <Rotulo>Sobre o que é</Rotulo>
                <div className="flex flex-wrap gap-2">
                  {SUPORTE.assunto.map(o => {
                    const ativo = assunto === o;
                    return (
                      <button key={o} type="button" onClick={() => setAssunto(ativo ? '' : o)}
                        className="rounded-full px-3.5 py-2 text-[12px] font-bold transition-all active:scale-95"
                        style={{
                          background: ativo ? 'linear-gradient(135deg, #BE0D3E, #94002D)' : 'white',
                          color: ativo ? 'white' : '#5B4041',
                          border: ativo ? '1px solid transparent' : '1px solid rgba(190,13,62,0.18)',
                          boxShadow: ativo ? '0 6px 16px -6px rgba(190,13,62,0.6)' : 'none',
                          WebkitTapHighlightColor: 'transparent',
                        }}>
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Rotulo>O que está acontecendo</Rotulo>
                <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={5}
                  placeholder="Descreva o problema ou a dúvida. Se tiver mensagem de erro, cola aqui."
                  className={`${campoCls} resize-none leading-relaxed`} />
              </div>

              <button onClick={enviar} disabled={!valido || salvando}
                className="glass-btn-pink w-full rounded-2xl py-4 text-[14px] font-black text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-45">
                {salvando ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} strokeWidth={2.5} />}
                Enviar e entrar no grupo de suporte
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }} className="mt-10 text-center">
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 180 }}
              className="mx-auto w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FDBB40, #F6B43A)', boxShadow: '0 16px 36px -14px rgba(246,180,58,0.8)' }}>
              <CheckCircle2 size={38} className="text-[#1E1B11]" strokeWidth={2.5} />
            </motion.div>
            <h1 className="mt-6 text-[28px] font-black leading-[1.02] text-[#1E1B11]">
              Recebemos,<br /><span className="text-[#BE0D3E]">{nome.split(' ')[0] || 'tudo certo'}!</span>
            </h1>
            <p className="mt-3 text-[13px] leading-relaxed text-[#5B4041]/80">
              Seu pedido chegou pro time. <strong className="text-[#1E1B11]">Entre no grupo de suporte</strong> pra ser atendida por lá e acompanhar a resposta.
            </p>
            <a href={GRUPO_SUPORTE_URL} target="_blank" rel="noopener noreferrer"
              className="mt-7 card-glass-liquid-lime w-full rounded-2xl py-4 flex items-center justify-center gap-2 text-[14px] font-black text-[#1E1B11] active:scale-[0.98] transition-transform">
              <MessageCircle size={18} strokeWidth={2.5} /> Entrar no grupo de suporte
            </a>
            <button onClick={() => navigate(user ? '/home' : '/auth')}
              className="mt-3 w-full py-3 rounded-2xl text-[12px] font-bold text-[#5B4041] bg-white/70 border border-[#BE0D3E]/12">
              {user ? 'Voltar para a comunidade' : 'Entrar na comunidade'}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Suporte;
