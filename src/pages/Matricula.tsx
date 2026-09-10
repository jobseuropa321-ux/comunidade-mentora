import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Ticket, Sparkles, Check, Loader2, MessageCircle, PartyPopper, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalizedNavigate } from '@/i18n/LanguageProvider';
import Confetti from '@/components/Confetti';
import {
  GRUPO_INGRESSO_URL, MATRICULA_VAZIA, OPCOES, type Matricula,
  limparInstagram, limparWhatsapp, mascararWhatsapp, useMinhaMatricula,
} from '@/lib/matricula';

/* ══════════════════════════════════════════════════════════════
   FICHA DE MATRÍCULA — /matricula (tela cheia, fora do AppLayout)

   Wizard em 5 etapas + capa + tela final com confete. Quem preenche tudo
   ganha o ingresso do evento exclusivo: a tela final manda pro grupo
   (GRUPO_INGRESSO_URL). Já preencheu? Cai direto na tela final, com a
   opção de editar as respostas (mesma linha, upsert por user_id).

   Campanha em português — textos direto no código, de propósito.
   ══════════════════════════════════════════════════════════════ */

type Etapa = 'capa' | 0 | 1 | 2 | 3 | 4 | 'fim';
const TOTAL = 5;

const ETAPAS: { rotulo: string; titulo: string; sub: string }[] = [
  { rotulo: 'Quem é você',   titulo: 'Prazer em te conhecer',       sub: 'O básico pra gente te chamar pelo nome.' },
  { rotulo: 'Seu trabalho',  titulo: 'Conta do seu trabalho',       sub: 'Pra gente entender de onde você está partindo.' },
  { rotulo: 'Seus números',  titulo: 'Vamos falar de dinheiro',     sub: 'Sem julgamento: é daqui que a gente traça o plano.' },
  { rotulo: 'Sobre você',    titulo: 'Agora, sobre você',           sub: 'Sua história e o que mais te trava hoje.' },
  { rotulo: 'A comunidade',  titulo: 'O que você espera daqui',     sub: 'A última etapa. Depois dela, seu ingresso.' },
];

/* ── Peças de UI ── */
const Rotulo: React.FC<{ children: React.ReactNode; opcional?: boolean }> = ({ children, opcional }) => (
  <label className="flex items-baseline justify-between mb-1.5">
    <span className="text-[10px] font-black uppercase tracking-widest text-[#5B4041]">{children}</span>
    {opcional && <span className="text-[9px] font-bold text-[#5B4041]/40">opcional</span>}
  </label>
);

const campoCls = 'w-full rounded-2xl bg-white border border-[#BE0D3E]/15 px-4 py-3.5 text-[14px] text-[#1E1B11] placeholder:text-[#5B4041]/35 outline-none focus:border-[#BE0D3E] focus:ring-4 focus:ring-[#BE0D3E]/10 transition-shadow';

