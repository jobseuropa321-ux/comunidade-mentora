import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Crown, Loader2, MessageCircle, Sparkles, Check, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalizedNavigate } from '@/i18n/LanguageProvider';
import Confetti, { CORES_OURO } from '@/components/Confetti';
import { limparInstagram, limparWhatsapp, mascararWhatsapp } from '@/lib/matricula';
import { MENTORIA, linkWhatsappTime } from '@/lib/leads';

/* ══════════════════════════════════════════════════════════════
   APLICAÇÃO DA MENTORIA — /mentoria (tela cheia, sem guard)

   Pra quem quer o acompanhamento do time e furar a fila. Perguntas
   diretas e estratégicas em 5 etapas; no fim, a pessoa chama o time
   no WhatsApp com mensagem pronta. Identidade da mentoria: preto e
   dourado, tipografia serifada.

   Logada: grava com user_id. Sem login: pede e-mail, entra como 'link'.
   ══════════════════════════════════════════════════════════════ */

type Etapa = 'capa' | 0 | 1 | 2 | 3 | 4 | 'fim';
const TOTAL = 5;

const ETAPAS: { rotulo: string; titulo: string; sub: string }[] = [
  { rotulo: 'Você',        titulo: 'Quem está aplicando',        sub: 'O time vai te chamar por aqui.' },
  { rotulo: 'Negócio',     titulo: 'Seu negócio hoje',           sub: 'Onde você está antes de acelerar.' },
  { rotulo: 'Números',     titulo: 'Os números, sem rodeio',     sub: 'É com isso que o time monta a estratégia.' },
  { rotulo: 'Decisão',     titulo: 'Como você decide',           sub: 'Pra alinhar o próximo passo com quem importa.' },
  { rotulo: 'Objetivo',    titulo: 'Dificuldade e desejo',       sub: 'O que trava e o que você quer conquistar.' },
];

/* ── Paleta ── */
const OURO = '#D4AF37';
const OURO_CLARO = '#F1D27A';
const PRETO = '#0B0B0C';
const GRAFITE = '#161618';
const gradOuro = `linear-gradient(135deg, ${OURO_CLARO} 0%, ${OURO} 45%, #B8860B 100%)`;

/* ── Peças de UI (tema escuro) ── */
const Rotulo: React.FC<{ children: React.ReactNode; opcional?: boolean }> = ({ children, opcional }) => (
  <label className="flex items-baseline justify-between mb-2">
    <span className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: OURO }}>{children}</span>
    {opcional && <span className="text-[9px] font-semibold text-white/35 tracking-wider">opcional</span>}
  </label>
);

const campoCls = 'w-full rounded-xl px-4 py-3.5 text-[14px] text-white placeholder:text-white/30 outline-none transition-shadow';
const campoStyle: React.CSSProperties = { background: GRAFITE, border: '1px solid rgba(212,175,55,0.28)' };

const Campo: React.FC<{
  rotulo: string; valor: string; onChange: (v: string) => void;
  placeholder?: string; tipo?: string; opcional?: boolean; prefixo?: string; autoFocus?: boolean; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}> = ({ rotulo, valor, onChange, placeholder, tipo = 'text', opcional, prefixo, autoFocus, inputMode }) => (
  <div>
    <Rotulo opcional={opcional}>{rotulo}</Rotulo>
    <div className="relative">
      {prefixo && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-bold" style={{ color: OURO }}>{prefixo}</span>}
      <input type={tipo} inputMode={inputMode} value={valor} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`${campoCls} ${prefixo ? 'pl-9' : ''} focus:ring-4 focus:ring-[#D4AF37]/15 focus:border-[#D4AF37]`}
        style={campoStyle} />
    </div>
  </div>
);

const Area: React.FC<{ rotulo: string; valor: string; onChange: (v: string) => void; placeholder?: string; opcional?: boolean; linhas?: number }> =
  ({ rotulo, valor, onChange, placeholder, opcional, linhas = 4 }) => (
  <div>
    <Rotulo opcional={opcional}>{rotulo}</Rotulo>
    <textarea value={valor} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={linhas}
      className={`${campoCls} resize-none leading-relaxed focus:ring-4 focus:ring-[#D4AF37]/15 focus:border-[#D4AF37]`} style={campoStyle} />
  </div>
);

