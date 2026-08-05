import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { AGENTS, CATEGORIES, defaultOpening, type Agent } from '@/data/agents';
import VoiceField from '@/components/VoiceField';
import { Robot, SceneFX, ACCENT, type RobotKind } from '@/components/estudio/AgentRobot';
import AnalisarPerfilAgent from '@/components/estudio/AnalisarPerfilAgent';

/* ─────────────────────────────────────────────
   TEXTOS DA TELA (toda a "escrita" daqui)
───────────────────────────────────────────── */
const TXT = {
  grid_title: 'Estúdio de Criação',
  grid_subtitle: 'Crie seu curso em minutos usando IA. Um agente pra cada etapa — e bônus de viralização.',
  your_models: 'Seus Cursos',
  library: 'Biblioteca',
  create_btn: 'Começar',
  agent_word: 'Agente',
  saved: 'Salvo',
  save: 'Salvar',
  saving_lesson: 'Salvando aula...',
  retry_save: 'Tentar salvar',
  answer_required: 'Sua resposta é necessária',
  answer_below: 'Responda no campo abaixo',
  next_lesson: 'Criar próxima aula',
  next_lesson_hint: 'Ou digite “próxima” no campo de mensagem.',
  lesson_saved: 'Aula salva automaticamente ✨',
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
  save_course_label: 'Nome do curso',
  exit_title: 'Salvar antes de sair?',
  exit_desc: 'Você gerou um conteúdo que ainda não foi salvo. Quer guardar na Biblioteca antes de sair?',
  exit_discard: 'Sair sem salvar',
  exit_save: 'Salvar e sair',
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

const countLessonsInSkeleton = (content: string) => {
  const lessonNumbers = new Set<string>();
  for (const match of content.matchAll(/\baula\s*(\d{1,3}(?:[.-]\d{1,3})?)\b/gi)) {
    lessonNumbers.add(match[1]);
  }
  return Math.max(lessonNumbers.size, 1);
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
            {agent.bonus ? 'BÔNUS' : `${TXT.agent_word} ${num}`} · {cat?.label}
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
const BonusDivider: React.FC = () => (
  <motion.div variants={cardVariants} className="flex items-center gap-2 py-4">
    <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#FF2D7A]/45" />
    <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: '#E8226C' }}>
      <Zap size={11} className="fill-[#C8F000] text-[#C8F000]" /> Bônus · Viralização
    </span>
    <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#C8F000]/70" />
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
  saveStatus?: SaveStatus;
}> = ({ msg, onSave, saved, saveStatus = 'idle' }) => {
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
  key: string; label: string; hint: string; placeholder: string; required: boolean; multiline: boolean;
}[] = [
  { key: 'sobre', label: 'Sobre você e sua técnica', hint: 'Quem é você, sua experiência e o diferencial do seu método.', placeholder: 'Ex.: Sou cabeleireiro há 14 anos, especialista em mechas...', required: true, multiline: true },
  { key: 'produto', label: 'Que tipo de produto você quer criar?', hint: 'Formato, quantos módulos e quantas aulas por módulo, profundidade.', placeholder: 'Ex.: Um curso completo mas direto, no máximo 4 módulos...', required: true, multiline: true },
  { key: 'nome', label: 'Nome provisório do produto', hint: 'Se já tiver um nome em mente. Vira o nome padrão ao salvar (pode deixar em branco).', placeholder: 'Ex.: Morena Iluminada das Gringas', required: false, multiline: false },
  { key: 'dor', label: 'Qual a dor principal que ele resolve?', hint: 'O problema que o seu aluno vive hoje.', placeholder: 'Ex.: O medo de manchar o cabelo da cliente...', required: true, multiline: true },
  { key: 'ideia', label: 'Qual a ideia central do produto?', hint: 'A essência do curso. Pode incluir preço e tempo de consumo.', placeholder: 'Ex.: Um curso low ticket, direto ao ponto, assistível em 1 ou 2 dias...', required: true, multiline: true },
  { key: 'aprender', label: 'O que o aluno precisa aprender a fazer?', hint: 'As habilidades e resultados que ele leva.', placeholder: 'Ex.: Fazer as mechas estratégicas, matização, correção de cor...', required: true, multiline: true },
  { key: 'transformacao', label: 'Qual a transformação final?', hint: 'Onde o aluno chega ao terminar o curso.', placeholder: 'Ex.: Estar preparado para fazer uma morena iluminada de excelência em qualquer cabelo...', required: true, multiline: true },
  { key: 'estrutura', label: 'Já tem ideia de estrutura?', hint: 'Se sim, descreva o que imagina. Se não, deixe em branco que eu monto do zero.', placeholder: 'Ex.: Não tenho ideia ainda...', required: false, multiline: true },
];

