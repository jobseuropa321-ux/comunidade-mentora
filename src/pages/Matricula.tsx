import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Ticket, Sparkles, Check, Loader2, MessageCircle, PartyPopper, Pencil, Mic, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalizedNavigate } from '@/i18n/LanguageProvider';
import Confetti from '@/components/Confetti';
import VoiceField from '@/components/VoiceField';
import {
  GRUPO_INGRESSO_URL, MATRICULA_VAZIA, OPCOES, type Matricula,
  limparInstagram, limparWhatsapp, mascararWhatsapp, useMinhaMatricula,
} from '@/lib/matricula';

/* ══════════════════════════════════════════════════════════════
   FICHA DE MATRÍCULA — /matricula (tela cheia, fora do AppLayout)

   UMA pergunta por tela, sem mostrar "x de y": barra que vai enchendo,
   balão de incentivo que muda conforme avança, opção escolhida já pula
   pra próxima. Quem preenche tudo ganha o ingresso do evento: a tela
   final manda pro grupo (GRUPO_INGRESSO_URL). Já preencheu? Cai direto
   na tela final, com a opção de editar (mesma linha, upsert por user_id).

   Perguntas abertas aceitam ÁUDIO (VoiceField → transcribe-audio). A
   function exige sessão, então o microfone só aparece pra quem está
   logada — na ficha pública (/ficha, sem conta) fica só o texto.

   Campanha em português — textos direto no código, de propósito.
   ══════════════════════════════════════════════════════════════ */

type Etapa = 'capa' | number | 'fim';
type Tipo = 'texto' | 'email' | 'tel' | 'insta' | 'longo' | 'chips';

interface Pergunta {
  id: string;
  /** campo do form; 'email' e 'areaOutra' são estados à parte */
  campo: keyof Matricula | 'email' | 'areaOutra';
  tipo: Tipo;
  titulo: string;
  sub?: string;
  placeholder?: string;
  opcoes?: readonly string[];
  opcional?: boolean;
  linhas?: number;
  /** só entra na sequência quando devolve true */
  quando?: (ctx: { anonimo: boolean; form: Matricula }) => boolean;
}