const Chips: React.FC<{ rotulo: string; opcoes: readonly string[]; valor: string; onChange: (v: string) => void; opcional?: boolean }> =
  ({ rotulo, opcoes, valor, onChange, opcional }) => (
  <div>
    <Rotulo opcional={opcional}>{rotulo}</Rotulo>
    <div className="flex flex-wrap gap-2">
      {opcoes.map(o => {
        const ativo = valor === o;
        return (
          <button key={o} type="button" onClick={() => onChange(ativo ? '' : o)}
            className="rounded-full px-3.5 py-2 text-[12px] font-semibold transition-all active:scale-95"
            style={{
              background: ativo ? gradOuro : GRAFITE,
              color: ativo ? PRETO : 'rgba(255,255,255,0.8)',
              border: ativo ? '1px solid transparent' : '1px solid rgba(212,175,55,0.3)',
              boxShadow: ativo ? '0 8px 20px -8px rgba(212,175,55,0.7)' : 'none',
              WebkitTapHighlightColor: 'transparent',
            }}>
            {o}
          </button>
        );
      })}
    </div>
  </div>
);

/* Cartão da aplicação — preto com "foil" dourado. */
const Cartao: React.FC<{ nome?: string; confirmado?: boolean }> = ({ nome, confirmado }) => (
  <div className="relative mx-auto w-full max-w-[340px]">
    <div className="rounded-[22px] relative overflow-hidden"
      style={{
        background: confirmado ? gradOuro : `linear-gradient(160deg, #1C1C1F 0%, ${PRETO} 60%, #17150C 100%)`,
        border: confirmado ? '1px solid rgba(255,255,255,0.4)' : `1px solid rgba(212,175,55,0.45)`,
        boxShadow: confirmado ? '0 24px 50px -20px rgba(212,175,55,0.7)' : '0 24px 50px -22px rgba(212,175,55,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}>
      {/* reflexo passando */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -inset-y-10 w-20 rotate-12"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)', animation: 'card-shine 3.6s ease-in-out infinite' }} />
      </div>
      {/* filete dourado */}
      {!confirmado && <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: gradOuro }} />}

      <div className="px-6 pt-6 pb-5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-[0.3em]" style={{ color: confirmado ? PRETO : OURO }}>
            Aplicação · Mentoria
          </span>
          <Crown size={18} style={{ color: confirmado ? PRETO : OURO }} />
        </div>
        <p className="mt-6 font-serif text-[24px] leading-[1.05]" style={{ color: confirmado ? PRETO : 'white' }}>
          Acompanhamento<br />do time
        </p>
        <p className="mt-2 text-[11px]" style={{ color: confirmado ? 'rgba(11,11,12,0.7)' : 'rgba(255,255,255,0.55)' }}>
          {nome ? `${nome.split(' ')[0]}` : 'Seu nome aqui'} · fila prioritária
        </p>
      </div>
      <div className="mx-5 border-t" style={{ borderColor: confirmado ? 'rgba(11,11,12,0.25)' : 'rgba(212,175,55,0.25)' }} />
      <div className="px-6 py-4 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: confirmado ? PRETO : 'rgba(255,255,255,0.75)' }}>
          {confirmado ? 'Recebida' : 'Preencha a aplicação'}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] rounded-full px-2.5 py-1"
          style={confirmado ? { background: PRETO, color: OURO_CLARO } : { background: 'rgba(212,175,55,0.12)', color: OURO, border: '1px solid rgba(212,175,55,0.35)' }}>
          {confirmado ? <Check size={11} strokeWidth={3} /> : <Zap size={11} />} {confirmado ? 'Prioridade' : 'Fure a fila'}
        </span>
      </div>
    </div>
    <style>{`@keyframes card-shine { 0% { left: -30%; } 60%, 100% { left: 130%; } }`}</style>
  </div>
);