const compileBriefing = (a: Record<string, string>) => {
  const g = (k: string, fb = '—') => (a[k]?.trim() ? a[k].trim() : fb);
  return `Aqui estão as informações do meu produto:

1. Sobre mim e minha técnica: ${g('sobre')}
2. Tipo de produto: ${g('produto')}
3. Nome provisório: ${g('nome', '(ainda sem nome definido)')}
4. Dor principal que resolve: ${g('dor')}
5. Ideia central: ${g('ideia')}
6. O que o meu aluno precisa aprender: ${g('aprender')}
7. Transformação final: ${g('transformacao')}
8. Já tenho ideia de estrutura: ${g('estrutura', 'Não tenho ideia, pode montar do zero')}

Monte o esqueleto completo do meu curso com base nisso.`;
};

/* ═════════════════════════════════════════════
   FORMULÁRIO DA APOSTILA (agente-3) — 5 perguntas próprias.
   Independente do esqueleto: o Apostila monta a própria estrutura.
═════════════════════════════════════════════ */
const APOSTILA_QUESTIONS: typeof ARCHITECT_QUESTIONS = [
  { key: 'expert', label: 'Nome da expert ou autora do método', hint: 'Quem assina a apostila (o método leva esse nome).', placeholder: 'Ex.: Método Ana Souza', required: true, multiline: false },
  { key: 'tecnica', label: 'Nome da técnica, curso ou profissão', hint: 'O que a apostila vai ensinar. Vira o nome padrão ao salvar.', placeholder: 'Ex.: Morena Iluminada das Gringas', required: true, multiline: true },
  { key: 'conteudo', label: 'Explique em detalhes o que quer ensinar', hint: 'Quanto mais detalhe, mais completa a apostila. Pode escrever bastante.', placeholder: 'Ex.: Ensinar morena iluminada à mão livre e com papel, correção de cor e matização...', required: true, multiline: true },
  { key: 'nivel', label: 'Para qual nível?', hint: 'Iniciantes, intermediários, avançados ou todos os níveis.', placeholder: 'Ex.: Todos os níveis', required: true, multiline: false },
  { key: 'estilo', label: 'Que estilo de apostila?', hint: 'Mais técnica, mais simples, mais premium ou equilibrada.', placeholder: 'Ex.: Premium e equilibrada', required: true, multiline: false },
];

const compileApostila = (a: Record<string, string>) => {
  const g = (k: string, fb = '—') => (a[k]?.trim() ? a[k].trim() : fb);
  return `Informações para a apostila (as 5 respostas já preenchidas):

1. Nome da expert/autora do método: ${g('expert')}
2. Nome da técnica/curso/profissão: ${g('tecnica')}
3. O que ensinar (detalhado): ${g('conteudo')}
4. Nível: ${g('nivel')}
5. Estilo desejado: ${g('estilo')}

Use essas respostas e comece a apostila direto pela PARTE 1 DE 4. Não faça perguntas.`;
};

/* ── Formulário do PESQUISA DE MERCADO (agente-4) — também independente ── */
const PESQUISA_QUESTIONS: typeof ARCHITECT_QUESTIONS = [
  { key: 'nicho', label: 'Qual nicho você quer atuar?', hint: 'O mercado ou tema do seu produto.', placeholder: 'Ex.: Alongamento de unhas em gel', required: true, multiline: false },
  { key: 'publico', label: 'Quem é o seu público-alvo?', hint: 'Idade, gênero, profissão, nível de conhecimento e o que mais souber (localização: Brasil).', placeholder: 'Ex.: Mulheres 20-40, manicures iniciantes querendo se especializar...', required: true, multiline: true },
  { key: 'ensina', label: 'O que você sabe ensinar de melhor?', hint: 'Sua principal habilidade ou entrega.', placeholder: 'Ex.: Molde F1 com acabamento perfeito...', required: true, multiline: true },
  { key: 'ajudou', label: 'Já ajudou alguém com isso?', hint: 'Resultados ou histórias, se tiver (pode deixar em branco).', placeholder: 'Ex.: Já formei 30 alunas presencialmente...', required: false, multiline: true },
  { key: 'diferencial', label: 'Tem algum diferencial?', hint: 'O que te separa dos concorrentes.', placeholder: 'Ex.: Método próprio de aplicação sem bolhas...', required: false, multiline: true },
];