const PERGUNTAS: Pergunta[] = [
  { id: 'nome', campo: 'nome', tipo: 'texto', titulo: 'Como você quer ser chamada?', sub: 'Seu nome completo, do jeito que você gosta.', placeholder: 'Seu nome completo' },
  { id: 'email', campo: 'email', tipo: 'email', titulo: 'Qual o seu melhor e-mail?', sub: 'É por ele que a gente te avisa do evento.', placeholder: 'voce@email.com', quando: c => c.anonimo },
  { id: 'whatsapp', campo: 'whatsapp', tipo: 'tel', titulo: 'Qual o seu WhatsApp?', sub: 'Com DDD. É por aqui que o ingresso chega.', placeholder: '(11) 99999-9999' },
  { id: 'instagram', campo: 'instagram', tipo: 'insta', titulo: 'Qual o seu Instagram?', sub: 'A gente vai te seguir de volta.', placeholder: 'seu.perfil' },
  { id: 'cidade', campo: 'cidade', tipo: 'texto', titulo: 'De onde você fala?', sub: 'Cidade e estado.', placeholder: 'Ex.: Campinas, SP', opcional: true },
  { id: 'idade', campo: 'idade', tipo: 'chips', titulo: 'Qual a sua idade?', opcoes: OPCOES.idade, opcional: true },
  { id: 'area', campo: 'area_atuacao', tipo: 'chips', titulo: 'Em qual área você atua?', opcoes: OPCOES.area },
  { id: 'areaOutra', campo: 'areaOutra', tipo: 'texto', titulo: 'Qual é a sua área?', placeholder: 'Escreva sua área', quando: c => c.form.area_atuacao === 'Outra' },
  { id: 'tempo', campo: 'tempo_atuacao', tipo: 'chips', titulo: 'Há quanto tempo você atua?', opcoes: OPCOES.tempo },
  { id: 'onde', campo: 'onde_atende', tipo: 'chips', titulo: 'Onde você atende?', opcoes: OPCOES.onde, opcional: true },
  { id: 'faturamento', campo: 'faturamento', tipo: 'chips', titulo: 'Quanto você fatura por mês hoje?', sub: 'Sem julgamento: é daqui que a gente traça o plano.', opcoes: OPCOES.faturamento },
  { id: 'meta', campo: 'meta_faturamento', tipo: 'chips', titulo: 'Qual a sua meta mensal pros próximos 6 meses?', opcoes: OPCOES.meta },
  { id: 'sobre', campo: 'sobre_voce', tipo: 'longo', titulo: 'Conta um pouco da sua história', sub: 'Como você chegou até aqui, o que faz no dia a dia, o que te move.', placeholder: 'Escreve aqui...', linhas: 5 },
  { id: 'dificuldade', campo: 'maior_dificuldade', tipo: 'chips', titulo: 'O que mais te trava hoje?', opcoes: OPCOES.dificuldade },
  { id: 'motivo', campo: 'motivo_compra', tipo: 'longo', titulo: 'O que te fez entrar na comunidade?', sub: 'O que pesou na decisão?', placeholder: 'Escreve aqui...' },
  { id: 'expectativa', campo: 'expectativa', tipo: 'longo', titulo: 'O que você espera da comunidade?', sub: 'Onde você quer estar daqui a 6 meses com a ajuda da gente?', placeholder: 'Escreve aqui...' },
  { id: 'conheceu', campo: 'como_conheceu', tipo: 'chips', titulo: 'Como você conheceu a gente?', opcoes: OPCOES.conheceu },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const respostaOk = (p: Pergunta, v: string) => {
  if (p.opcional) return true;
  switch (p.tipo) {
    case 'email': return EMAIL_RE.test(v.trim());
    case 'tel': return limparWhatsapp(v).length >= 10;
    case 'insta': return limparInstagram(v).length >= 2;
    case 'longo': return v.trim().length >= 10;
    case 'chips': return !!v;
    default: return v.trim().length >= 2;
  }
};

/* Balão de incentivo. Nunca fala número: só a sensação de estar avançando. */
const mensagemBalao = (i: number, n: number, nome: string) => {
  const primeiro = nome.trim().split(' ')[0];
  if (i === 0) return 'Oi! Vamos começar? Uma pergunta de cada vez, no seu ritmo ✨';
  if (i === n - 1) return 'Última pergunta! Depois dessa o ingresso é seu 🎟️';
  const f = i / (n - 1);
  if (f < 0.3) return `Boa${primeiro ? `, ${primeiro}` : ''}! Tá indo super bem 🔥`;
  if (f < 0.55) return 'Metade do caminho já foi 💪';
  if (f < 0.8) return 'Estamos quase finalizando! 🎉';
  return 'Falta pouquinho, seu ingresso tá quase no seu nome ✨';
};

/* ── Peças de UI ── */
const campoCls = 'w-full rounded-2xl bg-white border-2 border-[#BE0D3E]/20 px-4 py-3.5 text-[15px] text-[#1E1B11] placeholder:text-[#5B4041]/35 outline-none focus:border-[#BE0D3E] focus:ring-4 focus:ring-[#BE0D3E]/10 transition-shadow';

const Campo: React.FC<{
  valor: string; onChange: (v: string) => void;
  placeholder?: string; tipo?: string; prefixo?: string; autoFocus?: boolean; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}> = ({ valor, onChange, placeholder, tipo = 'text', prefixo, autoFocus, inputMode }) => (
  <div className="relative">
    {prefixo && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-[#BE0D3E]">{prefixo}</span>}
    <input
      type={tipo} inputMode={inputMode} value={valor} autoFocus={autoFocus}
      onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`${campoCls} ${prefixo ? 'pl-9' : ''}`}
    />
  </div>
);

const Chips: React.FC<{ opcoes: readonly string[]; valor: string; onChange: (v: string) => void }> = ({ opcoes, valor, onChange }) => (
  <div className="flex flex-wrap gap-2.5">
    {opcoes.map((o, i) => {
      const ativo = valor === o;
      return (
        <motion.button key={o} type="button" onClick={() => onChange(ativo ? '' : o)}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i, duration: 0.2 }}
          className="rounded-full px-4 py-2.5 text-[13px] font-bold transition-all active:scale-95"
          style={{
            background: ativo ? 'linear-gradient(135deg, #BE0D3E, #94002D)' : 'white',
            color: ativo ? 'white' : '#5B4041',
            border: ativo ? '1px solid transparent' : '1px solid rgba(190,13,62,0.18)',
            boxShadow: ativo ? '0 6px 16px -6px rgba(190,13,62,0.6)' : 'none',
            WebkitTapHighlightColor: 'transparent',
          }}>
          {o}
        </motion.button>
      );
    })}
  </div>
);

/* Balãozinho da "mentora" acima da pergunta. A chave é o texto: quando a
   mensagem muda, ele entra de novo com o pulinho. */
