import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Send, RotateCcw, Mic,
  Library as LibraryIcon, Save, Check, Loader2, X,
  Blocks, Layers, ChevronRight, Sparkles, Zap, CircleHelp,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { supabase, SUPABASE_READY } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { readFnError } from '@/lib/functionsError';
import { useKeyboardViewport } from '@/hooks/useKeyboardViewport';
import { rolarConversa } from '@/lib/chatScroll';
import { loadChatDraft, saveChatDraft, clearChatDraft, type ChatDraft } from '@/lib/chatDraft';
import { useAgents, CATEGORIES, categoryLabel, defaultOpening, type Agent } from '@/data/agents';
import VoiceField from '@/components/VoiceField';
import { Robot, SceneFX, ACCENT, type RobotKind } from '@/components/estudio/AgentRobot';
import AnalisarPerfilAgent from '@/components/estudio/AnalisarPerfilAgent';
import { useLocalizedNavigate, useCurrentLang } from '@/i18n/LanguageProvider';
import { withAiLangMessages } from '@/i18n/aiLang';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';

/* ─────────────────────────────────────────────
   TEXTOS DA TELA (toda a "escrita" daqui)
───────────────────────────────────────────── */
/* Os textos vivem no dicionário (src/i18n/locales). makeTxt monta o mesmo
   objeto TXT que os componentes já usavam — inclusive as funções que
   interpolam — só que resolvido no idioma da URL.

   É um hook porque TXT é consumido por 6 componentes desta tela; assim cada
   um pega `const TXT = useTxt()` e nada mais muda no corpo deles. */
const makeTxt = (t: (k: string, o?: Record<string, unknown>) => string) => ({
  grid_title: t('chat.grid_title'),
  grid_subtitle: t('chat.grid_subtitle'),
  your_models: t('chat.your_models'),
  library: t('chat.library'),
  create_btn: t('chat.create_btn'),
  agent_word: t('chat.agent_word'),
  saved: t('chat.saved'),
  save: t('chat.save'),
  saving_lesson: t('chat.saving_lesson'),
  retry_save: t('chat.retry_save'),
  answer_required: t('chat.answer_required'),
  answer_below: t('chat.answer_below'),
  next_lesson: t('chat.next_lesson'),
  next_lesson_hint: t('chat.next_lesson_hint'),
  next_lesson_extra: t('chat.next_lesson_extra'),
  resume_badge: (n: number) => t('chat.resume_badge', { n }),
  resume_restart: t('chat.resume_restart'),
  resume_loading: t('chat.resume_loading'),
  resume_display: (curso: string, n: number) => t('chat.resume_display', { curso, n }),
  next_lesson_extra_hint: t('chat.next_lesson_extra_hint'),
  lesson_saved: t('chat.lesson_saved'),
  placeholder: t('chat.placeholder'),
  transcribing: t('chat.transcribing'),
  recording: t('chat.recording'),
  keyboard_hint: t('chat.keyboard_hint'),
  cancel_recording: t('chat.cancel_recording'),
  stop_recording: t('chat.stop_recording'),
  record_audio: t('chat.record_audio'),
  save_to_library: t('chat.save_to_library'),
  save_modal_label: t('chat.save_modal_label'),
  save_modal_placeholder: t('chat.save_modal_placeholder'),
  save_course_label: t('chat.save_course_label'),
  exit_title: t('chat.exit_title'),
  exit_desc: t('chat.exit_desc'),
  exit_discard: t('chat.exit_discard'),
  exit_save: t('chat.exit_save'),
  cancel: t('chat.cancel'),
  saving: t('chat.saving'),
  toast_name_required: t('chat.toast_name_required'),
  toast_save_error: t('chat.toast_save_error'),
  toast_saved: t('chat.toast_saved'),
  toast_audio_error: t('chat.toast_audio_error'),
  toast_transcription_failed: t('chat.toast_transcription_failed'),
  toast_transcription_error: t('chat.toast_transcription_error'),
  error_prefix: t('chat.error_prefix'),
  error_retry: t('chat.error_retry'),
  unknown_error: t('chat.unknown_error'),
  backend_pending: t('chat.backend_pending'),
  toast_backend_pending: t('chat.toast_backend_pending'),
  limit_chats_segment: (limit: number | undefined, segment: string) =>
    t('chat.limit_chats_segment', { limit: limit ?? '', segment }),
  limit_reached_msg: (detail: string) => t('chat.limit_reached_msg', { detail }),
  limit_messages_msg: (limit: number) => t('chat.limit_messages_msg', { limit }),
});

const useTxt = () => makeTxt(useTranslation().t);

/* ID de sessão com fallback — crypto.randomUUID não existe em contexto
   não-HTTPS (ex.: testar o PWA via IP na rede local) nem em Safari antigo. */
const newSessionId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/* Quantas aulas o esqueleto promete — usado só pra barra de progresso.

   O Arquiteto não segue um formato fixo, então na prática o esqueleto sai
   de duas formas (conferido nos esqueletos salvos das alunas):

     A) cabeçalho "### Aulas:" e a lista numerada embaixo  (o caso comum)
        ### Aulas:
        1. **Boas-vindas ao curso**
        2. **O que é o Efeito Fox**

     B) o número no próprio título
        ### Aula 1. Boas-vindas ao curso

   Conta por OCORRÊNCIA, nunca por número distinto: a numeração recomeça a
   cada módulo (todo módulo tem uma "1."), então contar números diferentes
   dizia "5 aulas" num curso de 50. Só os itens que estão DEBAIXO de um
   cabeçalho de aulas entram — senão listas de "Formato ideal", "Bônus" e
   afins virariam aula.

   É uma ESTIMATIVA: o texto é livre e sempre vai ter esqueleto fora do
   padrão. Por isso nada trava quando ela erra — o total acompanha se a
   pessoa continuar criando além da conta. */
const countLessonsInSkeleton = (content: string) => {
  const ehCabecalho = (l: string) => /^\s*#{1,6}\s*\S/.test(l) || /^\s*\*\*[^*]+\*\*\s*:?\s*$/.test(l);
  const ehCabecalhoDeAulas = (l: string) => /^\s*(?:#{1,6}\s*)?\*{0,2}\s*(?:aulas?|clases?)\b[^\n]{0,24}$/i.test(l);
  const ehTituloDeAula = (l: string) => /^\s*(?:#{1,6}\s*)?\*{0,2}\s*(?:aulas?|clases?)\s*\d{1,3}\b/i.test(l);
  const ehItemNumerado = (l: string) => /^\s*\d{1,3}[.)]\s+\S/.test(l);

  let dentroDaLista = false;
  let total = 0;

  for (const linha of content.split('\n')) {
    if (ehTituloDeAula(linha)) { total++; dentroDaLista = false; continue; }   // formato B
    if (ehItemNumerado(linha)) { if (dentroDaLista) total++; continue; }        // formato A
    if (ehCabecalho(linha)) dentroDaLista = ehCabecalhoDeAulas(linha);
  }

  return Math.max(total, 1);
};

/* ═════════════════════════════════════════════
   ESTÚDIO DE CRIAÇÃO — hub dos agentes
   (robôs SVG personalizados + cenas animadas: ver AgentRobot.tsx)
═════════════════════════════════════════════ */
const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 220, damping: 24 } },
};