const compilePesquisa = (a: Record<string, string>) => {
  const g = (k: string, fb = '—') => (a[k]?.trim() ? a[k].trim() : fb);
  return `Sou uma pessoa interessada em criar um produto digital campeão de vendas. Atue como meu analista de mercado com base nestas informações:

- Nicho que desejo atuar: ${g('nicho')}
- Público-alvo (localização: Brasil): ${g('publico')}
- O que eu sei ensinar de melhor: ${g('ensina')}
- Já ajudei alguém com isso: ${g('ajudou')}
- Meu diferencial: ${g('diferencial')}

Faça a pesquisa aprofundada e me entregue os 5 pontos (dores do público, principais buscas no Google, produtos digitais já existentes, oportunidades/falhas dos concorrentes e de 3 a 7 ideias de produto).`;
};

/* ── Nome Potente (agente-5) ── */
const NOME_QUESTIONS: typeof ARCHITECT_QUESTIONS = [
  { key: 'tipo', label: 'Que tipo de produto é?', hint: 'Curso, mentoria, ebook, desafio...', placeholder: 'Ex.: Curso', required: true, multiline: false },
  { key: 'nome_prov', label: 'Nome provisório (se tiver)', hint: 'Se já tem um nome em mente. Pode deixar em branco.', placeholder: 'Ex.: Molde F1 do zero', required: false, multiline: false },
  { key: 'tema', label: 'Tema principal do produto', hint: 'O que ele ensina de fato.', placeholder: 'Ex.: Ensinar a fazer o primeiro molde F1', required: true, multiline: true },
  { key: 'publico', label: 'Público-alvo específico', hint: 'Pra quem é.', placeholder: 'Ex.: Nail designers iniciantes', required: true, multiline: false },
  { key: 'transformacao', label: 'Transformação que entrega', hint: 'O resultado que o aluno terá.', placeholder: 'Ex.: Fazer o primeiro alongamento em molde F1', required: true, multiline: true },
  { key: 'diferencial', label: 'Diferencial (se tiver)', hint: 'O que te destaca. Pode deixar em branco.', placeholder: 'Ex.: A pessoa aprende em pouco tempo', required: false, multiline: true },
  { key: 'linguagem', label: 'Linguagem desejada pro nome', hint: 'O tom do nome.', placeholder: 'Ex.: Informal', required: true, multiline: false },
];
const compileNome = (a: Record<string, string>) => {
  const g = (k: string, fb = '—') => (a[k]?.trim() ? a[k].trim() : fb);
  return `Informações do produto (para criar o nome):

- Tipo de produto: ${g('tipo')}
- Nome provisório: ${g('nome_prov', '(não tem)')}
- Tema principal: ${g('tema')}
- Público-alvo: ${g('publico')}
- Transformação que entrega: ${g('transformacao')}
- Diferencial: ${g('diferencial', '(não informado)')}
- Linguagem desejada pro nome: ${g('linguagem')}

Crie as sugestões de nome com base nisso.`;
};