const Balao: React.FC<{ texto: string }> = ({ texto }) => (
  <motion.div key={texto} initial={{ y: 10, opacity: 0, scale: 0.94 }} animate={{ y: 0, opacity: 1, scale: 1 }}
    transition={{ type: 'spring', stiffness: 280, damping: 18 }} className="flex items-end gap-2">
    <img src="/logo-icon.png" alt="" className="w-9 h-9 rounded-full shrink-0 object-cover shadow-sm" />
    <div className="relative bg-white border border-[#BE0D3E]/12 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[12.5px] font-bold text-[#1E1B11] shadow-[0_6px_18px_-10px_rgba(190,13,62,0.5)]">
      {texto}
    </div>
  </motion.div>
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
/* `publico` = rota /ficha, sem login: lead de fora do app. Sem conta não
   tem user_id nem edição depois — a ficha entra como origem 'link'. Aluna
   logada que abrir /ficha segue o fluxo normal (uma ficha, editável). */
const Matricula: React.FC<{ publico?: boolean }> = ({ publico = false }) => {
  const navigate = useLocalizedNavigate();
  const { user, profile } = useAuth();
  const anonimo = publico && !user;
  const podeAudio = !!user;
  const [email, setEmail] = useState('');
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
  useEffect(() => {
    if (!publico) return;
    const antes = document.title;
    document.title = 'Ficha de matrícula · Comunidade Amentora';
    return () => { document.title = antes; };
  }, [publico]);

  const set = <K extends keyof Matricula>(k: K) => (v: Matricula[K]) => setForm(f => ({ ...f, [k]: v }));

  const perguntas = useMemo(() => PERGUNTAS.filter(p => !p.quando || p.quando({ anonimo, form })), [anonimo, form]);
  const total = perguntas.length;

  const valorDe = (p: Pergunta): string =>
    p.campo === 'email' ? email : p.campo === 'areaOutra' ? areaOutra : String(form[p.campo] ?? '');
  const mudar = (p: Pergunta, v: string) => {
    if (p.campo === 'email') setEmail(v);
    else if (p.campo === 'areaOutra') setAreaOutra(v);
    else if (p.campo === 'whatsapp') set('whatsapp')(mascararWhatsapp(v));
    else set(p.campo as keyof Matricula)(v as never);
  };

  const areaFinal = form.area_atuacao === 'Outra' ? areaOutra.trim() : form.area_atuacao;

  const ir = (para: Etapa, dir: 1 | -1) => { setDirecao(dir); setEtapa(para); };

  const enviar = async () => {
    if (!user && !anonimo) return;
    setSalvando(true);
    const linha = {
      user_id: user?.id ?? null,
      email: user?.email ?? email.trim().toLowerCase() ?? null,
      origem: publico ? 'link' : 'app',
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
    const { error } = anonimo
      ? await supabase.from('matriculas').insert(linha)
      : await supabase.from('matriculas').upsert(linha, { onConflict: 'user_id' });
    setSalvando(false);
    if (error) { toast.error('Não deu pra enviar', { description: error.message }); return; }
    setConfete(true);
    ir('fim', 1);
    reload();
  };

  const voltar = () => {
    if (etapa === 'capa' || etapa === 'fim') { navigate(anonimo ? '/auth' : '/modulo/boas-vindas-a-comunidade/aula/1'); return; }
    if (etapa === 0) { ir('capa', -1); return; }
    ir(etapa - 1, -1);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#FFF9EE] flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-[#BE0D3E] animate-spin" />
      </div>
    );
  }

  const numero = typeof etapa === 'number' ? Math.min(etapa, total - 1) : null;
  const atual = numero !== null ? perguntas[numero] : null;
  const valorAtual = atual ? valorDe(atual) : '';
  const ok = atual ? respostaOk(atual, valorAtual) : false;
  const ultima = numero !== null && numero === total - 1;
  const pular = !!atual?.opcional && !valorAtual;

  /* Continuar: última pergunta envia; senão vai pra próxima. O índice vem
     do clique (não do estado) pra funcionar dentro do setTimeout dos chips. */
  const avancar = (de: number) => {
    if (de >= total - 1) { enviar(); return; }
    ir(de + 1, 1);
  };
  const escolher = (p: Pergunta, v: string, de: number) => {
    mudar(p, v);
    // escolheu uma opção → já pula pra próxima (menos na última, que envia)
    if (v && de < total - 1) window.setTimeout(() => avancar(de), 260);
  };

  // Só animação de ENTRADA (a chave muda por pergunta). Saída via AnimatePresence
  // travava no meio e a pergunta seguinte nunca aparecia.
  const entrada = { initial: { x: direcao * 40, opacity: 0 }, animate: { x: 0, opacity: 1 } };
  const progresso = numero !== null ? ((numero + 1) / total) * 100 : 0;
  const dicaAudio = podeAudio && (atual?.tipo === 'longo' || atual?.tipo === 'texto');

  return (
    <div className="min-h-[100dvh] bg-[#FFF9EE] relative overflow-x-hidden">
      {confete && <Confetti />}

      {/* fundo: brilhos da marca */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(224,107,133,0.28), transparent 65%)' }} />
        <div className="absolute top-[38%] -left-24 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(246,180,58,0.22), transparent 65%)' }} />
        <div className="absolute -bottom-20 right-[-10%] w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(190,13,62,0.16), transparent 65%)' }} />
      </div>

      <div className="relative max-w-lg mx-auto px-4 pt-4 pb-36">
        {/* topo */}
        <div className="flex items-center gap-3">
          {!(anonimo && typeof etapa !== 'number') && (
            <button onClick={voltar} aria-label="Voltar"
              className="glass-btn-pink shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-95 transition-transform">
              <ArrowLeft size={17} strokeWidth={2.5} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#BE0D3E]">Ficha de matrícula</p>
            <p className="text-[11px] font-bold text-[#1E1B11] truncate">
              {numero !== null ? 'Seu ingresso está sendo preparado' : etapa === 'fim' ? 'Ingresso garantido' : 'Comunidade Amentora'}
            </p>
          </div>
        </div>

        {/* progresso: barra que enche + ingresso na ponta. Sem número. */}
        {numero !== null && (
          <div className="flex items-center gap-2.5 mt-4">
            <div className="h-2 flex-1 rounded-full bg-[#F6D6DC]/70 overflow-hidden">
              <motion.div className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #E63462, #BE0D3E 60%, #F6B43A)' }}
                initial={false} animate={{ width: `${progresso}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }} />
            </div>
            <motion.span key={numero} initial={{ scale: 0.6, rotate: -12 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 14 }}
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #F6B43A, #E09A1F)', boxShadow: '0 6px 14px -6px rgba(246,180,58,0.9)' }}>
              <Ticket size={14} className="text-[#1E1B11]" strokeWidth={2.5} />
            </motion.span>
          </div>
        )}

        <>
          {/* ── CAPA ── */}
          {etapa === 'capa' && (
            <motion.div key="capa" {...entrada} transition={{ duration: 0.28 }} className="mt-8">
              <motion.div initial={{ y: 16, opacity: 0, rotate: -3 }} animate={{ y: 0, opacity: 1, rotate: -2 }} transition={{ delay: 0.1, type: 'spring', stiffness: 160 }}>
                <Ingresso nome={form.nome} />
              </motion.div>

              <h1 className="mt-9 text-[30px] font-black leading-[1.02] text-[#1E1B11]">
                Sua matrícula vale<br /><span className="text-[#BE0D3E]">um ingresso.</span>
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-[#5B4041]/80">
                Responda a ficha e você garante <strong className="text-[#1E1B11]">1 ingresso para o evento exclusivo</strong> da comunidade.
                É uma pergunta de cada vez, rapidinho{podeAudio ? ', e você pode responder por áudio' : ''}.
              </p>

              <ul className="mt-5 space-y-2.5">
                {[
                  { icone: <Zap size={14} strokeWidth={2.5} />, texto: 'Uma pergunta por vez, no seu ritmo' },
                  ...(podeAudio ? [{ icone: <Mic size={14} strokeWidth={2.5} />, texto: 'Pode escrever ou responder por áudio' }] : []),
                  { icone: <Ticket size={14} strokeWidth={2.5} />, texto: 'No final, o ingresso sai no seu nome' },
                ].map((item, i) => (
                  <motion.li key={item.texto} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
                    className="flex items-center gap-3 bg-white/70 border border-[#BE0D3E]/10 rounded-2xl px-4 py-3">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg, #BE0D3E, #94002D)' }}>{item.icone}</span>
                    <span className="text-[12px] font-bold text-[#1E1B11]">{item.texto}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* ── PERGUNTA (uma por tela) ── */}
          {atual && numero !== null && (
            <motion.div key={`p-${atual.id}`} {...entrada} transition={{ duration: 0.28 }} className="mt-6">
              <Balao texto={mensagemBalao(numero, total, form.nome)} />

              <form className="mt-6" onSubmit={e => { e.preventDefault(); if (ok && !salvando) avancar(numero); }}>
                <h2 className="text-[26px] font-black leading-tight text-[#1E1B11]">{atual.titulo}</h2>
                {atual.sub && <p className="mt-1.5 text-[12.5px] text-[#5B4041]/70">{atual.sub}</p>}
                {atual.opcional && <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#5B4041]/40">opcional</p>}

                <div className="mt-6">
                  {atual.tipo === 'chips' && (
                    <Chips opcoes={atual.opcoes!} valor={valorAtual} onChange={v => escolher(atual, v, numero)} />
                  )}
                  {atual.tipo === 'longo' && (podeAudio ? (
                    <VoiceField value={valorAtual} onChange={v => mudar(atual, v)} placeholder={atual.placeholder} rows={atual.linhas ?? 4} autoFocus={!valorAtual} />
                  ) : (
                    <textarea value={valorAtual} onChange={e => mudar(atual, e.target.value)} placeholder={atual.placeholder} rows={atual.linhas ?? 4} autoFocus={!valorAtual}
                      className={`${campoCls} resize-none leading-relaxed`} />
                  ))}
                  {atual.tipo === 'texto' && (podeAudio ? (
                    <VoiceField value={valorAtual} onChange={v => mudar(atual, v)} placeholder={atual.placeholder} multiline={false} autoFocus={!valorAtual} />
                  ) : (
                    <Campo valor={valorAtual} onChange={v => mudar(atual, v)} placeholder={atual.placeholder} autoFocus={!valorAtual} />
                  ))}
                  {atual.tipo === 'email' && (
                    <Campo valor={valorAtual} onChange={v => mudar(atual, v)} placeholder={atual.placeholder} tipo="email" inputMode="email" autoFocus={!valorAtual} />
                  )}
                  {atual.tipo === 'tel' && (
                    <Campo valor={valorAtual} onChange={v => mudar(atual, v)} placeholder={atual.placeholder} tipo="tel" inputMode="tel" autoFocus={!valorAtual} />
                  )}
                  {atual.tipo === 'insta' && (
                    <Campo valor={valorAtual} onChange={v => mudar(atual, v)} placeholder={atual.placeholder} prefixo="@" autoFocus={!valorAtual} />
                  )}
                </div>

                {dicaAudio && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                    className="mt-3 flex items-center gap-1.5 text-[11.5px] font-bold text-[#BE0D3E]">
                    <Mic size={13} strokeWidth={2.5} /> Prefere falar? Aperta o microfone e responde por áudio.
                  </motion.p>
                )}
                {atual.tipo === 'chips' && (
                  <p className="mt-4 text-[11px] text-[#5B4041]/55">Escolheu? A próxima já aparece.</p>
                )}
                {/* Enter no teclado avança (o botão de baixo faz o mesmo) */}
                <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
              </form>
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
                    <p className="text-[11px] text-[#5B4041]/70 mt-1">Seu ingresso já está reservado no seu nome. Volte aqui pela aula "Boas-vindas à comunidade".</p>
                  </div>
                )}
                {anonimo ? (
                  <button onClick={() => navigate('/auth')}
                    className="mt-3 w-full py-3 rounded-2xl text-[12px] font-bold text-[#5B4041] bg-white/70 border border-[#BE0D3E]/12">
                    Já sou aluna · entrar na comunidade
                  </button>
                ) : (
                  <button onClick={() => { setConfete(false); ir(0, -1); }}
                    className="mt-3 w-full py-3 rounded-2xl text-[12px] font-bold text-[#5B4041] bg-white/70 border border-[#BE0D3E]/12 flex items-center justify-center gap-1.5">
                    <Pencil size={13} /> Editar minhas respostas
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </>
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
            ) : ultima ? (
              <button onClick={() => avancar(numero!)} disabled={!ok || salvando}
                className="card-glass-liquid-lime w-full rounded-2xl py-4 text-[14px] font-black text-[#1E1B11] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-45">
                {salvando ? <Loader2 size={17} className="animate-spin" /> : <Ticket size={17} strokeWidth={2.5} />}
                Enviar ficha e garantir ingresso
              </button>
            ) : pular ? (
              <button onClick={() => avancar(numero!)}
                className="w-full rounded-2xl py-4 text-[14px] font-black text-[#5B4041] bg-white/80 border border-[#BE0D3E]/15 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                Pular essa <ArrowRight size={17} strokeWidth={2.5} />
              </button>
            ) : (
              <button onClick={() => avancar(numero!)} disabled={!ok}
                className="glass-btn-pink w-full rounded-2xl py-4 text-[14px] font-black text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-45">
                Continuar <ArrowRight size={17} strokeWidth={2.5} />
              </button>
            )}
            {atual && !ok && !pular && (
              <p className="text-center text-[10px] text-[#5B4041]/55 mt-2">
                {atual.tipo === 'longo' ? 'Escreve (ou fala) um pouquinho mais pra continuar' : 'Responde essa pra continuar'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Matricula;
