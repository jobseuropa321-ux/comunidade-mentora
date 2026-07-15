/* ═══════════════════════════════════════════════════════════════════════
 *  CONFIGURAÇÃO DOS AGENTES DE IA — edite AQUI pra mudar os agentes.
 *
 *  Os 4 agentes formam a esteira de criação de curso da Amentora:
 *   01 Arquiteto do Curso  → esqueleto (módulos + aulas + ordem)
 *   02 Roteirista de Aulas → roteiro pronto pra gravar, aula por aula
 *   03 Apostila Técnica    → material de apoio escrito do curso
 *   04 Pesquisa de Mercado → concorrentes, dores e oportunidades do nicho
 *
 *  Cada agente tem:
 *   - slug      → identificador único. TEM QUE BATER com a linha da tabela
 *                 `viral_models` no Supabase (é de lá que o backend lê o PROMPT).
 *                 O prompt NUNCA fica no frontend. ⚠️ NÃO renomeie os slugs.
 *   - name      → nome exibido no card e no header do chat
 *   - desc      → descrição curta do card
 *   - category  → uma das CATEGORIES abaixo (cor/rotulo da especialidade)
 *   - icon      → ícone lucide-react (usado em detalhes de UI)
 *   - gradient  → fundo do "palco" do robô no card (use GRAD.*)
 *   - openingMessage → 1ª mensagem que a IA "fala" ao abrir o chat
 *                 (é client-side, não gasta cota). Se omitir, usa a default.
 *
 *  ➕ PRA ADICIONAR UM 5º AGENTE: adicione um objeto aqui + insira a linha
 *     com o prompt em `viral_models` (ver docs/backend/PROMPTS_DOS_AGENTES.md).
 *  ✏️ PRA TROCAR O PROMPT DE UM AGENTE: só UPDATE em `viral_models`
 *     (não precisa mexer no código nem redeployar nada).
 * ═══════════════════════════════════════════════════════════════════════ */
import {
  Blocks, Clapperboard, BookOpen, BarChart3,
  type LucideIcon,
} from 'lucide-react';

/* Especialidades (cor + rótulo no card e no header do chat). */
export const CATEGORIES = [
  { id: 'estrutura', label: 'Estrutura',  color: 'text-[#BE0D3E]', dot: 'bg-[#BE0D3E]' },
  { id: 'roteiro',   label: 'Roteiros',   color: 'text-[#C77E14]', dot: 'bg-[#F6B43A]' },
  { id: 'apostila',  label: 'Apostila',   color: 'text-[#D06A85]', dot: 'bg-[#ECA6BB]' },
  { id: 'pesquisa',  label: 'Pesquisa',   color: 'text-[#94002D]', dot: 'bg-[#94002D]' },
];

/* Gradientes prontos pros palcos dos robôs — família de cores da marca. */
export const GRAD = {
  red:     'linear-gradient(150deg, #94002D 0%, #BE0D3E 55%, #D94368 100%)',
  wine:    'linear-gradient(150deg, #450015 0%, #7C0026 55%, #A30B34 100%)',
  orange:  'linear-gradient(150deg, #D98E1B 0%, #F6B43A 60%, #FBC85F 100%)',
  rose:    'linear-gradient(150deg, #C25A76 0%, #E06B85 60%, #ECA6BB 100%)',
  sunset:  'linear-gradient(150deg, #BE0D3E 0%, #E06B85 55%, #F6B43A 100%)',
  brand:   'linear-gradient(150deg, #BE0D3E 0%, #E06B85 50%, #F6B43A 100%)',
};

export interface Agent {
  slug: string;
  name: string;
  desc: string;
  category: string;
  icon: LucideIcon;
  gradient: string;
  /** Mensagem inicial customizada da IA. Se não tiver, usa a default genérica. */
  openingMessage?: string;
}

/* ── OS 4 AGENTES — a esteira do curso, na ordem ── */
export const AGENTS: Agent[] = [
  {
    slug: 'agente-1',
    name: 'Arquiteto do Curso',
    desc: 'Monta o esqueleto do curso: módulos e aulas na ordem certa.',
    category: 'estrutura',
    icon: Blocks,
    gradient: GRAD.red,
    openingMessage:
      'Olá! Eu sou o **Arquiteto do Curso** 🏗️\n\nEu desenho o **esqueleto completo** do seu curso: módulos, aulas e a ordem ideal de ensino.\n\nPra começar, me conta:\n\n1. Qual é o seu **nicho**?\n2. Qual **transformação** você quer entregar pras suas alunas?',
  },
  {
    slug: 'agente-2',
    name: 'Roteirista de Aulas',
    desc: 'Escreve o roteiro de cada aula, pronto pra gravar.',
    category: 'roteiro',
    icon: Clapperboard,
    gradient: GRAD.orange,
    openingMessage:
      'Olá! Eu sou a **Roteirista de Aulas** 🎬\n\nEu transformo cada aula num **roteiro pronto pra gravar** — com abertura, desenvolvimento e fechamento.\n\nMe manda:\n\n1. O **tema da aula** (ou cole o esqueleto que o Arquiteto montou)\n2. O **nível** das suas alunas (iniciantes, intermediárias...)',
  },
  {
    slug: 'agente-3',
    name: 'Apostila Técnica',
    desc: 'Cria a apostila do curso, o material de apoio das alunas.',
    category: 'apostila',
    icon: BookOpen,
    gradient: GRAD.rose,
    openingMessage:
      'Olá! Eu sou a **Apostila Técnica** 📘\n\nEu escrevo o **material de apoio** do seu curso, capítulo por capítulo, em linguagem clara.\n\nMe conta:\n\n1. O **tema ou módulo** da apostila\n2. O **nível** das suas alunas',
  },
  {
    slug: 'agente-4',
    name: 'Pesquisa de Mercado',
    desc: 'Mapeia concorrentes, dores e oportunidades do seu nicho.',
    category: 'pesquisa',
    icon: BarChart3,
    gradient: GRAD.wine,
    openingMessage:
      'Olá! Eu sou o **Pesquisa de Mercado** 🔎\n\nEu investigo o seu nicho: **concorrentes, dores da audiência e oportunidades** de posicionamento.\n\nMe conta:\n\n1. Qual é o seu **nicho**?\n2. Quem é a sua **cliente ideal**?',
  },
];

/** Mensagem de abertura default (quando o agente não define openingMessage). */
export const defaultOpening = (name: string) =>
  `Olá! Sou especialista em **${name}**.\n\nPra começar, me conta:\n\n1. Qual é o seu **nicho**?\n2. O que você quer criar hoje?`;
