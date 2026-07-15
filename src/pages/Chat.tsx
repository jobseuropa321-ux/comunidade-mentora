import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Send, RotateCcw, Mic,
  Library as LibraryIcon, Save, Check, Loader2, X,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { supabase, SUPABASE_READY } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { readFnError } from '@/lib/functionsError';
import { AGENTS, CATEGORIES, defaultOpening, type Agent } from '@/data/agents';

/* ─────────────────────────────────────────────
   TEXTOS DA TELA (toda a "escrita" daqui)
───────────────────────────────────────────── */
const TXT = {
  grid_title: 'Estúdio de Criação',
  grid_subtitle: 'Crie seu curso em minutos usando IA. Quatro agentes, um pra cada etapa do seu curso.',
  your_models: 'Seus Roteiros',
  library: 'Biblioteca',
  create_btn: 'Começar',
  agent_word: 'Agente',
  saved: 'Salvo',
  save: 'Salvar',
  placeholder: 'Descreva seu nicho e tema...',
  transcribing: 'Transcrevendo áudio...',
  recording: 'Gravando...',
  keyboard_hint: 'Enter para enviar · Shift+Enter para nova linha',
  cancel_recording: 'Cancelar gravação',
  stop_recording: 'Parar e transcrever',
  record_audio: 'Gravar áudio',
  save_to_library: 'Salvar na Biblioteca',
  save_modal_label: 'Dê um nome pra encontrar depois',
  save_modal_placeholder: 'Ex: Esqueleto do curso de confeitaria',
  cancel: 'Cancelar',
  saving: 'Salvando...',
  toast_name_required: 'Dá um nome antes de salvar',
  toast_save_error: 'Erro ao salvar',
  toast_saved: 'Salvo na Biblioteca ✨',
  toast_audio_error: 'Não consegui entender o áudio. Tenta de novo.',
  toast_transcription_failed: 'Falha na transcrição',
  toast_transcription_error: 'Erro ao transcrever',
  error_prefix: 'Deu ruim ao gerar 😔',
  error_retry: 'Tenta de novo em instantes.',
  unknown_error: 'Erro desconhecido',
  // Sem backend ainda (ver docs/backend/PLANO-IMPLEMENTACAO.md):
  backend_pending:
    '**Backend em preparação** 🛠️\n\nOs agentes de IA vão responder de verdade assim que o Supabase do projeto for conectado. A tela já está pronta pra isso.',
  toast_backend_pending: 'Disponível quando o backend for conectado 🛠️',
  // Mensagens de limite (o backend manda { error, limit } e a UI monta o aviso)
  limit_chats_segment: (limit: number | undefined, segment: string) =>
    `Você já usou seus **${limit ?? ''} chats de "${segment}"** hoje. Tenta outro agente ou volta amanhã!`,
  limit_reached_msg: (detail: string) => `**Limite atingido**\n\n${detail}`,
  limit_messages_msg: (limit: number) =>
    `**Limite de mensagens**\n\nVocê já enviou o máximo de ${limit} mensagens nessa conversa. Volte ao Estúdio e inicie uma nova conversa.`,
};

/* ID de sessão com fallback — crypto.randomUUID não existe em contexto
   não-HTTPS (ex.: testar o PWA via IP na rede local) nem em Safari antigo. */
const newSessionId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/* ═════════════════════════════════════════════
   ESTÚDIO DE CRIAÇÃO — hub dos 4 agentes
   (robôs SVG personalizados + cenas animadas)
═════════════════════════════════════════════ */
type RobotKind = 'estrutura' | 'roteiro' | 'apostila' | 'pesquisa';

const ACCENT: Record<RobotKind, { main: string; deep: string; soft: string; cta: string }> = {
  estrutura: { main: '#BE0D3E', deep: '#7C0026', soft: '#F6D6DC', cta: '#BE0D3E' },
  roteiro:   { main: '#F6B43A', deep: '#B96F0E', soft: '#FBE3BC', cta: '#C77E14' },
  apostila:  { main: '#E06B85', deep: '#B04967', soft: '#F6D6DC', cta: '#D06A85' },
  pesquisa:  { main: '#94002D', deep: '#5E001C', soft: '#ECA6BB', cta: '#94002D' },
};