const Campo: React.FC<{
  rotulo: string; valor: string; onChange: (v: string) => void;
  placeholder?: string; tipo?: string; opcional?: boolean; prefixo?: string; autoFocus?: boolean; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}> = ({ rotulo, valor, onChange, placeholder, tipo = 'text', opcional, prefixo, autoFocus, inputMode }) => (
  <div>
    <Rotulo opcional={opcional}>{rotulo}</Rotulo>
    <div className="relative">
      {prefixo && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-bold text-[#BE0D3E]">{prefixo}</span>}
      <input
        type={tipo} inputMode={inputMode} value={valor} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`${campoCls} ${prefixo ? 'pl-9' : ''}`}
      />
    </div>
  </div>
);

const Area: React.FC<{ rotulo: string; valor: string; onChange: (v: string) => void; placeholder?: string; opcional?: boolean; linhas?: number }> =
  ({ rotulo, valor, onChange, placeholder, opcional, linhas = 4 }) => (
  <div>
    <Rotulo opcional={opcional}>{rotulo}</Rotulo>
    <textarea value={valor} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={linhas}
      className={`${campoCls} resize-none leading-relaxed`} />
    <p className="text-right text-[9px] text-[#5B4041]/35 mt-1 tabular-nums">{valor.trim().length} caracteres</p>
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
);

/* Ingresso — o "prêmio" que aparece na capa e no fim. */
const Ingresso: React.FC<{ nome?: string; confirmado?: boolean }> = ({ nome, confirmado }) => (
  <div className="relative mx-auto w-full max-w-[340px]">
    <div className="rounded-3xl overflow-hidden relative"
      style={{
        background: confirmado
          ? 'linear-gradient(135deg, #F6B43A 0%, #E09A1F 100%)'
          : 'linear-gradient(135deg, #BE0D3E 0%, #7C0026 100%)',
        boxShadow: confirmado ? '0 20px 40px -18px rgba(246,180,58,0.8)' : '0 20px 40px -18px rgba(190,13,62,0.8)',
      }}>
      {/* brilho que passa */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -inset-y-10 w-24 rotate-12"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)', animation: 'ticket-shine 3.2s ease-in-out infinite' }} />
      </div>
      {/* furos da picotagem */}
      <div className="absolute left-0 right-0 flex justify-between px-0" style={{ top: 'calc(100% - 62px)' }}>
        <div className="w-5 h-5 -ml-2.5 rounded-full bg-[#FFF9EE]" />
        <div className="w-5 h-5 -mr-2.5 rounded-full bg-[#FFF9EE]" />
      </div>

      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <span className={`text-[9px] font-black uppercase tracking-[0.25em] ${confirmado ? 'text-[#1E1B11]/70' : 'text-[#F6B43A]'}`}>
            Ingresso · 1 pessoa
          </span>
          <Ticket size={18} className={confirmado ? 'text-[#1E1B11]' : 'text-white/80'} />
        </div>
        <p className={`mt-5 text-[22px] font-black leading-[1.05] ${confirmado ? 'text-[#1E1B11]' : 'text-white'}`}>
          Evento exclusivo<br />da comunidade
        </p>
        <p className={`mt-2 text-[11px] font-semibold ${confirmado ? 'text-[#1E1B11]/70' : 'text-white/70'}`}>
          {nome ? `Em nome de ${nome.split(' ')[0]}` : 'Em nome de: você'}
        </p>
      </div>
      <div className="mx-5 border-t border-dashed" style={{ borderColor: confirmado ? 'rgba(30,27,17,0.25)' : 'rgba(255,255,255,0.3)' }} />
      <div className="px-6 py-4 flex items-center justify-between">
        <span className={`text-[10px] font-black uppercase tracking-widest ${confirmado ? 'text-[#1E1B11]' : 'text-white/85'}`}>
          {confirmado ? 'Confirmado' : 'Preencha a ficha'}
        </span>
        <span className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 ${confirmado ? 'bg-[#1E1B11] text-[#F6B43A]' : 'bg-white/15 text-white'}`}>
          {confirmado ? <Check size={11} strokeWidth={3} /> : <Sparkles size={11} />} {confirmado ? 'Garantido' : 'Ganhe o seu'}
        </span>
      </div>
    </div>
    <style>{`@keyframes ticket-shine { 0% { left: -30%; } 60%, 100% { left: 130%; } }`}</style>
  </div>
);

/* ══════════════════════════════════════════════════════════════ */
const Matricula: React.FC = () => {
  const navigate = useLocalizedNavigate();
  const { user, profile } = useAuth();
  const { matricula, loading, reload } = useMinhaMatricula();

  const [etapa, setEtapa] = useState<Etapa>('capa');
  const [direcao, setDirecao] = useState(1);
  const [form, setForm] = useState<Matricula>(MATRICULA_VAZIA);
  const [areaOutra, setAreaOutra] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [confete, setConfete] = useState(false);

  // Já tem ficha → tela final direto. Senão pré-preenche com o perfil.
  useEffect(() => {
    if (loading) return;
    if (matricula) {
      setForm({ ...MATRICULA_VAZIA, ...matricula });
      if (!OPCOES.area.includes(matricula.area_atuacao as typeof OPCOES.area[number])) setAreaOutra(matricula.area_atuacao);
      setEtapa('fim');
    } else {
      setForm(f => ({
        ...f,
        nome: f.nome || profile?.full_name || '',
        instagram: f.instagram || profile?.instagram || '',
      }));
    }
  }, [loading, matricula, profile]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [etapa]);

  const set = <K extends keyof Matricula>(k: K) => (v: Matricula[K]) => setForm(f => ({ ...f, [k]: v }));

  const areaFinal = form.area_atuacao === 'Outra' ? areaOutra.trim() : form.area_atuacao;

  const valida = useMemo<Record<number, boolean>>(() => ({
    0: form.nome.trim().length >= 2 && limparWhatsapp(form.whatsapp).length >= 10 && limparInstagram(form.instagram).length >= 2,
    1: !!areaFinal && !!form.tempo_atuacao,
    2: !!form.faturamento && !!form.meta_faturamento,
    3: form.sobre_voce.trim().length >= 10 && !!form.maior_dificuldade,
    4: form.motivo_compra.trim().length >= 10 && form.expectativa.trim().length >= 10 && !!form.como_conheceu,
  }), [form, areaFinal]);

  const ir = (para: Etapa, dir: 1 | -1) => { setDirecao(dir); setEtapa(para); };

  const enviar = async () => {
    if (!user) return;
    setSalvando(true);
    const linha = {
      user_id: user.id,
      email: user.email ?? null,
      nome: form.nome.trim(),
      whatsapp: limparWhatsapp(form.whatsapp),
      instagram: limparInstagram(form.instagram),
      cidade: form.cidade.trim() || null,
      idade: form.idade || null,
      area_atuacao: areaFinal,
      tempo_atuacao: form.tempo_atuacao || null,
      onde_atende: form.onde_atende || null,
      faturamento: form.faturamento,
      meta_faturamento: form.meta_faturamento || null,
      sobre_voce: form.sobre_voce.trim() || null,
      maior_dificuldade: form.maior_dificuldade || null,
      motivo_compra: form.motivo_compra.trim() || null,
      expectativa: form.expectativa.trim() || null,
      como_conheceu: form.como_conheceu || null,
    };
    const { error } = await supabase.from('matriculas').upsert(linha, { onConflict: 'user_id' });
    setSalvando(false);
    if (error) { toast.error('Não deu pra enviar', { description: error.message }); return; }
    setConfete(true);
    ir('fim', 1);
    reload();
  };

  const voltar = () => {
    if (etapa === 'capa' || etapa === 'fim') { navigate('/modulo/comece-por-aqui/aula/1'); return; }
    if (etapa === 0) { ir('capa', -1); return; }
    ir((etapa - 1) as Etapa, -1);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#FFF9EE] flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-[#BE0D3E] animate-spin" />
      </div>
    );
  }

  const numero = typeof etapa === 'number' ? etapa : null;
  const slide = {
    initial: (d: number) => ({ x: d * 40, opacity: 0 }),
    animate: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d * -40, opacity: 0 }),
  };

  return (
    <div className="min-h-[100dvh] bg-[#FFF9EE] relative overflow-x-hidden">
      {confete && <Confetti />}

      {/* fundo: brilhos da marca */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(224,107,133,0.28), transparent 65%)' }} />
        <div className="absolute top-[38%] -left-24 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(246,180,58,0.22), transparent 65%)' }} />
        <div className="absolute -bottom-20 right-[-10%] w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(190,13,62,0.16), transparent 65%)' }} />
      </div>

      <div className="relative max-w-lg mx-auto px-4 pt-4 pb-32">
        {/* topo */}
        <div className="flex items-center gap-3">
          <button onClick={voltar} aria-label="Voltar"
            className="glass-btn-pink shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-95 transition-transform">
            <ArrowLeft size={17} strokeWidth={2.5} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#BE0D3E]">Ficha de matrícula</p>
            <p className="text-[11px] font-bold text-[#1E1B11] truncate">
              {numero !== null ? `Etapa ${numero + 1} de ${TOTAL} · ${ETAPAS[numero].rotulo}` : etapa === 'fim' ? 'Ingresso garantido' : 'Comunidade Amentora'}
            </p>
          </div>
        </div>

        {/* progresso */}
        {numero !== null && (
          <div className="flex gap-1.5 mt-4">
            {ETAPAS.map((_, i) => (
              <div key={i} className="h-1.5 flex-1 rounded-full bg-[#F6D6DC]/70 overflow-hidden">
                <motion.div className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #E63462, #BE0D3E)' }}
                  initial={false} animate={{ width: i < numero ? '100%' : i === numero ? '100%' : '0%' }}
                  transition={{ duration: 0.45, ease: 'easeOut' }} />
              </div>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait" custom={direcao}>
          {/* ── CAPA ── */}
          {etapa === 'capa' && (
            <motion.div key="capa" custom={direcao} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.28 }} className="mt-8">
              <motion.div initial={{ y: 16, opacity: 0, rotate: -3 }} animate={{ y: 0, opacity: 1, rotate: -2 }} transition={{ delay: 0.1, type: 'spring', stiffness: 160 }}>
                <Ingresso nome={form.nome} />
              </motion.div>

              <h1 className="mt-9 text-[30px] font-black leading-[1.02] text-[#1E1B11]">
                Sua matrícula vale<br /><span className="text-[#BE0D3E]">um ingresso.</span>
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-[#5B4041]/80">
                Responda a ficha completa e você garante <strong className="text-[#1E1B11]">1 ingresso para o evento exclusivo</strong> da comunidade.
                São 5 etapas rápidas, e as respostas ajudam a gente a montar o caminho certo pra você.
              </p>

              <ul className="mt-5 space-y-2.5">
                {ETAPAS.map((e, i) => (
                  <li key={e.rotulo} className="flex items-center gap-3 bg-white/70 border border-[#BE0D3E]/10 rounded-2xl px-4 py-3">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg, #BE0D3E, #94002D)' }}>{i + 1}</span>
                    <span className="text-[12px] font-bold text-[#1E1B11]">{e.rotulo}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* ── ETAPAS ── */}
          {numero !== null && (
            <motion.div key={`etapa-${numero}`} custom={direcao} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.28 }} className="mt-6">
              <h2 className="text-[24px] font-black leading-tight text-[#1E1B11]">{ETAPAS[numero].titulo}</h2>
              <p className="mt-1 text-[12px] text-[#5B4041]/70">{ETAPAS[numero].sub}</p>

              <div className="mt-6 space-y-5">
                {numero === 0 && (
                  <>
                    <Campo rotulo="Seu nome completo" valor={form.nome} onChange={set('nome')} placeholder="Como você quer ser chamada" autoFocus={!form.nome} />
                    <Campo rotulo="WhatsApp" valor={form.whatsapp} onChange={v => set('whatsapp')(mascararWhatsapp(v))} placeholder="(11) 99999-9999" tipo="tel" inputMode="tel" />
                    <Campo rotulo="Instagram" valor={form.instagram} onChange={set('instagram')} placeholder="seu.perfil" prefixo="@" />
                    <Campo rotulo="Cidade e estado" valor={form.cidade} onChange={set('cidade')} placeholder="Ex.: Campinas, SP" opcional />
                    <Chips rotulo="Sua idade" opcoes={OPCOES.idade} valor={form.idade} onChange={set('idade')} opcional />
                  </>
                )}

                {numero === 1 && (
                  <>
                    <Chips rotulo="Em qual área você atua?" opcoes={OPCOES.area} valor={form.area_atuacao} onChange={set('area_atuacao')} />
                    {form.area_atuacao === 'Outra' && (
                      <Campo rotulo="Qual área?" valor={areaOutra} onChange={setAreaOutra} placeholder="Escreva sua área" autoFocus />
                    )}
                    <Chips rotulo="Há quanto tempo?" opcoes={OPCOES.tempo} valor={form.tempo_atuacao} onChange={set('tempo_atuacao')} />
                    <Chips rotulo="Onde você atende?" opcoes={OPCOES.onde} valor={form.onde_atende} onChange={set('onde_atende')} opcional />
                  </>
                )}

                {numero === 2 && (
                  <>
                    <Chips rotulo="Quanto você fatura por mês hoje?" opcoes={OPCOES.faturamento} valor={form.faturamento} onChange={set('faturamento')} />
                    <Chips rotulo="Qual a sua meta mensal para os próximos 6 meses?" opcoes={OPCOES.meta} valor={form.meta_faturamento} onChange={set('meta_faturamento')} />
                  </>
                )}

                {numero === 3 && (
                  <>
                    <Area rotulo="Conta um pouco da sua história" valor={form.sobre_voce} onChange={set('sobre_voce')}
                      placeholder="Como você chegou até aqui, o que faz no dia a dia, o que te move..." linhas={5} />
                    <Chips rotulo="O que mais te trava hoje?" opcoes={OPCOES.dificuldade} valor={form.maior_dificuldade} onChange={set('maior_dificuldade')} />
                  </>
                )}

                {numero === 4 && (
                  <>
                    <Area rotulo="O que te fez entrar na comunidade?" valor={form.motivo_compra} onChange={set('motivo_compra')}
                      placeholder="O que pesou na decisão de comprar?" />
                    <Area rotulo="O que você espera da comunidade?" valor={form.expectativa} onChange={set('expectativa')}
                      placeholder="Onde você quer estar daqui a 6 meses com a ajuda da comunidade?" />
                    <Chips rotulo="Como você conheceu a gente?" opcoes={OPCOES.conheceu} valor={form.como_conheceu} onChange={set('como_conheceu')} />
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* ── FIM ── */}
          {etapa === 'fim' && (
            <motion.div key="fim" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }} className="mt-8">
              <motion.div initial={{ y: 20, opacity: 0, rotate: 4 }} animate={{ y: 0, opacity: 1, rotate: 2 }} transition={{ delay: 0.15, type: 'spring', stiffness: 150 }}>
                <Ingresso nome={form.nome} confirmado />
              </motion.div>

              <div className="mt-9 text-center">
                <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#BE0D3E]" style={{ background: 'rgba(190,13,62,0.08)' }}>
                  <PartyPopper size={12} /> Matrícula concluída
                </div>
                <h1 className="mt-4 text-[30px] font-black leading-[1.02] text-[#1E1B11]">
                  Boas-vindas,<br /><span className="text-[#BE0D3E]">{form.nome.split(' ')[0] || 'aluna'}!</span>
                </h1>
                <p className="mt-3 text-[14px] leading-relaxed text-[#5B4041]/80">
                  Sua ficha está registrada e seu ingresso está reservado. <strong className="text-[#1E1B11]">Para garantir o ingresso, é só entrar no grupo abaixo.</strong>
                </p>
              </div>

              <div className="mt-7">
                {GRUPO_INGRESSO_URL ? (
                  <a href={GRUPO_INGRESSO_URL} target="_blank" rel="noopener noreferrer"
                    className="card-glass-liquid-lime w-full rounded-2xl py-4 flex items-center justify-center gap-2 text-[14px] font-black text-[#1E1B11] active:scale-[0.98] transition-transform">
                    <MessageCircle size={18} strokeWidth={2.5} /> Entrar no grupo e garantir o ingresso
                  </a>
                ) : (
                  <div className="w-full rounded-2xl py-4 px-4 text-center bg-white border border-dashed border-[#BE0D3E]/30">
                    <p className="text-[12px] font-black text-[#1E1B11]">O link do grupo chega em breve</p>
                    <p className="text-[11px] text-[#5B4041]/70 mt-1">Seu ingresso já está reservado no seu nome. Volte aqui pela aula "Comece por aqui".</p>
                  </div>
                )}
                <button onClick={() => { setConfete(false); ir(0, -1); }}
                  className="mt-3 w-full py-3 rounded-2xl text-[12px] font-bold text-[#5B4041] bg-white/70 border border-[#BE0D3E]/12 flex items-center justify-center gap-1.5">
                  <Pencil size={13} /> Editar minhas respostas
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ação fixa embaixo (não usa inset-0: o teclado do iPhone empurra normal) */}
      {etapa !== 'fim' && (
        <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
          <div className="max-w-lg mx-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-6 pointer-events-auto"
            style={{ background: 'linear-gradient(180deg, rgba(255,249,238,0) 0%, #FFF9EE 40%)' }}>
            {etapa === 'capa' ? (
              <button onClick={() => ir(0, 1)}
                className="glass-btn-pink w-full rounded-2xl py-4 text-[14px] font-black text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                Começar minha ficha <ArrowRight size={17} strokeWidth={2.5} />
              </button>
            ) : numero === TOTAL - 1 ? (
              <button onClick={enviar} disabled={!valida[numero!] || salvando}
                className="card-glass-liquid-lime w-full rounded-2xl py-4 text-[14px] font-black text-[#1E1B11] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-45">
                {salvando ? <Loader2 size={17} className="animate-spin" /> : <Ticket size={17} strokeWidth={2.5} />}
                Enviar ficha e garantir ingresso
              </button>
            ) : (
              <button onClick={() => ir((numero! + 1) as Etapa, 1)} disabled={!valida[numero!]}
                className="glass-btn-pink w-full rounded-2xl py-4 text-[14px] font-black text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-45">
                Continuar <ArrowRight size={17} strokeWidth={2.5} />
              </button>
            )}
            {numero !== null && !valida[numero] && (
              <p className="text-center text-[10px] text-[#5B4041]/55 mt-2">Preencha os campos desta etapa pra continuar</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Matricula;