/* ── Promessa Irresistível (agente-6) ── */
const PROMESSA_QUESTIONS: typeof ARCHITECT_QUESTIONS = [
  { key: 'nome', label: 'Nome do produto', hint: 'O nome escolhido ou provisório.', placeholder: 'Ex.: Molde F1 das Gringas', required: true, multiline: false },
  { key: 'tipo', label: 'Tipo de produto', hint: 'Curso, mentoria, ebook, desafio, planilha...', placeholder: 'Ex.: Curso online', required: true, multiline: false },
  { key: 'tema', label: 'Tema central do produto', hint: 'Sobre o que é.', placeholder: 'Ex.: Unhas em molde F1', required: true, multiline: false },
  { key: 'publico', label: 'Público-alvo específico', hint: 'Pra quem é.', placeholder: 'Ex.: Manicures iniciantes sem tempo', required: true, multiline: true },
  { key: 'transformacao', label: 'Transformação após o produto', hint: 'O que o aluno consegue depois.', placeholder: 'Ex.: Fazer a primeira unha em molde F1', required: true, multiline: true },
  { key: 'tempo', label: 'Resultado em quanto tempo?', hint: 'O prazo da transformação.', placeholder: 'Ex.: 7 dias', required: true, multiline: false },
  { key: 'diferencial', label: 'Diferencial que acelera (se tiver)', hint: 'Método validado, com IA, prático... Pode deixar em branco.', placeholder: 'Ex.: Método validado por 200 alunas', required: false, multiline: true },
];
const compilePromessa = (a: Record<string, string>) => {
  const g = (k: string, fb = '—') => (a[k]?.trim() ? a[k].trim() : fb);
  return `Informações do produto (para criar a promessa):

- Nome do produto: ${g('nome')}
- Tipo de produto: ${g('tipo')}
- Tema central: ${g('tema')}
- Público-alvo: ${g('publico')}
- Transformação após o produto: ${g('transformacao')}
- Resultado esperado em: ${g('tempo')}
- Diferencial que acelera: ${g('diferencial', '(não informado)')}

Crie as promessas SMART com base nisso.`;
};

/* ── Ganchos Virais (agente-7 · bônus) ── */
const GANCHOS_QUESTIONS: typeof ARCHITECT_QUESTIONS = [
  { key: 'nicho', label: 'Qual é o seu nicho?', hint: 'O mercado onde você atua.', placeholder: 'Ex.: Nail designer', required: true, multiline: false },
  { key: 'ensina', label: 'O que você ensina, vende ou entrega?', hint: 'Explique com detalhes.', placeholder: 'Ex.: Ensino manicures a fazer molde F1 com acabamento profissional...', required: true, multiline: true },
  { key: 'nivel', label: 'Com qual nível de pessoa quer falar?', hint: 'Iniciante, intermediário, avançado ou todos.', placeholder: 'Ex.: Iniciante', required: true, multiline: false },
  { key: 'objetivo', label: 'Qual o objetivo dos ganchos?', hint: 'Atrair clientes, vender curso, crescer no Instagram, autoridade, engajamento...', placeholder: 'Ex.: Atrair alunas pro curso', required: true, multiline: false },
  { key: 'dor', label: 'Alguma dor ou desejo específico?', hint: 'Se não souber, deixe em branco que eu defino.', placeholder: 'Ex.: Medo de não conseguir clientes', required: false, multiline: true },
];
const compileGanchos = (a: Record<string, string>) => {
  const g = (k: string, fb = '—') => (a[k]?.trim() ? a[k].trim() : fb);
  return `Informações para os ganchos:

1. Nicho: ${g('nicho')}
2. O que ensina/vende/entrega: ${g('ensina')}
3. Nível do público: ${g('nivel')}
4. Objetivo dos ganchos: ${g('objetivo')}
5. Dor/desejo específico: ${g('dor', 'pode definir sozinho')}

Agora gere os 20 ganchos, seguindo exatamente o formato definido.`;
};

/* ── Narrado Técnico (agente-8 · bônus) ── */
const NARRADO_QUESTIONS: typeof ARCHITECT_QUESTIONS = [
  { key: 'entrada', label: 'Qual seu nicho OU um gancho pronto?', hint: 'Mande só o nicho (que eu escolho o tema) OU cole um gancho que você já tem.', placeholder: 'Ex.: Nail designer  —ou—  "o erro que faz o molde F1 descolar"', required: true, multiline: true },
];
const compileNarrado = (a: Record<string, string>) => {
  const g = (k: string, fb = '—') => (a[k]?.trim() ? a[k].trim() : fb);
  return `Nicho ou gancho informado pelo usuário: ${g('entrada')}

Identifique se é um NICHO ou um GANCHO pronto e crie o roteiro narrado técnico, no formato exato definido.`;
};