/* ── O robô: base comum + ferramenta/rosto próprios de cada profissão ── */
const Robot: React.FC<{ kind: RobotKind; reduce: boolean }> = ({ kind, reduce }) => {
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
    </svg>
  );
};

/* ── Cena ambiente de cada palco (atrás do robô) ── */
const SceneFX: React.FC<{ kind: RobotKind; reduce: boolean }> = ({ kind, reduce }) => {
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
  // pesquisa
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
};

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 220, damping: 24 } },
};

/* ── Card de um agente (palco + conteúdo) ── */
const AgentCard: React.FC<{ agent: Agent; index: number; reduce: boolean; onOpen: () => void }> = ({
  agent, index, reduce, onOpen,
}) => {
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
            {TXT.agent_word} {num} · {cat?.label}
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

const FormatsGrid: React.FC = () => {
  const navigate = useNavigate();
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

      {/* Esteira dos 4 agentes */}
      <motion.div
        className="px-4"
        variants={{ show: { transition: { staggerChildren: 0.11, delayChildren: 0.15 } } }}
        initial={reduce ? 'show' : 'hidden'}
        animate="show"
      >
        {AGENTS.map((agent, i) => (
          <React.Fragment key={agent.slug}>
            {i > 0 && <Connector />}
            <AgentCard
              agent={agent}
              index={i}
              reduce={reduce}
              onOpen={() => navigate(`/chat/${agent.slug}`)}
            />
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   CHAT
───────────────────────────────────────────── */
interface Message { role: 'user' | 'ia'; content: string }

const INITIAL_MSG = (agent: Agent) => agent.openingMessage ?? defaultOpening(agent.name);

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
}> = ({ msg, onSave, saved }) => {
  const isIA = msg.role === 'ia';
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
          {isIA ? renderBold(msg.content) : msg.content}
        </div>
        {isIA && onSave && (
          <button
            onClick={onSave}
            disabled={saved}
            className={`self-start mt-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg transition-colors ${
              saved
                ? 'bg-green-500/10 text-green-600 cursor-default'
                : 'bg-white border border-[#BE0D3E]/25 text-[#BE0D3E] hover:border-[#BE0D3E]/50'
            }`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {saved ? <><Check size={11} /> {TXT.saved}</> : <><Save size={11} /> {TXT.save}</>}
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

const ChatScreen: React.FC<{ formatSlug: string }> = ({ formatSlug }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const agent = AGENTS.find(f => f.slug === formatSlug);
  const cat = CATEGORIES.find(c => c.id === agent?.category);

  // Lazy + defensivo: nunca desreferencia `agent` indefinido no 1º render
  const [messages, setMessages] = useState<Message[]>(() =>
    agent ? [{ role: 'ia', content: INITIAL_MSG(agent) }] : []
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  if (sessionIdRef.current === null) sessionIdRef.current = newSessionId();

  // Biblioteca: IDs dos bubbles de IA já salvos na sessão + modal de salvar
  const [savedIdx, setSavedIdx] = useState<Set<number>>(new Set());
  const [saveModalIdx, setSaveModalIdx] = useState<number | null>(null);
  const [saveTitle, setSaveTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const { isRecording, recordingTime, error: recorderError, startRecording, stopRecording, cancelRecording } = useAudioRecorder();
  const [transcribing, setTranscribing] = useState(false);

  useEffect(() => {
    if (recorderError) toast({ title: recorderError });
  }, [recorderError, toast]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
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
          messages: next,
          sessionId: sessionIdRef.current,
          segment: agent?.category,
        },
      });
      if (error) {
        const errData = await readFnError(error);
        if (errData?.error === 'limite_atingido') {
          const msgLimit = TXT.limit_chats_segment(errData.limit, cat?.label ?? '');
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
      setMessages(prev => [...prev, { role: 'ia', content: data.reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : TXT.unknown_error;
      setMessages(prev => [...prev, { role: 'ia', content: `${TXT.error_prefix}\n\n${msg}\n\n${TXT.error_retry}` }]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    if (!agent) return;
    setMessages([{ role: 'ia', content: INITIAL_MSG(agent) }]);
    setInput('');
    setSavedIdx(new Set());
  };

  const openSaveModal = (idx: number) => {
    const iaMsg = messages[idx];
    const userMsg = messages.slice(0, idx).reverse().find(m => m.role === 'user');
    if (!iaMsg || !userMsg) return;
    // Título default: primeiros 60 caracteres do briefing
    const defaultTitle = userMsg.content.replace(/\s+/g, ' ').trim().slice(0, 60);
    setSaveTitle(defaultTitle);
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
    const { error } = await supabase.from('saved_viral_outputs').insert({
      user_id: user.id,
      model_slug: agent.slug,
      model_name: agent.name,
      title: cleanTitle,
      user_input: userMsg.content,
      ai_response: iaMsg.content,
    });
    setSaving(false);
    if (error) {
      toast({ title: TXT.toast_save_error, description: error.message, variant: 'destructive' });
      return;
    }
    setSavedIdx(prev => new Set(prev).add(saveModalIdx));
    setSaveModalIdx(null);
    toast({ title: TXT.toast_saved });
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

  return (
    <div className="fixed inset-0 bg-[#FFF7E6] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* Header */}
      <div className="shrink-0 border-b border-[#BE0D3E]/10 px-4 pt-3 pb-3 flex items-center gap-3"
        style={{ background: 'rgba(255,247,230,0.95)', backdropFilter: 'blur(20px)' }}>
        <button
          onClick={() => navigate('/chat')}
          className="w-8 h-8 flex items-center justify-center text-[#5B4041] shrink-0"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {cat && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cat.dot}`} />}
            {cat && <span className={`text-[8px] font-black uppercase tracking-widest ${cat.color}`}>{cat.label}</span>}
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

      {/* Mensagens */}
      <div
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

      {/* Modal de salvar na biblioteca */}
      {saveModalIdx !== null && (
        <div
          className="fixed inset-0 z-[100] bg-[#1E1B11]/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSaveModalIdx(null)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-[0_-8px_40px_rgba(0,0,0,0.2)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <LibraryIcon size={18} className="text-[#BE0D3E]" />
                <h3 className="text-[16px] font-black text-[#1E1B11]">{TXT.save_to_library}</h3>
              </div>
              <button
                onClick={() => setSaveModalIdx(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#FFF7E6] text-[#5B4041]"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <X size={14} />
              </button>
            </div>

            <p className="text-[10px] font-black text-[#5B4041] uppercase tracking-widest mb-2">
              {TXT.save_modal_label}
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
                onClick={() => setSaveModalIdx(null)}
                className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-[#F6D6DC] text-[#5B4041]"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {TXT.cancel}
              </button>
              <button
                onClick={confirmSave}
                disabled={saving || !saveTitle.trim()}
                className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-gradient-to-r from-[#BE0D3E] to-[#E06B85] text-white shadow-[0_4px_12px_rgba(190,13,62,0.3)] disabled:opacity-40 flex items-center justify-center gap-1.5"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {saving ? <><Loader2 size={12} className="animate-spin" /> {TXT.saving}</> : <><Save size={12} /> {TXT.save}</>}
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
  // Só monta o chat se o slug existir em AGENTS — slug desconhecido
  // (bookmark antigo, slug renomeado) volta pra grade em vez de quebrar.
  if (formatSlug && AGENTS.some(a => a.slug === formatSlug)) {
    return <ChatScreen formatSlug={formatSlug} />;
  }
  return <FormatsGrid />;
};

export default Chat;