/* ── Card de um agente (palco + conteúdo) ── */
const AgentCard: React.FC<{ agent: Agent; index: number; reduce: boolean; onOpen: () => void }> = ({
  agent, index, reduce, onOpen,
}) => {
  const TXT = useTxt();
  const { t } = useTranslation();
  const kind = agent.category as RobotKind;
  const cat = CATEGORIES.find(c => c.id === agent.category);
  const a = ACCENT[kind] ?? ACCENT.estrutura;
  const num = String(index + 1).padStart(2, '0');
  return (
    <motion.button
      variants={cardVariants}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.975 }}
      onClick={onOpen}
      className="relative w-full flex items-stretch bg-white rounded-[22px] overflow-hidden border border-[#BE0D3E]/10 shadow-[0_12px_32px_-14px_rgba(148,0,45,0.22)] text-left"
      style={{ WebkitTapHighlightColor: 'transparent' }}
      aria-label={`${TXT.agent_word} ${num}: ${agent.name}`}
    >
      {/* palco do robô */}
      <div className="relative shrink-0 w-[118px] min-h-[136px] overflow-hidden" style={{ background: agent.gradient }}>
        <SceneFX kind={kind} reduce={reduce} />
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={reduce ? undefined : { y: [0, -4, 0] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.45 }}
        >
          <Robot kind={kind} reduce={reduce} />
        </motion.div>
      </div>

      {/* conteúdo */}
      <div className="relative flex-1 min-w-0 px-4 py-3.5 flex flex-col justify-center">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cat?.dot ?? ''}`} />
          <span className={`text-[8px] font-black uppercase tracking-[0.18em] ${cat?.color ?? ''}`}>
            {agent.bonus ? t('agentes.bonus') : `${TXT.agent_word} ${num}`} · {categoryLabel(cat?.id, t)}
          </span>
        </div>
        <h3 className="text-[17px] leading-tight font-bold text-[#1E1B11] mb-1">{agent.name}</h3>
        <p className="text-[10.5px] text-[#5B4041]/85 leading-relaxed mb-2 pr-2">{agent.desc}</p>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest" style={{ color: a.cta }}>
          {TXT.create_btn}
          <motion.span
            className="inline-flex"
            animate={reduce ? undefined : { x: [0, 3, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ArrowRight size={11} strokeWidth={3} />
          </motion.span>
        </span>
      </div>
    </motion.button>
  );
};

/* ── Conector tracejado entre as etapas ── */
const Connector: React.FC = () => (
  <motion.div variants={cardVariants} className="flex justify-center py-1" aria-hidden="true">
    <div className="h-5 border-l-2 border-dashed border-[#BE0D3E]/25" />
  </motion.div>
);

/* ── Divisor da seção BÔNUS (viralização — lime + rosa choque) ── */
const BonusDivider: React.FC = () => {
  const { t } = useTranslation();
  return (
  <motion.div variants={cardVariants} className="flex items-center gap-2 py-4">
    <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#FF2D7A]/45" />
    <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: '#E8226C' }}>
      <Zap size={11} className="fill-[#C8F000] text-[#C8F000]" /> {t('chat.bonusViralizacao')}
    </span>
    <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#C8F000]/70" />
  </motion.div>
  );
};

const FormatsGrid: React.FC = () => {
  const TXT = useTxt();
  const AGENTS = useAgents();
  const navigate = useLocalizedNavigate();
  const reduce = useReducedMotion() ?? false;

  return (
    <div className="pb-28 pt-1">
      {/* Header do Estúdio */}
      <div className="px-4 pt-3 mb-5 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <motion.h2
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-[27px] leading-[1.02] font-black mb-1.5 text-transparent bg-clip-text bg-gradient-to-r from-[#BE0D3E] to-[#E06B85] tracking-tight"
          >
            {TXT.grid_title}
          </motion.h2>
          <motion.p
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 0.9 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="text-[#5B4041] text-[11px] leading-snug max-w-[250px]"
          >
            {TXT.grid_subtitle}
          </motion.p>
        </div>
        <motion.button
          initial={reduce ? false : { opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.24, type: 'spring', stiffness: 260, damping: 18 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate('/biblioteca')}
          className="card-glass-liquid-pink shrink-0 rounded-2xl px-3 py-2 text-left"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <LibraryIcon size={11} className="text-white" />
            <span className="text-[7px] font-black uppercase tracking-widest text-white">{TXT.your_models}</span>
          </div>
          <h3 className="text-[16px] font-black text-white leading-tight">{TXT.library}</h3>
        </motion.button>
      </div>

      {/* Agentes: criação do curso + bônus de viralização */}
      <motion.div
        className="px-4"
        variants={{ show: { transition: { staggerChildren: 0.11, delayChildren: 0.15 } } }}
        initial={reduce ? 'show' : 'hidden'}
        animate="show"
      >
        {AGENTS.map((agent, i) => {
          const firstBonus = !!agent.bonus && (i === 0 || !AGENTS[i - 1].bonus);
          return (
            <React.Fragment key={agent.slug}>
              {firstBonus ? <BonusDivider /> : i > 0 ? <Connector /> : null}
              <AgentCard
                agent={agent}
                index={i}
                reduce={reduce}
                onOpen={() => navigate(`/chat/${agent.slug}`)}
              />
            </React.Fragment>
          );
        })}
      </motion.div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   CHAT
───────────────────────────────────────────── */
interface Message { role: 'user' | 'ia'; content: string; display?: string }
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const INITIAL_MSG = (agent: Agent, t: (k: string, o?: Record<string, unknown>) => string) =>
  agent.openingMessage ?? defaultOpening(agent.name, t);

const renderBold = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-bold text-[#BE0D3E]">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );

const Bubble: React.FC<{
  msg: Message;
  onSave?: () => void;
  saved?: boolean;
  saveStatus?: SaveStatus;
}> = ({ msg, onSave, saved, saveStatus = 'idle' }) => {
  const TXT = useTxt();
  const isIA = msg.role === 'ia';
  const lastMeaningfulLine = msg.content.split('\n').map(line => line.trim()).filter(Boolean).pop() ?? '';
  const asksForReply = isIA && /[?？]$/.test(lastMeaningfulLine);
  const isSaved = saved || saveStatus === 'saved';
  const isSaving = saveStatus === 'saving';
  const saveFailed = saveStatus === 'error';
  return (
    <div className={`flex ${isIA ? 'justify-start' : 'justify-end'}`}>
      <div className="flex flex-col max-w-[82%]">
        <div
          className={`px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-2xl ${
            isIA
              ? 'bg-[#FFFFFF] border border-[#BE0D3E]/15 text-[#5B4041] rounded-tl-sm'
              : 'text-white rounded-tr-sm'
          }`}
          style={!isIA ? {
            background: 'linear-gradient(135deg, #BE0D3E 0%, #BE0D3E 100%)',
          } : {}}
        >
          {isIA ? renderBold(msg.content) : (msg.display ?? msg.content)}
        </div>
        {asksForReply && (
          <div className="self-start mt-1.5 flex items-center gap-1.5 rounded-xl border border-[#F6B43A]/45 bg-[#FFF2CF] px-2.5 py-1.5 text-[10px] font-bold text-[#7A4C00]">
            <CircleHelp size={12} className="shrink-0" />
            <span>{TXT.answer_below}</span>
          </div>
        )}
        {isIA && onSave && (
          <button
            onClick={onSave}
            disabled={isSaved || isSaving}
            className={`self-start mt-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg transition-colors ${
              isSaved
                ? 'bg-green-500/10 text-green-600 cursor-default'
                : isSaving
                ? 'bg-[#F6B43A]/15 text-[#9A6200] cursor-wait'
                : saveFailed
                ? 'bg-red-50 border border-red-300/60 text-red-600'
                : 'bg-white border border-[#BE0D3E]/25 text-[#BE0D3E] hover:border-[#BE0D3E]/50'
            }`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {isSaved
              ? <><Check size={11} /> {TXT.saved}</>
              : isSaving
              ? <><Loader2 size={11} className="animate-spin" /> {TXT.saving_lesson}</>
              : saveFailed
              ? <><Save size={11} /> {TXT.retry_save}</>
              : <><Save size={11} /> {TXT.save}</>}
          </button>
        )}
      </div>
    </div>
  );
};

const Typing: React.FC = () => (
  <div className="flex justify-start">
    <div className="bg-[#FFFFFF] border border-[#BE0D3E]/15 px-4 py-3.5 rounded-2xl rounded-tl-sm flex gap-1.5 items-center">
      {[0, 150, 300].map(d => (
        <span
          key={d}
          className="w-1.5 h-1.5 bg-[#BE0D3E] rounded-full animate-bounce"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  </div>
);

/* ═════════════════════════════════════════════
   FORMULÁRIO-WIZARD DO ARQUITETO (agente-1)
   As perguntas que ele faz viram um formulário guiado.
   As respostas são compiladas na 1ª mensagem enviada à IA.
═════════════════════════════════════════════ */
const ARCHITECT_QUESTIONS: {
  key: string; grupo: string; required: boolean; multiline: boolean;
}[] = [
  { key: 'sobre', grupo: 'architect', required: true, multiline: true },
  { key: 'produto', grupo: 'architect', required: true, multiline: true },
  { key: 'nome', grupo: 'architect', required: false, multiline: false },
  { key: 'dor', grupo: 'architect', required: true, multiline: true },
  { key: 'ideia', grupo: 'architect', required: true, multiline: true },
  { key: 'aprender', grupo: 'architect', required: true, multiline: true },
  { key: 'transformacao', grupo: 'architect', required: true, multiline: true },
  { key: 'estrutura', grupo: 'architect', required: false, multiline: true },
];

/* ── Briefings dos formulários ──────────────────────────────────────────
   O texto vive no i18n (intake.briefing.*), não aqui: este briefing é a
   PRIMEIRA MENSAGEM que a aluna manda pra IA e aparece como balão dela na
   tela. Em português cru, a aluna espanhola via a própria mensagem em outro
   idioma — e, no caso do Pesquisa de Mercado, a IA ainda pesquisava o
   mercado BRASILEIRO porque "Brasil" estava fixo no template.
   Usamos i18n.t (e não o hook) porque isto roda fora de componente. */
const bt = (chave: string, vars: Record<string, string>) =>
  i18n.t(`intake.briefing.${chave}`, vars);
/** Lê a resposta; se vazia, usa o fallback traduzido de intake.fb.* */
const campo = (a: Record<string, string>, k: string, fb = 'traco') =>
  a[k]?.trim() ? a[k].trim() : i18n.t(`intake.fb.${fb}`);

/* Nome que já vem preenchido no modal "Salvar na Biblioteca". Também tem que
   acompanhar o idioma: a aluna espanhola via "Pesquisa — Fisioterapeuta" no
   campo (reportado em 2026-08-15). */
const nomeSalvo = (chave: string, valor?: string) => {
  const prefixo = i18n.t(`intake.nomeSalvo.${chave}`);
  const v = (valor ?? '').trim();
  return v ? `${prefixo} — ${v}` : prefixo;
};

const compileBriefing = (a: Record<string, string>) =>
  bt('arquiteto', {
    sobre: campo(a, 'sobre'),
    produto: campo(a, 'produto'),
    nome: campo(a, 'nome', 'semNome'),
    dor: campo(a, 'dor'),
    ideia: campo(a, 'ideia'),
    aprender: campo(a, 'aprender'),
    transformacao: campo(a, 'transformacao'),
    estrutura: campo(a, 'estrutura', 'semEstrutura'),
  });

/* ═════════════════════════════════════════════
   FORMULÁRIO DA APOSTILA (agente-3) — 5 perguntas próprias.
   Independente do esqueleto: o Apostila monta a própria estrutura.
═════════════════════════════════════════════ */
const APOSTILA_QUESTIONS: typeof ARCHITECT_QUESTIONS = [
  { key: 'expert', grupo: 'apostila', required: true, multiline: false },
  { key: 'tecnica', grupo: 'apostila', required: true, multiline: true },
  { key: 'conteudo', grupo: 'apostila', required: true, multiline: true },
  { key: 'nivel', grupo: 'apostila', required: true, multiline: false },
  { key: 'estilo', grupo: 'apostila', required: true, multiline: false },
];

const compileApostila = (a: Record<string, string>) =>
  bt('apostila', {
    expert: campo(a, 'expert'),
    tecnica: campo(a, 'tecnica'),
    conteudo: campo(a, 'conteudo'),
    nivel: campo(a, 'nivel'),
    estilo: campo(a, 'estilo'),
  });

/* ── Formulário do PESQUISA DE MERCADO (agente-4) — também independente ── */
const PESQUISA_QUESTIONS: typeof ARCHITECT_QUESTIONS = [
  { key: 'nicho', grupo: 'pesquisa', required: true, multiline: false },
  { key: 'publico', grupo: 'pesquisa', required: true, multiline: true },
  { key: 'ensina', grupo: 'pesquisa', required: true, multiline: true },
  { key: 'ajudou', grupo: 'pesquisa', required: false, multiline: true },
  { key: 'diferencial', grupo: 'pesquisa', required: false, multiline: true },
];

const compilePesquisa = (a: Record<string, string>) =>
  bt('pesquisa', {
    // o mercado acompanha o idioma: Brasil no PT, España no ES
    mercado: i18n.t('intake.mercado'),
    nicho: campo(a, 'nicho'),
    publico: campo(a, 'publico'),
    ensina: campo(a, 'ensina'),
    ajudou: campo(a, 'ajudou'),
    diferencial: campo(a, 'diferencial'),
  });

/* ── Nome Potente (agente-5) ── */
const NOME_QUESTIONS: typeof ARCHITECT_QUESTIONS = [
  { key: 'tipo', grupo: 'nome', required: true, multiline: false },
  { key: 'nome_prov', grupo: 'nome', required: false, multiline: false },
  { key: 'tema', grupo: 'nome', required: true, multiline: true },
  { key: 'publico', grupo: 'nome', required: true, multiline: false },
  { key: 'transformacao', grupo: 'nome', required: true, multiline: true },
  { key: 'diferencial', grupo: 'nome', required: false, multiline: true },
  { key: 'linguagem', grupo: 'nome', required: true, multiline: false },
];
const compileNome = (a: Record<string, string>) =>
  bt('nome', {
    tipo: campo(a, 'tipo'),
    nome_prov: campo(a, 'nome_prov', 'naoTem'),
    tema: campo(a, 'tema'),
    publico: campo(a, 'publico'),
    transformacao: campo(a, 'transformacao'),
    diferencial: campo(a, 'diferencial', 'naoInformado'),
    linguagem: campo(a, 'linguagem'),
  });

/* ── Promessa Irresistível (agente-6) ── */
const PROMESSA_QUESTIONS: typeof ARCHITECT_QUESTIONS = [
  { key: 'nome', grupo: 'promessa', required: true, multiline: false },
  { key: 'tipo', grupo: 'promessa', required: true, multiline: false },
  { key: 'tema', grupo: 'promessa', required: true, multiline: false },
  { key: 'publico', grupo: 'promessa', required: true, multiline: true },
  { key: 'transformacao', grupo: 'promessa', required: true, multiline: true },
  { key: 'tempo', grupo: 'promessa', required: true, multiline: false },
  { key: 'diferencial', grupo: 'promessa', required: false, multiline: true },
];
const compilePromessa = (a: Record<string, string>) =>
  bt('promessa', {
    nome: campo(a, 'nome'),
    tipo: campo(a, 'tipo'),
    tema: campo(a, 'tema'),
    publico: campo(a, 'publico'),
    transformacao: campo(a, 'transformacao'),
    tempo: campo(a, 'tempo'),
    diferencial: campo(a, 'diferencial', 'naoInformado'),
  });

/* ── Ganchos Virais (agente-7 · bônus) ── */
const GANCHOS_QUESTIONS: typeof ARCHITECT_QUESTIONS = [
  { key: 'nicho', grupo: 'ganchos', required: true, multiline: false },
  { key: 'ensina', grupo: 'ganchos', required: true, multiline: true },
  { key: 'nivel', grupo: 'ganchos', required: true, multiline: false },
  { key: 'objetivo', grupo: 'ganchos', required: true, multiline: false },
  { key: 'dor', grupo: 'ganchos', required: false, multiline: true },
];
const compileGanchos = (a: Record<string, string>) =>
  bt('ganchos', {
    nicho: campo(a, 'nicho'),
    ensina: campo(a, 'ensina'),
    nivel: campo(a, 'nivel'),
    objetivo: campo(a, 'objetivo'),
    dor: campo(a, 'dor', 'defineSozinho'),
  });

/* ── Narrado Técnico (agente-8 · bônus) ── */
const NARRADO_QUESTIONS: typeof ARCHITECT_QUESTIONS = [
  { key: 'entrada', grupo: 'narrado', required: true, multiline: true },
];
const compileNarrado = (a: Record<string, string>) =>
  bt('narrado', { entrada: campo(a, 'entrada') });

/* ── Carrossel Viral (agente-9 · bônus) ── */
const CARROSSEL_QUESTIONS: typeof ARCHITECT_QUESTIONS = [
  { key: 'nicho', grupo: 'carrossel', required: true, multiline: false },
  { key: 'faz', grupo: 'carrossel', required: true, multiline: true },
  { key: 'tema', grupo: 'carrossel', required: false, multiline: true },
  { key: 'foco', grupo: 'carrossel', required: true, multiline: false },
  { key: 'cta', grupo: 'carrossel', required: true, multiline: false },
];
const compileCarrossel = (a: Record<string, string>) =>
  bt('carrossel', {
    nicho: campo(a, 'nicho'),
    faz: campo(a, 'faz'),
    tema: campo(a, 'tema', 'semTema'),
    foco: campo(a, 'foco'),
    cta: campo(a, 'cta'),
  });

/* Configuração de cada "entrevista" (formulário) por agente. */
interface IntakeConfig {
  questions: typeof ARCHITECT_QUESTIONS;
  compile: (a: Record<string, string>) => { briefing: string; courseName: string };
}
const INTAKE: Record<string, IntakeConfig> = {
  'agente-1': {
    questions: ARCHITECT_QUESTIONS,
    compile: a => ({ briefing: compileBriefing(a), courseName: (a['nome'] ?? '').trim() }),
  },
  'agente-3': {
    questions: APOSTILA_QUESTIONS,
    compile: a => ({ briefing: compileApostila(a), courseName: (a['tecnica'] ?? '').trim() }),
  },
  'agente-4': {
    questions: PESQUISA_QUESTIONS,
    compile: a => ({ briefing: compilePesquisa(a), courseName: nomeSalvo('pesquisa', a['nicho']) }),
  },
  'agente-5': {
    questions: NOME_QUESTIONS,
    compile: a => ({ briefing: compileNome(a), courseName: ((a['nome_prov'] || a['tema']) ?? '').trim() }),
  },
  'agente-6': {
    questions: PROMESSA_QUESTIONS,
    compile: a => ({ briefing: compilePromessa(a), courseName: ((a['nome'] || a['tema']) ?? '').trim() }),
  },
  'agente-7': {
    questions: GANCHOS_QUESTIONS,
    compile: a => ({ briefing: compileGanchos(a), courseName: nomeSalvo('ganchos', a['nicho']) }),
  },
  'agente-8': {
    questions: NARRADO_QUESTIONS,
    compile: a => ({ briefing: compileNarrado(a), courseName: nomeSalvo('roteiro', (a['entrada'] ?? '').trim().slice(0, 40)) }),
  },
  'agente-9': {
    questions: CARROSSEL_QUESTIONS,
    compile: a => ({ briefing: compileCarrossel(a), courseName: nomeSalvo('carrossel', a['nicho']) }),
  },
};

type FormDraft = { step: number; answers: Record<string, string> };

const AgentIntakeForm: React.FC<{
  agent: Agent; config: IntakeConfig; reduce: boolean; onBack: () => void;
  onSubmit: (briefing: string, courseName: string) => void;
  /* O formulário tem 5 perguntas longas e era perdido inteiro ao trocar de
     tela. Quem guarda é o pai (Chat), que já persiste o resto da sessão. */
  draft: FormDraft | null;
  onDraftChange: (d: FormDraft) => void;
}> = ({ agent, config, reduce, onBack, onSubmit, draft, onDraftChange }) => {
  const shellRef = useKeyboardViewport<HTMLDivElement>();
  const TXT = useTxt();
  const { t } = useTranslation();
  const kind = agent.category as RobotKind;
  const acc = ACCENT[kind];
  // clamp no passo: se o formulário encolheu desde o rascunho, não trava numa
  // pergunta que não existe mais.
  const [step, setStep] = useState(() => Math.min(draft?.step ?? 0, config.questions.length - 1));
  const [answers, setAnswers] = useState<Record<string, string>>(draft?.answers ?? {});
  const q = config.questions[step];
  const total = config.questions.length;
  const val = answers[q.key] ?? '';
  const canNext = !q.required || val.trim().length > 0;
  const isLast = step === total - 1;

  // Espelha o progresso pro pai a cada resposta — é ele que grava.
  useEffect(() => { onDraftChange({ step, answers }); }, [step, answers, onDraftChange]);

  const goNext = () => {
    if (!canNext) return;
    if (isLast) { const { briefing, courseName } = config.compile(answers); onSubmit(briefing, courseName); }
    else setStep(s => s + 1);
  };
  const goBack = () => (step === 0 ? onBack() : setStep(s => s - 1));

  return (
    <div ref={shellRef} className="fixed inset-0 bg-[#FFF7E6] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Palco do robô */}
      <div className="shrink-0 relative overflow-hidden" style={{ background: agent.gradient }}>
        <button onClick={goBack} className="absolute top-3 left-3 z-10 w-8 h-8 flex items-center justify-center text-white/90" style={{ WebkitTapHighlightColor: 'transparent' }}>
          <ArrowLeft size={18} />
        </button>
        <div className="relative px-4 pt-3 pb-4 flex flex-col items-center">
          <Robot kind={kind} reduce={reduce} />
          <p className="text-white text-[15px] font-black mt-1">{agent.name}</p>
          <p className="text-white/80 text-[11px]">{t(`intake.subtitles.${agent.slug}`)}</p>
        </div>
      </div>

      {/* Progresso */}
      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center gap-1.5">
          {config.questions.map((_, i) => (
            <div key={i} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: i <= step ? acc.main : '#F6D6DC' }} />
          ))}
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50 mt-2">Pergunta {step + 1} de {total}</p>
      </div>

      {/* Pergunta atual */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#F6B43A]/45 bg-[#FFF2CF] px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-[#7A4C00]">
          <CircleHelp size={12} />
          {TXT.answer_required}
        </div>
        <h2 className="text-[20px] font-black text-[#1E1B11] leading-tight">
          {t(`intake.perguntas.${q.grupo}.${q.key}.label`)}
          {!q.required && <span className="text-[#5B4041]/40 text-[12px] font-medium"> · opcional</span>}
        </h2>
        <p className="text-[12px] text-[#5B4041]/70 mt-1.5 mb-4">{t(`intake.perguntas.${q.grupo}.${q.key}.hint`)}</p>
        <VoiceField
          key={q.key}
          multiline={q.multiline}
          value={val}
          onChange={v => setAnswers(p => ({ ...p, [q.key]: v }))}
          placeholder={t(`intake.perguntas.${q.grupo}.${q.key}.placeholder`)}
          autoFocus
          rows={5}
        />
        <p className="text-[10px] text-[#5B4041]/45 mt-2 flex items-center gap-1">
          <Mic size={11} className="text-[#BE0D3E]" /> {t('chat.dicaMicrofone')}
        </p>
      </div>

      {/* Ações */}
      <div className="shrink-0 px-4 py-3 border-t border-[#BE0D3E]/10 flex gap-2" style={{ background: 'rgba(255,247,230,0.95)', backdropFilter: 'blur(20px)' }}>
        <button onClick={goBack} className="px-5 py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest bg-[#F6D6DC] text-[#5B4041]" style={{ WebkitTapHighlightColor: 'transparent' }}>
          {step === 0 ? t('common.sair') : t('common.voltar')}
        </button>
        <button
          onClick={goNext}
          disabled={!canNext}
          className="flex-1 py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-1.5 disabled:opacity-30 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #BE0D3E, #E06B85)', WebkitTapHighlightColor: 'transparent' }}
        >
          {isLast
            ? <><Sparkles size={14} /> {t(`intake.submits.${agent.slug}`)}</>
            : <>{t('intake.proxima')} <ArrowRight size={14} /></>}
        </button>
      </div>
    </div>
  );
};

/* ═════════════════════════════════════════════
   PICKER DE ESQUELETOS (agente-2 / Roteirista)
   Lista os esqueletos que o Arquiteto (agente-1) salvou.
═════════════════════════════════════════════ */
interface SkeletonItem { id: string; title: string; ai_response: string; created_at: string | null }

const SkeletonPicker: React.FC<{
  agent: Agent; userId?: string; reduce: boolean;
  onBack: () => void; onPick: (it: SkeletonItem, retomar: boolean) => void; onCreate: () => void;
}> = ({ agent, userId, reduce, onBack, onPick, onCreate }) => {
  const shellRef = useKeyboardViewport<HTMLDivElement>();
  const TXT = useTxt();
  const { t } = useTranslation();
  const kind = agent.category as RobotKind;
  const [items, setItems] = useState<SkeletonItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Última aula escrita de cada esqueleto (só as que o Roteirista salvou
  // sozinho — é o que dá pra afirmar que pertence àquele curso).
  const [ultimaAula, setUltimaAula] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!userId || !SUPABASE_READY) { setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      const [esqueletos, aulas] = await Promise.all([
        supabase
          .from('saved_viral_outputs')
          .select('id, title, ai_response, created_at')
          .eq('user_id', userId)
          .eq('model_slug', 'agente-1')
          .order('created_at', { ascending: false }),
        supabase
          .from('saved_viral_outputs')
          .select('skeleton_id, lesson_number')
          .eq('user_id', userId)
          .eq('model_slug', 'agente-2')
          .not('skeleton_id', 'is', null),
      ]);
      if (cancel) return;
      const mapa: Record<string, number> = {};
      for (const a of (aulas.data ?? []) as { skeleton_id: string; lesson_number: number | null }[]) {
        mapa[a.skeleton_id] = Math.max(mapa[a.skeleton_id] ?? 0, a.lesson_number ?? 0);
      }
      setUltimaAula(mapa);
      setItems((esqueletos.data ?? []) as SkeletonItem[]);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [userId]);

  return (
    <div ref={shellRef} className="fixed inset-0 bg-[#FFF7E6] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Palco do robô */}
      <div className="shrink-0 relative overflow-hidden" style={{ background: agent.gradient }}>
        <button onClick={onBack} className="absolute top-3 left-3 z-10 w-8 h-8 flex items-center justify-center text-white/90" style={{ WebkitTapHighlightColor: 'transparent' }}>
          <ArrowLeft size={18} />
        </button>
        <div className="relative px-4 pt-3 pb-4 flex flex-col items-center">
          <Robot kind={kind} reduce={reduce} />
          <p className="text-white text-[15px] font-black mt-1">{agent.name}</p>
          <p className="text-white/80 text-[11px]">{t('chat.escolhaEsqueleto')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {loading ? (
          <div className="flex justify-center pt-10"><Loader2 className="w-6 h-6 text-[#BE0D3E] animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center pt-10 px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#F6D6DC] flex items-center justify-center mx-auto mb-4"><Layers className="text-[#BE0D3E]" size={24} /></div>
            <h3 className="text-[16px] font-black text-[#1E1B11]">{t('chat.semEsqueleto')}</h3>
            <p className="text-[12px] text-[#5B4041]/70 mt-1.5 mb-5">{t('chat.semEsqueletoDica1')}<b>{t('agentes.agente-1.nome')}</b>{t('chat.semEsqueletoDica2')}</p>
            <button onClick={onCreate} className="inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest text-white" style={{ background: 'linear-gradient(135deg, #BE0D3E, #E06B85)', WebkitTapHighlightColor: 'transparent' }}>
              <Blocks size={14} /> {t('chat.irArquiteto')}
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50 mb-1">
              {items.length} esqueleto{items.length > 1 ? 's' : ''} salvo{items.length > 1 ? 's' : ''}
            </p>
            {items.map(it => {
              const parouNa = ultimaAula[it.id] ?? 0;
              return (
                <div
                  key={it.id}
                  className="bg-white border border-[#BE0D3E]/15 rounded-2xl overflow-hidden transition-all"
                >
                  <button
                    onClick={() => onPick(it, parouNa > 0)}
                    className="w-full text-left p-4 active:scale-[0.99] transition-transform"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 w-9 h-9 rounded-xl bg-[#F6D6DC] flex items-center justify-center mt-0.5"><Layers size={16} className="text-[#BE0D3E]" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold text-[#1E1B11] truncate">{it.title}</p>
                        {parouNa > 0 ? (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-[#F6D6DC] text-[9px] font-black uppercase tracking-widest text-[#BE0D3E]">
                            {TXT.resume_badge(parouNa)}
                          </span>
                        ) : (
                          <p className="text-[11px] text-[#5B4041]/60 line-clamp-2 mt-0.5">{it.ai_response.replace(/[#*_>`-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)}</p>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-[#BE0D3E]/40 shrink-0 mt-2" />
                    </div>
                  </button>

                  {parouNa > 0 && (
                    <button
                      onClick={() => onPick(it, false)}
                      className="w-full border-t border-[#BE0D3E]/10 py-2 text-[9px] font-black uppercase tracking-widest text-[#5B4041]/45 active:bg-[#FFF7E6]"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      {TXT.resume_restart}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const ChatScreen: React.FC<{ formatSlug: string }> = ({ formatSlug }) => {
  const shellRef = useKeyboardViewport<HTMLDivElement>();
  const navigate = useLocalizedNavigate();
  const lang = useCurrentLang();
  const { t } = useTranslation();
  const TXT = useTxt();
  const { user } = useAuth();
  const { toast } = useToast();
  const AGENTS = useAgents();
  const agent = AGENTS.find(f => f.slug === formatSlug);
  const cat = CATEGORIES.find(c => c.id === agent?.category);

  /* Rascunho da visita anterior. Lido uma única vez, ANTES dos useState, pra
     servir de valor inicial. A rota vive dentro de ProtectedRoute, então
     `user` já existe no primeiro render. */
  const draftRef = useRef<ChatDraft | null | undefined>(undefined);
  if (draftRef.current === undefined) {
    draftRef.current = agent && user ? loadChatDraft(user.id, agent.slug) : null;
  }
  const draft = draftRef.current;

  // Lazy + defensivo: nunca desreferencia `agent` indefinido no 1º render
  const [messages, setMessages] = useState<Message[]>(() =>
    draft ? draft.messages : agent ? [{ role: 'ia', content: INITIAL_MSG(agent, t) }] : []
  );
  const [input, setInput] = useState(draft?.input ?? '');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  // Retoma o MESMO sessionId: ele é a chave de cota da function `chat-viral`,
  // e um id novo faria o backend cobrar a conversa retomada como um chat novo.
  if (sessionIdRef.current === null) sessionIdRef.current = draft?.sessionId ?? newSessionId();

  // Biblioteca: IDs dos bubbles de IA já salvos na sessão + modal de salvar
  const [savedIdx, setSavedIdx] = useState<Set<number>>(() => new Set(draft?.savedIdx ?? []));
  const [saveModalIdx, setSaveModalIdx] = useState<number | null>(null);
  const [saveTitle, setSaveTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatuses, setSaveStatuses] = useState<Record<number, SaveStatus>>(
    () => (draft?.saveStatuses ?? {}) as Record<number, SaveStatus>,
  );

  // Esteira Arquiteto→Roteirista: etapa da tela, nome do curso e modo "salvar ao sair"
  const reduce = !!useReducedMotion();
  const [stage, setStage] = useState<'form' | 'picker' | 'chat'>(() =>
    draft?.stage ?? (agent?.slug === 'agente-2' ? 'picker' : (agent && INTAKE[agent.slug]) ? 'form' : 'chat')
  );
  const [courseName, setCourseName] = useState(draft?.courseName ?? '');
  const [formDraft, setFormDraft] = useState<FormDraft | null>(draft?.form ?? null);
  // Esqueleto que está sendo roteirizado: é ele que amarra cada aula ao
  // curso certo no banco (e faz o "continuar de onde parou" existir).
  const [skeletonId, setSkeletonId] = useState<string | null>(draft?.skeletonId ?? null);
  const [exitMode, setExitMode] = useState(false);
  const [lessonProgress, setLessonProgress] = useState<{ current: number; total: number } | null>(
    draft?.lessonProgress ?? null,
  );

  const { isRecording, recordingTime, error: recorderError, startRecording, stopRecording, cancelRecording } = useAudioRecorder();
  const [transcribing, setTranscribing] = useState(false);

  useEffect(() => {
    // recorderError é CHAVE de tradução (ver useAudioRecorder).
    if (recorderError) toast({ title: t(recorderError) });
  }, [recorderError, toast, t]);

  useEffect(() => {
    rolarConversa({
      box: listRef.current,
      fim: bottomRef.current,
      indiceUltima: messages.length - 1,
      ultimaEhDaIA: messages[messages.length - 1]?.role === 'ia',
      carregando: loading,
    });
  }, [messages, loading]);

  /* ═══ Rascunho da sessão ═══
     Trocar de tela desmonta este componente. Sem gravar nada, some a conversa
     inteira — inclusive a resposta que a IA já tinha terminado de escrever. */
  const skipPersistRef = useRef(false);
  const snapshotRef = useRef<Omit<ChatDraft, 'updatedAt'> | null>(null);
  snapshotRef.current = {
    sessionId: sessionIdRef.current as string,
    stage,
    messages,
    input,
    courseName,
    skeletonId,
    lessonProgress,
    savedIdx: [...savedIdx],
    saveStatuses: saveStatuses as Record<string, SaveStatus>,
    form: formDraft,
  };

  const persist = () => {
    if (skipPersistRef.current || !agent || !user || !snapshotRef.current) return;
    saveChatDraft(user.id, agent.slug, snapshotRef.current);
  };
  // Ref pra que a gravação de saída use sempre a versão mais nova, e não a
  // closure do primeiro render.
  const persistRef = useRef(persist);
  persistRef.current = persist;

  // Grava com folga: sem o debounce seria uma escrita por tecla digitada.
  useEffect(() => {
    const id = setTimeout(() => persistRef.current(), 400);
    return () => clearTimeout(id);
  }, [stage, messages, input, courseName, skeletonId, lessonProgress, savedIdx, saveStatuses, formDraft]);

  // E garante a gravação no caminho que motivou tudo isso: sair da tela antes
  // do debounce disparar.
  useEffect(() => () => persistRef.current(), []);

  /* Saída deliberada (salvou e saiu, ou descartou): aí o rascunho NÃO deve
     ressuscitar a conversa na próxima visita. */
  const dropDraft = () => {
    skipPersistRef.current = true;
    if (user && agent) clearChatDraft(user.id, agent.slug);
  };

  const saveLessonAutomatically = async (
    replyIdx: number,
    userInput: string,
    aiResponse: string,
    title: string,
    vinculo?: { skeletonId: string | null; lessonNumber: number },
  ) => {
    if (!SUPABASE_READY || !user || !agent) {
      setSaveStatuses(prev => ({ ...prev, [replyIdx]: 'error' }));
      return;
    }

    setSaveStatuses(prev => ({ ...prev, [replyIdx]: 'saving' }));
    const { error } = await supabase.from('saved_viral_outputs').insert({
      user_id: user.id,
      model_slug: agent.slug,
      model_name: agent.name,
      title,
      user_input: userInput,
      ai_response: aiResponse,
      skeleton_id: vinculo?.skeletonId ?? null,
      lesson_number: vinculo?.lessonNumber ?? null,
    });

    if (error) {
      setSaveStatuses(prev => ({ ...prev, [replyIdx]: 'error' }));
      toast({ title: TXT.toast_save_error, description: error.message, variant: 'destructive' });
      return;
    }

    setSavedIdx(prev => new Set(prev).add(replyIdx));
    setSaveStatuses(prev => ({ ...prev, [replyIdx]: 'saved' }));
    toast({ title: TXT.lesson_saved });
  };

  /* O QUE VAI PRA IA a cada aula. A conversa inteira cresce sem parar —
     uma aula tem uns 6 mil tokens, então na aula 20 seriam 120 mil por
     chamada (e o backend corta a sessão em 50 mensagens). No Roteirista
     mandamos o esqueleto, que já traz o índice inteiro do curso, mais as
     últimas trocas — o tom e o "não repita o que acabei de dizer". É isso
     também que deixa retomar um curso antigo custar igual a continuar um
     que acabou de começar. */
  const CONTEXTO_CAUDA = 4;
  const contextoParaIA = (msgs: Message[]) =>
    agent?.slug === 'agente-2' && msgs.length > CONTEXTO_CAUDA + 1
      ? [msgs[0], ...msgs.slice(-CONTEXTO_CAUDA)]
      : msgs;

  // Núcleo de geração: recebe a mensagem do usuário + a base de conversa a usar.
  // Passar `base` explicitamente evita ler `messages` desatualizado (formulário/picker).
  const runGeneration = async (
    userMsg: Message,
    base: Message[],
    lessonToSave?: { courseTitle: string; lessonNumber: number; skeletonId: string | null },
  ) => {
    const next: Message[] = [...base, userMsg];
    setMessages(next);
    // Sem Supabase configurado ainda → resposta amigável, sem chamar a function
    if (!SUPABASE_READY) {
      setMessages(prev => [...prev, { role: 'ia', content: TXT.backend_pending }]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('chat-viral', {
        body: {
          formatSlug,
          // Técnica A do guia: diretiva de idioma anexada à última mensagem do
          // usuário. O prompt system da function continua em português — a IA
          // acompanha o idioma da aluna sem precisar reescrever/deployar prompt.
          messages: withAiLangMessages(
            contextoParaIA(next).map(m => ({ role: m.role, content: m.content })),
            lang,
          ),
          sessionId: sessionIdRef.current,
          segment: agent?.category,
          // Reforço de idioma no system prompt e erros no idioma da aluna.
          lang,
        },
      });
      if (error) {
        const errData = await readFnError(error);
        if (errData?.error === 'limite_atingido') {
          const msgLimit = TXT.limit_chats_segment(errData.limit, categoryLabel(cat?.id, t));
          setMessages(prev => [...prev, { role: 'ia', content: TXT.limit_reached_msg(msgLimit) }]);
          return;
        }
        if (errData?.error === 'limite_mensagens') {
          setMessages(prev => [...prev, { role: 'ia', content: TXT.limit_messages_msg(errData.limit ?? 10) }]);
          return;
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      const reply = String(data?.reply ?? '').trim();
      if (!reply) throw new Error(t('intake.semConteudo'));
      const replyIdx = next.length;
      setMessages([...next, { role: 'ia', content: reply }]);
      if (lessonToSave) {
        await saveLessonAutomatically(
          replyIdx,
          userMsg.content,
          reply,
          t('chat.tituloAula', { curso: lessonToSave.courseTitle, n: lessonToSave.lessonNumber }),
          { skeletonId: lessonToSave.skeletonId, lessonNumber: lessonToSave.lessonNumber },
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : TXT.unknown_error;
      setMessages(prev => [...prev, { role: 'ia', content: `${TXT.error_prefix}\n\n${msg}\n\n${TXT.error_retry}` }]);
    } finally {
      setLoading(false);
    }
  };

  const goToNextLesson = () => {
    if (!lessonProgress || loading || agent?.slug !== 'agente-2') return;

    const nextLesson = lessonProgress.current + 1;
    setInput('');
    // O total é a estimativa lida do esqueleto — quem decide quando parar é
    // quem está criando. Passou da conta? O total acompanha, em vez de sumir
    // com o botão e deixar a pessoa presa na "Aula 1 de 1".
    setLessonProgress(prev => prev
      ? { current: nextLesson, total: Math.max(prev.total, nextLesson) }
      : prev);
    const content = t('chat.pedirProxima', {
      atual: lessonProgress.current, proxima: nextLesson, curso: courseName,
    });
    const display = t('chat.proximaEtapa', { n: nextLesson, total: lessonProgress.total });
    runGeneration(
      { role: 'user', content, display },
      messages,
      { courseTitle: courseName || t('chat.meuCurso'), lessonNumber: nextLesson, skeletonId },
    );
  };

  const send = () => {
    const text = input.trim();
    if (!text || loading) return;
    // Atalho do Roteirista: digitar "próxima" faz o mesmo que o botão —
    // inclusive salvar a aula sozinho. Sem isso a frase virava mensagem
    // solta pra IA e a aula nascia fora da contagem e sem salvar.
    if (
      agent?.slug === 'agente-2'
      && lessonProgress
      && /^(pr[oó]xima|continuar?|segue|seguir)(\s+aula)?[.!]?$/i.test(text)
    ) {
      goToNextLesson();
      return;
    }
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    runGeneration({ role: 'user', content: text }, messages);
  };

  const reset = () => {
    if (!agent) return;
    if (user) clearChatDraft(user.id, agent.slug);
    setFormDraft(null);
    setInput('');
    setSavedIdx(new Set());
    setSaveStatuses({});
    setLessonProgress(null);
    setSkeletonId(null);
    if (agent.slug === 'agente-2') { setMessages([]); setStage('picker'); return; }
    if (INTAKE[agent.slug]) { setMessages([]); setStage('form'); return; }
    setMessages([{ role: 'ia', content: INITIAL_MSG(agent, t) }]);
  };

  const openSaveModal = (idx: number) => {
    const iaMsg = messages[idx];
    const userMsg = messages.slice(0, idx).reverse().find(m => m.role === 'user');
    if (!iaMsg || !userMsg) return;
    // Título default: nome do curso (esteira) ou primeiros 60 caracteres do briefing
    const defaultTitle =
      agent?.slug === 'agente-2' && courseName ? t('chat.tituloAula', { curso: courseName, n: lessonProgress?.current ?? 1 })
      : courseName && INTAKE[agent?.slug ?? ''] ? courseName
      : userMsg.content.replace(/\s+/g, ' ').trim().slice(0, 60);
    setSaveTitle(defaultTitle);
    setExitMode(false);
    setSaveModalIdx(idx);
  };

  const confirmSave = async () => {
    if (saveModalIdx === null || !user || !agent) return;
    if (!SUPABASE_READY) {
      toast({ title: TXT.toast_backend_pending });
      return;
    }
    const iaMsg = messages[saveModalIdx];
    const userMsg = messages.slice(0, saveModalIdx).reverse().find(m => m.role === 'user');
    if (!iaMsg || !userMsg) return;
    const cleanTitle = saveTitle.trim();
    if (!cleanTitle) {
      toast({ title: TXT.toast_name_required });
      return;
    }
    setSaving(true);
    // Se for a aula que acabou de sair no Roteirista, amarra ao curso do
    // mesmo jeito que o salvamento automático faria — é o caso de quando o
    // automático falhou e a pessoa clicou em "tentar salvar". Bubble antigo
    // (rolou pra cima e salvou) fica sem vínculo de propósito: não dá pra
    // saber que número era sem chutar.
    const ehAulaAtual =
      agent.slug === 'agente-2' && !!skeletonId && !!lessonProgress
      && saveModalIdx === messages.length - 1;
    const { error } = await supabase.from('saved_viral_outputs').insert({
      user_id: user.id,
      model_slug: agent.slug,
      model_name: agent.name,
      title: cleanTitle,
      user_input: userMsg.content,
      ai_response: iaMsg.content,
      skeleton_id: ehAulaAtual ? skeletonId : null,
      lesson_number: ehAulaAtual ? lessonProgress.current : null,
    });
    setSaving(false);
    if (error) {
      setSaveStatuses(prev => ({ ...prev, [saveModalIdx]: 'error' }));
      toast({ title: TXT.toast_save_error, description: error.message, variant: 'destructive' });
      return;
    }
    setSavedIdx(prev => new Set(prev).add(saveModalIdx));
    setSaveStatuses(prev => ({ ...prev, [saveModalIdx]: 'saved' }));
    const wasExit = exitMode;
    setSaveModalIdx(null);
    setExitMode(false);
    toast({ title: TXT.toast_saved });
    if (wasExit) { dropDraft(); navigate('/chat'); }
  };

  const closeSaveModal = () => { setSaveModalIdx(null); setExitMode(false); };

  // Formulário do Arquiteto concluído → gera o esqueleto a partir do briefing.
  const handleFormSubmit = (briefing: string, name: string) => {
    setFormDraft(null);
    setCourseName(name);
    setStage('chat');
    runGeneration({ role: 'user', content: briefing }, []);
  };

  /* Esqueleto escolhido no Roteirista.

     `retomar` = a pessoa já escreveu aula desse curso antes. A conversa
     não vive em lugar nenhum entre uma visita e outra (sair da tela
     desmonta tudo), mas as AULAS estão salvas e agora sabem de qual
     esqueleto vieram — então a conversa é remontada a partir delas, na
     ordem, e o progresso volta pro número certo. */
  const handlePickSkeleton = async (it: SkeletonItem, retomar: boolean) => {
    const totalLessons = countLessonsInSkeleton(it.ai_response);
    setCourseName(it.title);
    setSkeletonId(it.id);
    setSaveStatuses({});
    setSavedIdx(new Set());
    setStage('chat');

    if (retomar && user && SUPABASE_READY) {
      setMessages([]);
      setLoading(true);
      const { data } = await supabase
        .from('saved_viral_outputs')
        .select('lesson_number, ai_response')
        .eq('user_id', user.id)
        .eq('skeleton_id', it.id)
        .not('lesson_number', 'is', null)
        .order('lesson_number', { ascending: true })
        .order('created_at', { ascending: true });
      setLoading(false);

      // A mesma aula pode ter sido escrita mais de uma vez (recomeço,
      // tentativa que não agradou): vale a última versão de cada número.
      const porNumero = new Map<number, string>();
      for (const r of (data ?? []) as { lesson_number: number; ai_response: string }[]) {
        porNumero.set(r.lesson_number, r.ai_response);
      }
      const aulas = [...porNumero.entries()].sort((a, b) => a[0] - b[0]);

      if (aulas.length > 0) {
        const parouNa = aulas[aulas.length - 1][0];
        const contexto = `Esqueleto validado do curso "${it.title}":\n\n${it.ai_response}\n\nAs aulas 1 a ${parouNa} já foram escritas — a última está logo abaixo. Continue exatamente de onde parou, sem repetir o que já foi dito, e escreva apenas a aula que eu pedir a seguir.`;
        setMessages([
          { role: 'user', content: contexto, display: TXT.resume_display(it.title, parouNa) },
          ...aulas.map(([, texto]) => ({ role: 'ia' as const, content: texto })),
        ]);
        // As aulas remontadas já estão na Biblioteca — nascem marcadas
        // como salvas pra não oferecer salvar de novo (viraria duplicata).
        const indices = aulas.map((_, i) => i + 1);
        setSavedIdx(new Set(indices));
        setSaveStatuses(Object.fromEntries(indices.map(i => [i, 'saved' as SaveStatus])));
        setLessonProgress({ current: parouNa, total: Math.max(totalLessons, parouNa) });
        return;
      }
      // Sem aula salva (só o esqueleto): segue como curso novo.
    }

    setLessonProgress({ current: 1, total: totalLessons });
    const injected = t('chat.esqueletoValidado', { curso: it.title, conteudo: it.ai_response });
    const display = t('chat.cursoEscolhido', { curso: it.title });
    runGeneration(
      { role: 'user', content: injected, display },
      [],
      { courseTitle: it.title, lessonNumber: 1, skeletonId: it.id },
    );
  };

  // Voltar: protege conteúdo não salvo tanto no Arquiteto quanto no Roteirista.
  const handleBackPress = () => {
    if ((agent?.slug === 'agente-1' || agent?.slug === 'agente-2') && stage === 'chat') {
      let idx = -1;
      for (let i = messages.length - 1; i > 0; i--) {
        if (messages[i].role === 'ia' && !savedIdx.has(i)) { idx = i; break; }
      }
      if (idx !== -1) {
        setSaveTitle(
          agent.slug === 'agente-2'
            ? t('chat.tituloAula', { curso: courseName || t('chat.meuCurso'), n: lessonProgress?.current ?? 1 })
            : courseName || t('chat.esqueletoMeuCurso'),
        );
        setExitMode(true);
        setSaveModalIdx(idx);
        return;
      }
    }
    navigate('/chat');
  };

  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isTouch) return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const resizeTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  useEffect(() => {
    resizeTextarea();
  }, [input]);

  const handleMicClick = async () => {
    if (transcribing) return;
    if (isRecording) {
      const blob = await stopRecording();
      if (!blob) return;
      setTranscribing(true);
      try {
        const form = new FormData();
        const ext = (blob.type.split('/')[1] || 'webm').split(';')[0];
        form.append('audio', blob, `audio.${ext}`);
        // Técnica C: sem o parâmetro de idioma o Whisper chuta — e às vezes
        // TRADUZ o áudio em vez de transcrever.
        form.append('language', lang);
        const { data, error } = await supabase.functions.invoke('transcribe-audio', { body: form });
        if (error) throw error;
        const text = (data?.transcription ?? '').trim();
        if (!text) {
          toast({ title: TXT.toast_audio_error });
          return;
        }
        setInput(prev => (prev ? prev + ' ' + text : text));
        requestAnimationFrame(() => {
          textareaRef.current?.focus();
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : TXT.toast_transcription_error;
        toast({ title: TXT.toast_transcription_failed, description: msg });
      } finally {
        setTranscribing(false);
      }
    } else {
      // Transcrição depende da edge function — indisponível sem backend
      if (!SUPABASE_READY) {
        toast({ title: TXT.toast_backend_pending });
        return;
      }
      await startRecording();
    }
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (!agent) return null;

  // Etapa 1 dos agentes com entrevista própria (Arquiteto, Apostila): formulário-wizard
  if (stage === 'form' && INTAKE[agent.slug]) {
    return (
      <AgentIntakeForm
        agent={agent}
        config={INTAKE[agent.slug]}
        reduce={reduce}
        onBack={() => navigate('/chat')}
        onSubmit={handleFormSubmit}
        draft={formDraft}
        onDraftChange={setFormDraft}
      />
    );
  }
  // Etapa 1 do Roteirista: escolher o esqueleto salvo
  if (stage === 'picker') {
    return (
      <SkeletonPicker
        agent={agent}
        userId={user?.id}
        reduce={reduce}
        onBack={() => navigate('/chat')}
        onPick={handlePickSkeleton}
        onCreate={() => navigate('/chat/agente-1')}
      />
    );
  }

  const lastMessage = messages[messages.length - 1];
  // Só espera o salvamento terminar; não exige que a aula tenha sido salva
  // nem que ainda falte aula na estimativa (antes, uma pergunta solta no
  // meio da conversa fazia o botão sumir pro resto da sessão).
  const showNextLesson =
    agent.slug === 'agente-2'
    && !!lessonProgress
    && messages.length > 1
    && lastMessage?.role === 'ia'
    && saveStatuses[messages.length - 1] !== 'saving'
    && !loading;
  const passouDoEsqueleto = !!lessonProgress && lessonProgress.current >= lessonProgress.total;

  return (
    <div ref={shellRef} className="fixed inset-0 bg-[#FFF7E6] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* Header */}
      <div className="shrink-0 border-b border-[#BE0D3E]/10 px-4 pt-3 pb-3 flex items-center gap-3"
        style={{ background: 'rgba(255,247,230,0.95)', backdropFilter: 'blur(20px)' }}>
        <button
          onClick={handleBackPress}
          className="w-8 h-8 flex items-center justify-center text-[#5B4041] shrink-0"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {cat && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cat.dot}`} />}
            {cat && <span className={`text-[8px] font-black uppercase tracking-widest ${cat.color}`}>{categoryLabel(cat.id, t)}</span>}
          </div>
          <p className="text-[13px] font-bold text-[#1E1B11] truncate">{agent.name}</p>
        </div>

        <button
          onClick={reset}
          className="w-8 h-8 flex items-center justify-center text-[#5B4041]/40 active:text-[#5B4041] shrink-0"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {agent.slug === 'agente-2' && lessonProgress && (
        <div className="shrink-0 border-b border-[#BE0D3E]/10 bg-white/75 px-4 py-2.5">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#BE0D3E] text-[12px] font-black text-white shadow-[0_5px_14px_rgba(190,13,62,0.22)]">
              {lessonProgress.current}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-black text-[#1E1B11]">
                  {t('chat.aulaDeTotal', { n: lessonProgress.current, total: lessonProgress.total })}
                </p>
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#BE0D3E]">{t('chat.umaPorVez')}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F6D6DC]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#BE0D3E] to-[#F6B43A] transition-all duration-500"
                  style={{ width: `${Math.min(100, (lessonProgress.current / lessonProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mensagens */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-5 space-y-3"
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {messages.map((msg, i) => {
          // Só mostra botão "Salvar" em mensagens da IA que não sejam a primeira (opening)
          const canSave = msg.role === 'ia' && i > 0;
          return (
            <Bubble
              key={i}
              msg={msg}
              onSave={canSave ? () => openSaveModal(i) : undefined}
              saved={savedIdx.has(i)}
              saveStatus={saveStatuses[i]}
            />
          );
        })}
        {loading && <Typing />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="shrink-0 px-4 py-3 border-t border-[#BE0D3E]/10"
        style={{ background: 'rgba(255,247,230,0.95)', backdropFilter: 'blur(20px)' }}
      >
        {showNextLesson && (
          <div className="mb-2.5 rounded-2xl border border-[#BE0D3E]/15 bg-white p-2 shadow-[0_8px_22px_-12px_rgba(190,13,62,0.28)]">
            <button
              onClick={goToNextLesson}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#BE0D3E] to-[#D94368] px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white shadow-[0_6px_16px_rgba(190,13,62,0.22)] active:scale-[0.98] transition-transform"
            >
              {passouDoEsqueleto ? TXT.next_lesson_extra : TXT.next_lesson}
              <ArrowRight size={14} strokeWidth={2.8} />
            </button>
            <p className="mt-1.5 text-center text-[9px] leading-snug text-[#5B4041]/55">
              {passouDoEsqueleto ? TXT.next_lesson_extra_hint : TXT.next_lesson_hint}
            </p>
          </div>
        )}
        {isRecording ? (
          <div className="flex items-center gap-2 bg-[#FFFFFF] border border-[#BE0D3E]/20 rounded-2xl px-4 py-2.5">
            <button
              onClick={cancelRecording}
              className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-[#1E1B11]/5 hover:bg-[#1E1B11]/10 transition-colors"
              aria-label={TXT.cancel_recording}
            >
              <X size={14} className="text-[#1E1B11]" />
            </button>
            <div className="flex-1 flex items-center gap-2 text-[13px] text-[#1E1B11]">
              <span className="w-2 h-2 rounded-full bg-[#BE0D3E] animate-pulse" />
              <span className="font-mono tabular-nums">{fmtTime(recordingTime)}</span>
              <span className="text-[11px] text-[#5B4041]/60">{TXT.recording}</span>
            </div>
            <button
              onClick={handleMicClick}
              className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'linear-gradient(135deg, #BE0D3E, #BE0D3E)' }}
              aria-label={TXT.stop_recording}
            >
              <div className="w-3 h-3 rounded-[2px] bg-white" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2 bg-[#FFFFFF] border border-[#BE0D3E]/20 rounded-2xl px-4 py-2 focus-within:border-[#BE0D3E]/45 transition-colors">
            <button
              onClick={handleMicClick}
              disabled={transcribing || loading}
              className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-[#1E1B11]/5 hover:bg-[#BE0D3E]/10 disabled:opacity-40 transition-colors mb-0.5"
              aria-label={TXT.record_audio}
            >
              {transcribing
                ? <Loader2 size={14} className="text-[#BE0D3E] animate-spin" />
                : <Mic size={14} className="text-[#1E1B11]" />}
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={onInput}
              onKeyDown={onKey}
              disabled={transcribing}
              placeholder={transcribing ? TXT.transcribing : TXT.placeholder}
              className="flex-1 bg-transparent text-[13px] text-[#1E1B11] placeholder:text-[#5B4041]/35 outline-none resize-none py-1.5 leading-relaxed disabled:opacity-60"
              style={{ maxHeight: 120, scrollbarWidth: 'none' } as React.CSSProperties}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading || transcribing}
              className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-25 transition-all mb-0.5"
              style={{ background: 'linear-gradient(135deg, #BE0D3E, #BE0D3E)' }}
            >
              <Send size={14} className="text-white" />
            </button>
          </div>
        )}
        {!isTouch && (
          <p className="text-[9px] text-[#5B4041]/25 text-center mt-2">{TXT.keyboard_hint}</p>
        )}
      </div>

      {/* Modal de salvar na biblioteca (também usado no "salvar antes de sair") */}
      {saveModalIdx !== null && (
        <div
          className="fixed inset-0 z-[100] bg-[#1E1B11]/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={closeSaveModal}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-[0_-8px_40px_rgba(0,0,0,0.2)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <LibraryIcon size={18} className="text-[#BE0D3E]" />
                <h3 className="text-[16px] font-black text-[#1E1B11]">{exitMode ? TXT.exit_title : TXT.save_to_library}</h3>
              </div>
              <button
                onClick={closeSaveModal}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#FFF7E6] text-[#5B4041]"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <X size={14} />
              </button>
            </div>

            {exitMode && (
              <p className="text-[12px] text-[#5B4041]/80 mb-3 leading-relaxed">{TXT.exit_desc}</p>
            )}

            <p className="text-[10px] font-black text-[#5B4041] uppercase tracking-widest mb-2">
              {exitMode ? TXT.save_course_label : TXT.save_modal_label}
            </p>
            <input
              type="text"
              value={saveTitle}
              onChange={e => setSaveTitle(e.target.value.slice(0, 120))}
              placeholder={TXT.save_modal_placeholder}
              className="w-full bg-[#FFF7E6] border-2 border-[#BE0D3E]/25 focus:border-[#BE0D3E] rounded-xl px-3 py-2.5 text-[13px] text-[#1E1B11] outline-none transition-colors mb-4"
              autoFocus
            />

            <div className="flex gap-2">
              <button
                onClick={exitMode ? () => { closeSaveModal(); dropDraft(); navigate('/chat'); } : closeSaveModal}
                className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-[#F6D6DC] text-[#5B4041]"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {exitMode ? TXT.exit_discard : TXT.cancel}
              </button>
              <button
                onClick={confirmSave}
                disabled={saving || !saveTitle.trim()}
                className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-gradient-to-r from-[#BE0D3E] to-[#E06B85] text-white shadow-[0_4px_12px_rgba(190,13,62,0.3)] disabled:opacity-40 flex items-center justify-center gap-1.5"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {saving ? <><Loader2 size={12} className="animate-spin" /> {TXT.saving}</> : <><Save size={12} /> {exitMode ? TXT.exit_save : TXT.save}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   PRINCIPAL
───────────────────────────────────────────── */
const Chat: React.FC = () => {
  const { formatSlug } = useParams<{ formatSlug?: string }>();
  // Só monta o agente se o slug existir em AGENTS — slug desconhecido
  // (bookmark antigo, slug renomeado) volta pra grade em vez de quebrar.
  const AGENTS = useAgents();
  const agent = formatSlug ? AGENTS.find(a => a.slug === formatSlug) : undefined;
  if (!agent) return <FormatsGrid />;
  // Agente-FERRAMENTA (não é chat): tem tela própria.
  if (agent.tool === 'analisar-perfil') {
    return <AnalisarPerfilAgent key={agent.slug} agent={agent} />;
  }
  // key força remontar (reinicia etapa/mensagens) ao trocar de agente
  return <ChatScreen key={agent.slug} formatSlug={agent.slug} />;
};

export default Chat;