/* ── Carrossel Viral (agente-9 · bônus) ── */
const CARROSSEL_QUESTIONS: typeof ARCHITECT_QUESTIONS = [
  { key: 'nicho', label: 'Qual é o seu nicho?', hint: 'O mercado onde você atua.', placeholder: 'Ex.: Nail designer', required: true, multiline: false },
  { key: 'faz', label: 'O que você faz nesse nicho?', hint: 'Explique com detalhes.', placeholder: 'Ex.: Ensino e faço alongamento em molde F1...', required: true, multiline: true },
  { key: 'tema', label: 'Tema, gancho ou ideia (se tiver)', hint: 'Se já tem um tema pro carrossel. Deixe em branco que eu crio.', placeholder: 'Ex.: 5 erros no molde F1', required: false, multiline: true },
  { key: 'foco', label: 'Foco do carrossel', hint: 'Viralização, autoridade, ensino técnico, conversão, conexão ou misto.', placeholder: 'Ex.: Autoridade', required: true, multiline: false },
  { key: 'cta', label: 'CTA final', hint: 'Seguir, comentar, compartilhar, salvar, direct, curso, mentoria, atendimento...', placeholder: 'Ex.: Seguir', required: true, multiline: false },
];
const compileCarrossel = (a: Record<string, string>) => {
  const g = (k: string, fb = '—') => (a[k]?.trim() ? a[k].trim() : fb);
  return `Informações para o carrossel:

1. Nicho: ${g('nicho')}
2. O que faz no nicho: ${g('faz')}
3. Tema/gancho/ideia: ${g('tema', '(não tem — pode criar do zero)')}
4. Foco: ${g('foco')}
5. CTA final: ${g('cta')}

Agora monte o carrossel completo no formato exato definido, com análise estratégica e 3 variações.`;
};

/* Configuração de cada "entrevista" (formulário) por agente. */
interface IntakeConfig {
  questions: typeof ARCHITECT_QUESTIONS;
  subtitle: string;
  submitLabel: string;
  compile: (a: Record<string, string>) => { briefing: string; courseName: string };
}
const INTAKE: Record<string, IntakeConfig> = {
  'agente-1': {
    questions: ARCHITECT_QUESTIONS,
    subtitle: 'Vamos montar o esqueleto do seu curso',
    submitLabel: 'Gerar esqueleto',
    compile: a => ({ briefing: compileBriefing(a), courseName: (a['nome'] ?? '').trim() }),
  },
  'agente-3': {
    questions: APOSTILA_QUESTIONS,
    subtitle: 'Vamos montar a sua apostila',
    submitLabel: 'Gerar apostila',
    compile: a => ({ briefing: compileApostila(a), courseName: (a['tecnica'] ?? '').trim() }),
  },
  'agente-4': {
    questions: PESQUISA_QUESTIONS,
    subtitle: 'Vamos pesquisar o seu mercado',
    submitLabel: 'Pesquisar mercado',
    compile: a => ({ briefing: compilePesquisa(a), courseName: `Pesquisa — ${(a['nicho'] ?? '').trim()}`.trim() }),
  },
  'agente-5': {
    questions: NOME_QUESTIONS,
    subtitle: 'Vamos criar um nome potente',
    submitLabel: 'Gerar nomes',
    compile: a => ({ briefing: compileNome(a), courseName: ((a['nome_prov'] || a['tema']) ?? '').trim() }),
  },
  'agente-6': {
    questions: PROMESSA_QUESTIONS,
    subtitle: 'Vamos criar sua promessa',
    submitLabel: 'Gerar promessas',
    compile: a => ({ briefing: compilePromessa(a), courseName: ((a['nome'] || a['tema']) ?? '').trim() }),
  },
  'agente-7': {
    questions: GANCHOS_QUESTIONS,
    subtitle: 'Vamos criar seus ganchos',
    submitLabel: 'Gerar 20 ganchos',
    compile: a => ({ briefing: compileGanchos(a), courseName: `Ganchos — ${(a['nicho'] ?? '').trim()}`.trim() }),
  },
  'agente-8': {
    questions: NARRADO_QUESTIONS,
    subtitle: 'Vamos criar seu roteiro',
    submitLabel: 'Gerar roteiro',
    compile: a => ({ briefing: compileNarrado(a), courseName: `Roteiro — ${(a['entrada'] ?? '').trim().slice(0, 40)}`.trim() }),
  },
  'agente-9': {
    questions: CARROSSEL_QUESTIONS,
    subtitle: 'Vamos criar seu carrossel',
    submitLabel: 'Gerar carrossel',
    compile: a => ({ briefing: compileCarrossel(a), courseName: `Carrossel — ${(a['nicho'] ?? '').trim()}`.trim() }),
  },
};