/* ══════════════════════════════════════════════════════════════ */
const Mentoria: React.FC = () => {
  const navigate = useLocalizedNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const anonimo = !user;

  const [etapa, setEtapa] = useState<Etapa>('capa');
  const [direcao, setDirecao] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [confete, setConfete] = useState(false);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [r, setR] = useState<Record<string, string>>({});
  const [profissaoOutra, setProfissaoOutra] = useState('');
  const set = (k: string) => (v: string) => setR(x => ({ ...x, [k]: v }));

  useEffect(() => {
    if (authLoading) return;
    setNome(n => n || profile?.full_name || '');
    setInstagram(i => i || profile?.instagram || '');
  }, [authLoading, profile]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [etapa]);
  useEffect(() => {
    const antes = document.title;
    document.title = 'Aplicação · Mentoria Amentora';
    return () => { document.title = antes; };
  }, []);

  const emailOk = !anonimo || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const profissaoFinal = r.profissao === 'Outra' ? profissaoOutra.trim() : (r.profissao ?? '');

  const valida = useMemo<Record<number, boolean>>(() => ({
    0: nome.trim().length >= 2 && emailOk && limparWhatsapp(whatsapp).length >= 10 && limparInstagram(instagram).length >= 2,
    1: !!profissaoFinal && !!r.tempo && !!r.equipe,
    2: !!r.faturamento && !!r.meta && !!r.divida && !!r.investimento,
    3: !!r.decisao && !!r.urgencia && !!r.ja_investiu,
    4: !!r.dificuldade && (r.desejo ?? '').trim().length >= 10,
  }), [nome, emailOk, whatsapp, instagram, profissaoFinal, r]);

  const ir = (para: Etapa, dir: 1 | -1) => { setDirecao(dir); setEtapa(para); };

  const enviar = async () => {
    setSalvando(true);
    const respostas: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) if (v && v.trim()) respostas[k] = v.trim();
    respostas.profissao = profissaoFinal;
    const { error } = await supabase.from('leads').insert({
      user_id: user?.id ?? null,
      tipo: 'mentoria',
      origem: user ? 'app' : 'link',
      email: user?.email ?? (email.trim().toLowerCase() || null),
      nome: nome.trim(),
      whatsapp: limparWhatsapp(whatsapp),
      instagram: limparInstagram(instagram) || null,
      respostas,
    });
    setSalvando(false);
    if (error) { toast.error('Não deu pra enviar', { description: error.message }); return; }
    setConfete(true);
    ir('fim', 1);
  };

  const voltar = () => {
    if (etapa === 'capa' || etapa === 'fim') { navigate(user ? '/modulo/boas-vindas-a-comunidade/aula/1' : '/auth'); return; }
    if (etapa === 0) { ir('capa', -1); return; }
    ir((etapa - 1) as Etapa, -1);
  };

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: PRETO }}>
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: OURO }} />
      </div>
    );
  }

  const numero = typeof etapa === 'number' ? etapa : null;
  const entrada = { initial: { x: direcao * 40, opacity: 0 }, animate: { x: 0, opacity: 1 } };
  const resumo = [profissaoFinal, r.faturamento ? `faturo ${r.faturamento}` : ''].filter(Boolean).join(', ');

  return (
    <div className="min-h-[100dvh] relative overflow-x-hidden text-white" style={{ background: PRETO }}>
      {confete && <Confetti cores={CORES_OURO} />}

      {/* fundo: brilho dourado difuso + linhas finas */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.16), transparent 62%)' }} />
        <div className="absolute bottom-[-180px] -right-24 w-[420px] h-[420px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.10), transparent 65%)' }} />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(rgba(212,175,55,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.6) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
      </div>

      <div className="relative max-w-lg mx-auto px-4 pt-4 pb-32">
        {/* topo */}
        <div className="flex items-center gap-3">
          {!(anonimo && typeof etapa !== 'number') && (
            <button onClick={voltar} aria-label="Voltar"
              className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{ background: GRAFITE, border: '1px solid rgba(212,175,55,0.35)', color: OURO }}>
              <ArrowLeft size={17} strokeWidth={2.5} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.28em]" style={{ color: OURO }}>Mentoria · Aplicação</p>
            <p className="text-[11px] font-semibold text-white/80 truncate">
              {numero !== null ? `Etapa ${numero + 1} de ${TOTAL} · ${ETAPAS[numero].rotulo}` : etapa === 'fim' ? 'Aplicação recebida' : 'Acompanhamento do time'}
            </p>
          </div>
        </div>

        {numero !== null && (
          <div className="flex gap-1.5 mt-4">
            {ETAPAS.map((_, i) => (
              <div key={i} className="h-[3px] flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(212,175,55,0.18)' }}>
                <motion.div className="h-full rounded-full" style={{ background: gradOuro }}
                  initial={false} animate={{ width: i <= numero ? '100%' : '0%' }} transition={{ duration: 0.45, ease: 'easeOut' }} />
              </div>
            ))}
          </div>
        )}

        {/* ── CAPA ── */}
        {etapa === 'capa' && (
          <motion.div key="capa" {...entrada} transition={{ duration: 0.28 }} className="mt-8">
            <motion.div initial={{ y: 16, opacity: 0, rotate: 2 }} animate={{ y: 0, opacity: 1, rotate: -1.5 }} transition={{ delay: 0.1, type: 'spring', stiffness: 160 }}>
              <Cartao nome={nome} />
            </motion.div>

            <p className="mt-9 text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: OURO }}>Para quem quer acelerar</p>
            <h1 className="mt-2 font-serif text-[32px] leading-[1.02] text-white">
              Fure a fila e tenha<br /><span style={{ color: OURO_CLARO }}>o time do seu lado.</span>
            </h1>
            <p className="mt-4 text-[14px] leading-relaxed text-white/65">
              Esta aplicação é pra quem quer <strong className="text-white">acompanhamento direto do nosso time</strong> pra fazer o negócio crescer mais rápido.
              Perguntas diretas, sem enrolação. No fim, você fala com a gente na hora.
            </p>

            <ul className="mt-6 space-y-2.5">
              {ETAPAS.map((e, i) => (
                <li key={e.rotulo} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: GRAFITE, border: '1px solid rgba(212,175,55,0.16)' }}>
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: gradOuro, color: PRETO }}>{i + 1}</span>
                  <span className="text-[12px] font-semibold text-white/85">{e.rotulo}</span>
                  <span className="ml-auto text-[10px] text-white/35">{e.sub}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* ── ETAPAS ── */}
        {numero !== null && (
          <motion.div key={`etapa-${numero}`} {...entrada} transition={{ duration: 0.28 }} className="mt-6">
            <h2 className="font-serif text-[26px] leading-tight text-white">{ETAPAS[numero].titulo}</h2>
            <p className="mt-1 text-[12px] text-white/50">{ETAPAS[numero].sub}</p>

            <div className="mt-6 space-y-6">
              {numero === 0 && (
                <>
                  <Campo rotulo="Nome completo" valor={nome} onChange={setNome} placeholder="Seu nome" autoFocus={!nome} />
                  {anonimo && <Campo rotulo="E-mail" valor={email} onChange={setEmail} placeholder="voce@email.com" tipo="email" inputMode="email" />}
                  <Campo rotulo="WhatsApp" valor={whatsapp} onChange={v => setWhatsapp(mascararWhatsapp(v))} placeholder="(11) 99999-9999" tipo="tel" inputMode="tel" />
                  <Campo rotulo="Instagram" valor={instagram} onChange={setInstagram} placeholder="seu.perfil" prefixo="@" />
                </>
              )}
              {numero === 1 && (
                <>
                  <Chips rotulo="Sua profissão" opcoes={MENTORIA.profissao} valor={r.profissao ?? ''} onChange={set('profissao')} />
                  {r.profissao === 'Outra' && <Campo rotulo="Qual?" valor={profissaoOutra} onChange={setProfissaoOutra} placeholder="Escreva sua profissão" autoFocus />}
                  <Chips rotulo="Tempo na área" opcoes={MENTORIA.tempo} valor={r.tempo ?? ''} onChange={set('tempo')} />
                  <Chips rotulo="Quem trabalha com você" opcoes={MENTORIA.equipe} valor={r.equipe ?? ''} onChange={set('equipe')} />
                  <Campo rotulo="Cidade e estado" valor={r.cidade ?? ''} onChange={set('cidade')} placeholder="Ex.: Curitiba, PR" opcional />
                </>
              )}
              {numero === 2 && (
                <>
                  <Chips rotulo="Quanto você fatura por mês hoje" opcoes={MENTORIA.faturamento} valor={r.faturamento ?? ''} onChange={set('faturamento')} />
                  <Chips rotulo="Onde quer chegar em 12 meses (por mês)" opcoes={MENTORIA.meta} valor={r.meta ?? ''} onChange={set('meta')} />
                  <Chips rotulo="Você tem dívidas hoje?" opcoes={MENTORIA.divida} valor={r.divida ?? ''} onChange={set('divida')} />
                  <Chips rotulo="Quanto consegue investir por mês no seu crescimento" opcoes={MENTORIA.investimento} valor={r.investimento ?? ''} onChange={set('investimento')} />
                </>
              )}
              {numero === 3 && (
                <>
                  <Chips rotulo="Alguém decide junto com você?" opcoes={MENTORIA.decisao} valor={r.decisao ?? ''} onChange={set('decisao')} />
                  <Chips rotulo="Quando você quer começar" opcoes={MENTORIA.urgencia} valor={r.urgencia ?? ''} onChange={set('urgencia')} />
                  <Chips rotulo="Já investiu em curso ou mentoria antes?" opcoes={MENTORIA.jaInvestiu} valor={r.ja_investiu ?? ''} onChange={set('ja_investiu')} />
                </>
              )}
              {numero === 4 && (
                <>
                  <Chips rotulo="O que mais trava seu negócio hoje" opcoes={MENTORIA.dificuldade} valor={r.dificuldade ?? ''} onChange={set('dificuldade')} />
                  <Area rotulo="Quer detalhar essa dificuldade?" valor={r.dificuldade_detalhe ?? ''} onChange={set('dificuldade_detalhe')} placeholder="Conta como isso aparece no seu dia a dia" opcional linhas={3} />
                  <Area rotulo="O que você deseja alcançar com o acompanhamento" valor={r.desejo ?? ''} onChange={set('desejo')} placeholder="Faturamento, agenda, posicionamento, liberdade... seja específica" linhas={4} />
                  <Area rotulo="Por que agora?" valor={r.por_que_agora ?? ''} onChange={set('por_que_agora')} placeholder="O que muda na sua vida se isso for resolvido nos próximos meses?" opcional linhas={3} />
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* ── FIM ── */}
        {etapa === 'fim' && (
          <motion.div key="fim" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }} className="mt-8">
            <motion.div initial={{ y: 20, opacity: 0, rotate: -3 }} animate={{ y: 0, opacity: 1, rotate: 1.5 }} transition={{ delay: 0.15, type: 'spring', stiffness: 150 }}>
              <Cartao nome={nome} confirmado />
            </motion.div>

            <div className="mt-9 text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{ color: OURO, border: '1px solid rgba(212,175,55,0.35)', background: 'rgba(212,175,55,0.08)' }}>
                <Sparkles size={12} /> Aplicação recebida
              </div>
              <h1 className="mt-4 font-serif text-[32px] leading-[1.02] text-white">
                {nome.split(' ')[0] || 'Pronto'},<br /><span style={{ color: OURO_CLARO }}>agora é com o time.</span>
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-white/65">
                Sua aplicação já está na fila prioritária. <strong className="text-white">Chame o time agora no WhatsApp</strong> pra gente já começar a conversa com as suas respostas em mãos.
              </p>
            </div>

            <div className="mt-7">
              <a href={linkWhatsappTime(nome, resumo)} target="_blank" rel="noopener noreferrer"
                className="w-full rounded-xl py-4 flex items-center justify-center gap-2 text-[14px] font-bold active:scale-[0.98] transition-transform"
                style={{ background: gradOuro, color: PRETO, boxShadow: '0 14px 30px -12px rgba(212,175,55,0.8)' }}>
                <MessageCircle size={18} strokeWidth={2.5} /> Falar com o time agora
              </a>
              <p className="mt-3 text-center text-[11px] text-white/40">+34 664 30 18 75 · abre o WhatsApp com sua mensagem pronta</p>
              <button onClick={() => navigate(user ? '/home' : '/auth')}
                className="mt-4 w-full py-3 rounded-xl text-[12px] font-semibold text-white/70"
                style={{ background: GRAFITE, border: '1px solid rgba(212,175,55,0.2)' }}>
                {user ? 'Voltar para a comunidade' : 'Já sou aluna · entrar na comunidade'}
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ação fixa embaixo */}
      {etapa !== 'fim' && (
        <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
          <div className="max-w-lg mx-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-6 pointer-events-auto"
            style={{ background: `linear-gradient(180deg, rgba(11,11,12,0) 0%, ${PRETO} 40%)` }}>
            {etapa === 'capa' ? (
              <button onClick={() => ir(0, 1)}
                className="w-full rounded-xl py-4 text-[14px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                style={{ background: gradOuro, color: PRETO, boxShadow: '0 14px 30px -12px rgba(212,175,55,0.8)' }}>
                Iniciar minha aplicação <ArrowRight size={17} strokeWidth={2.5} />
              </button>
            ) : numero === TOTAL - 1 ? (
              <button onClick={enviar} disabled={!valida[numero!] || salvando}
                className="w-full rounded-xl py-4 text-[14px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
                style={{ background: gradOuro, color: PRETO, boxShadow: '0 14px 30px -12px rgba(212,175,55,0.8)' }}>
                {salvando ? <Loader2 size={17} className="animate-spin" /> : <Crown size={17} strokeWidth={2.5} />}
                Enviar aplicação e falar com o time
              </button>
            ) : (
              <button onClick={() => ir((numero! + 1) as Etapa, 1)} disabled={!valida[numero!]}
                className="w-full rounded-xl py-4 text-[14px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
                style={{ background: gradOuro, color: PRETO }}>
                Continuar <ArrowRight size={17} strokeWidth={2.5} />
              </button>
            )}
            {numero !== null && !valida[numero] && (
              <p className="text-center text-[10px] text-white/40 mt-2">Responda os campos desta etapa pra continuar</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Mentoria;