const AgentIntakeForm: React.FC<{
  agent: Agent; config: IntakeConfig; reduce: boolean; onBack: () => void;
  onSubmit: (briefing: string, courseName: string) => void;
}> = ({ agent, config, reduce, onBack, onSubmit }) => {
  const kind = agent.category as RobotKind;
  const acc = ACCENT[kind];
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const q = config.questions[step];
  const total = config.questions.length;
  const val = answers[q.key] ?? '';
  const canNext = !q.required || val.trim().length > 0;
  const isLast = step === total - 1;

  const goNext = () => {
    if (!canNext) return;
    if (isLast) { const { briefing, courseName } = config.compile(answers); onSubmit(briefing, courseName); }
    else setStep(s => s + 1);
  };
  const goBack = () => (step === 0 ? onBack() : setStep(s => s - 1));

  return (
    <div className="fixed inset-0 bg-[#FFF7E6] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Palco do robô */}
      <div className="shrink-0 relative overflow-hidden" style={{ background: agent.gradient }}>
        <button onClick={goBack} className="absolute top-3 left-3 z-10 w-8 h-8 flex items-center justify-center text-white/90" style={{ WebkitTapHighlightColor: 'transparent' }}>
          <ArrowLeft size={18} />
        </button>
        <div className="relative px-4 pt-3 pb-4 flex flex-col items-center">
          <Robot kind={kind} reduce={reduce} />
          <p className="text-white text-[15px] font-black mt-1">{agent.name}</p>
          <p className="text-white/80 text-[11px]">{config.subtitle}</p>
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
          {q.label}
          {!q.required && <span className="text-[#5B4041]/40 text-[12px] font-medium"> · opcional</span>}
        </h2>
        <p className="text-[12px] text-[#5B4041]/70 mt-1.5 mb-4">{q.hint}</p>
        <VoiceField
          key={q.key}
          multiline={q.multiline}
          value={val}
          onChange={v => setAnswers(p => ({ ...p, [q.key]: v }))}
          placeholder={q.placeholder}
          autoFocus
          rows={5}
        />
        <p className="text-[10px] text-[#5B4041]/45 mt-2 flex items-center gap-1">
          <Mic size={11} className="text-[#BE0D3E]" /> Toque no microfone pra responder falando.
        </p>
      </div>

      {/* Ações */}
      <div className="shrink-0 px-4 py-3 border-t border-[#BE0D3E]/10 flex gap-2" style={{ background: 'rgba(255,247,230,0.95)', backdropFilter: 'blur(20px)' }}>
        <button onClick={goBack} className="px-5 py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest bg-[#F6D6DC] text-[#5B4041]" style={{ WebkitTapHighlightColor: 'transparent' }}>
          {step === 0 ? 'Sair' : 'Voltar'}
        </button>
        <button
          onClick={goNext}
          disabled={!canNext}
          className="flex-1 py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-1.5 disabled:opacity-30 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #BE0D3E, #E06B85)', WebkitTapHighlightColor: 'transparent' }}
        >
          {isLast ? <><Sparkles size={14} /> {config.submitLabel}</> : <>Próxima <ArrowRight size={14} /></>}
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
  onBack: () => void; onPick: (it: SkeletonItem) => void; onCreate: () => void;
}> = ({ agent, userId, reduce, onBack, onPick, onCreate }) => {
  const kind = agent.category as RobotKind;
  const [items, setItems] = useState<SkeletonItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !SUPABASE_READY) { setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('saved_viral_outputs')
        .select('id, title, ai_response, created_at')
        .eq('user_id', userId)
        .eq('model_slug', 'agente-1')
        .order('created_at', { ascending: false });
      if (cancel) return;
      setItems((data ?? []) as SkeletonItem[]);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [userId]);

  return (
    <div className="fixed inset-0 bg-[#FFF7E6] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Palco do robô */}
      <div className="shrink-0 relative overflow-hidden" style={{ background: agent.gradient }}>
        <button onClick={onBack} className="absolute top-3 left-3 z-10 w-8 h-8 flex items-center justify-center text-white/90" style={{ WebkitTapHighlightColor: 'transparent' }}>
          <ArrowLeft size={18} />
        </button>
        <div className="relative px-4 pt-3 pb-4 flex flex-col items-center">
          <Robot kind={kind} reduce={reduce} />
          <p className="text-white text-[15px] font-black mt-1">{agent.name}</p>
          <p className="text-white/80 text-[11px]">Escolha o esqueleto pra criar as aulas</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {loading ? (
          <div className="flex justify-center pt-10"><Loader2 className="w-6 h-6 text-[#BE0D3E] animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center pt-10 px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#F6D6DC] flex items-center justify-center mx-auto mb-4"><Layers className="text-[#BE0D3E]" size={24} /></div>
            <h3 className="text-[16px] font-black text-[#1E1B11]">Nenhum esqueleto salvo ainda</h3>
            <p className="text-[12px] text-[#5B4041]/70 mt-1.5 mb-5">Crie e salve um esqueleto no <b>Arquiteto do Curso</b> primeiro. Depois volte aqui pra escrever as aulas.</p>
            <button onClick={onCreate} className="inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest text-white" style={{ background: 'linear-gradient(135deg, #BE0D3E, #E06B85)', WebkitTapHighlightColor: 'transparent' }}>
              <Blocks size={14} /> Ir pro Arquiteto
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50 mb-1">
              {items.length} esqueleto{items.length > 1 ? 's' : ''} salvo{items.length > 1 ? 's' : ''}
            </p>
            {items.map(it => (
              <button
                key={it.id}
                onClick={() => onPick(it)}
                className="w-full text-left bg-white border border-[#BE0D3E]/15 hover:border-[#BE0D3E]/40 rounded-2xl p-4 transition-all active:scale-[0.99]"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-9 h-9 rounded-xl bg-[#F6D6DC] flex items-center justify-center mt-0.5"><Layers size={16} className="text-[#BE0D3E]" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-[#1E1B11] truncate">{it.title}</p>
                    <p className="text-[11px] text-[#5B4041]/60 line-clamp-2 mt-0.5">{it.ai_response.replace(/[#*_>`-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)}</p>
                  </div>
                  <ChevronRight size={16} className="text-[#BE0D3E]/40 shrink-0 mt-2" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

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
  const [saveStatuses, setSaveStatuses] = useState<Record<number, SaveStatus>>({});

  // Esteira Arquiteto→Roteirista: etapa da tela, nome do curso e modo "salvar ao sair"
  const reduce = !!useReducedMotion();
  const [stage, setStage] = useState<'form' | 'picker' | 'chat'>(
    agent?.slug === 'agente-2' ? 'picker' : (agent && INTAKE[agent.slug]) ? 'form' : 'chat'
  );
  const [courseName, setCourseName] = useState('');
  const [exitMode, setExitMode] = useState(false);
  const [lessonProgress, setLessonProgress] = useState<{ current: number; total: number } | null>(null);

  const { isRecording, recordingTime, error: recorderError, startRecording, stopRecording, cancelRecording } = useAudioRecorder();
  const [transcribing, setTranscribing] = useState(false);

  useEffect(() => {
    if (recorderError) toast({ title: recorderError });
  }, [recorderError, toast]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const saveLessonAutomatically = async (
    replyIdx: number,
    userInput: string,
    aiResponse: string,
    title: string,
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

  // Núcleo de geração: recebe a mensagem do usuário + a base de conversa a usar.
  // Passar `base` explicitamente evita ler `messages` desatualizado (formulário/picker).
  const runGeneration = async (
    userMsg: Message,
    base: Message[],
    lessonToSave?: { courseTitle: string; lessonNumber: number },
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
          messages: next.map(m => ({ role: m.role, content: m.content })),
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
      const reply = String(data?.reply ?? '').trim();
      if (!reply) throw new Error('A IA não retornou conteúdo');
      const replyIdx = next.length;
      setMessages([...next, { role: 'ia', content: reply }]);
      if (lessonToSave) {
        await saveLessonAutomatically(
          replyIdx,
          userMsg.content,
          reply,
          `${lessonToSave.courseTitle} — Aula ${lessonToSave.lessonNumber}`,
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
    if (lessonProgress.current >= lessonProgress.total) return;

    const nextLesson = lessonProgress.current + 1;
    setInput('');
    setLessonProgress(prev => prev ? { ...prev, current: nextLesson } : prev);
    const content = `A Aula ${lessonProgress.current} foi concluída. Agora escreva somente a Aula ${nextLesson} do curso "${courseName}", mantendo a ordem e o conteúdo definidos no esqueleto.`;
    const display = `✨ Próxima etapa: Aula ${nextLesson} de ${lessonProgress.total}`;
    runGeneration(
      { role: 'user', content, display },
      messages,
      { courseTitle: courseName || 'Meu curso', lessonNumber: nextLesson },
    );
  };

  const send = () => {
    const text = input.trim();
    if (!text || loading) return;
    if (
      agent?.slug === 'agente-2'
      && /^(pr[oó]xima)(\s+aula)?[.!]?$/i.test(text)
      && lessonProgress
      && lessonProgress.current < lessonProgress.total
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
    setInput('');
    setSavedIdx(new Set());
    setSaveStatuses({});
    setLessonProgress(null);
    if (agent.slug === 'agente-2') { setMessages([]); setStage('picker'); return; }
    if (INTAKE[agent.slug]) { setMessages([]); setStage('form'); return; }
    setMessages([{ role: 'ia', content: INITIAL_MSG(agent) }]);
  };

  const openSaveModal = (idx: number) => {
    const iaMsg = messages[idx];
    const userMsg = messages.slice(0, idx).reverse().find(m => m.role === 'user');
    if (!iaMsg || !userMsg) return;
    // Título default: nome do curso (esteira) ou primeiros 60 caracteres do briefing
    const defaultTitle =
      agent?.slug === 'agente-2' && courseName ? `${courseName} — Aula ${lessonProgress?.current ?? 1}`
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
    if (wasExit) navigate('/chat');
  };

  const closeSaveModal = () => { setSaveModalIdx(null); setExitMode(false); };

  // Formulário do Arquiteto concluído → gera o esqueleto a partir do briefing.
  const handleFormSubmit = (briefing: string, name: string) => {
    setCourseName(name);
    setStage('chat');
    runGeneration({ role: 'user', content: briefing }, []);
  };

  // Esqueleto escolhido no Roteirista → injeta como base e pede a 1ª aula.
  const handlePickSkeleton = (it: SkeletonItem) => {
    const totalLessons = countLessonsInSkeleton(it.ai_response);
    setCourseName(it.title);
    setLessonProgress({ current: 1, total: totalLessons });
    setSaveStatuses({});
    setStage('chat');
    const injected = `Esqueleto validado do curso "${it.title}":\n\n${it.ai_response}\n\nComece escrevendo a primeira aula (Aula 1) com base nesse esqueleto.`;
    const display = `📋 Curso escolhido: "${it.title}".\n\nVou criar uma aula por vez e salvar cada aula automaticamente na Biblioteca.`;
    runGeneration(
      { role: 'user', content: injected, display },
      [],
      { courseTitle: it.title, lessonNumber: 1 },
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
            ? `${courseName || 'Meu curso'} — Aula ${lessonProgress?.current ?? 1}`
            : courseName || 'Esqueleto do meu curso',
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
    return <AgentIntakeForm agent={agent} config={INTAKE[agent.slug]} reduce={reduce} onBack={() => navigate('/chat')} onSubmit={handleFormSubmit} />;
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
  const showNextLesson =
    agent.slug === 'agente-2'
    && !!lessonProgress
    && lessonProgress.current < lessonProgress.total
    && lastMessage?.role === 'ia'
    && (saveStatuses[messages.length - 1] === 'saved' || saveStatuses[messages.length - 1] === 'error')
    && !loading;

  return (
    <div className="fixed inset-0 bg-[#FFF7E6] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

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

      {agent.slug === 'agente-2' && lessonProgress && (
        <div className="shrink-0 border-b border-[#BE0D3E]/10 bg-white/75 px-4 py-2.5">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#BE0D3E] text-[12px] font-black text-white shadow-[0_5px_14px_rgba(190,13,62,0.22)]">
              {lessonProgress.current}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-black text-[#1E1B11]">
                  Aula {lessonProgress.current} de {lessonProgress.total}
                </p>
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#BE0D3E]">uma por vez</span>
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
              {TXT.next_lesson}
              <ArrowRight size={14} strokeWidth={2.8} />
            </button>
            <p className="mt-1.5 text-center text-[9px] text-[#5B4041]/55">{TXT.next_lesson_hint}</p>
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
                onClick={exitMode ? () => { closeSaveModal(); navigate('/chat'); } : closeSaveModal}
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
