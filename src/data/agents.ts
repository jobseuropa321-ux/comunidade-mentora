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
  Tag, Megaphone, Anchor, Mic, GalleryHorizontalEnd,
  Target, GraduationCap,
  type LucideIcon,
} from 'lucide-react';

/* Especialidades (cor + rótulo no card e no header do chat). */
export const CATEGORIES = [
  { id: 'estrutura', label: 'Estrutura',  color: 'text-[#BE0D3E]', dot: 'bg-[#BE0D3E]' },
  { id: 'roteiro',   label: 'Roteiros',   color: 'text-[#C77E14]', dot: 'bg-[#F6B43A]' },
  { id: 'apostila',  label: 'Apostila',   color: 'text-[#D06A85]', dot: 'bg-[#ECA6BB]' },
  { id: 'pesquisa',  label: 'Pesquisa',   color: 'text-[#94002D]', dot: 'bg-[#94002D]' },
  { id: 'nome',      label: 'Naming',     color: 'text-[#BE0D3E]', dot: 'bg-[#BE0D3E]' },
  { id: 'promessa',  label: 'Copy',       color: 'text-[#D06A85]', dot: 'bg-[#E06B85]' },
  // anúncios (azul) — tráfego pago
  { id: 'anuncioPS',   label: 'Anúncio',   color: 'text-[#1D4ED8]', dot: 'bg-[#2563EB]' },
  { id: 'anuncioAula', label: 'Mini-Aula', color: 'text-[#0369A1]', dot: 'bg-[#0EA5E9]' },
  // bônus de viralização — lime + rosa choque (id visual "Viral em 1 Minuto")
  { id: 'ganchos',   label: 'Ganchos',    color: 'text-[#E8226C]', dot: 'bg-[#FF2D7A]' },
  { id: 'narrado',   label: 'Narrado',    color: 'text-[#6E8B00]', dot: 'bg-[#C8F000]' },
  { id: 'carrossel', label: 'Carrossel',  color: 'text-[#E8226C]', dot: 'bg-[#FF2D7A]' },
];

/* Gradientes prontos pros palcos dos robôs — família de cores da marca. */
export const GRAD = {
  red:     'linear-gradient(150deg, #94002D 0%, #BE0D3E 55%, #D94368 100%)',
  wine:    'linear-gradient(150deg, #450015 0%, #7C0026 55%, #A30B34 100%)',
  orange:  'linear-gradient(150deg, #D98E1B 0%, #F6B43A 60%, #FBC85F 100%)',
  rose:    'linear-gradient(150deg, #C25A76 0%, #E06B85 60%, #ECA6BB 100%)',
  sunset:  'linear-gradient(150deg, #BE0D3E 0%, #E06B85 55%, #F6B43A 100%)',
  brand:   'linear-gradient(150deg, #BE0D3E 0%, #E06B85 50%, #F6B43A 100%)',
  // anúncios (azul) — tráfego pago
  adBlue: 'linear-gradient(150deg, #1E3A8A 0%, #2563EB 55%, #60A5FA 100%)',
  adSky:  'linear-gradient(150deg, #075985 0%, #0EA5E9 55%, #67E8F9 100%)',
  // bônus de viralização (lime #C8F000 + rosa choque #FF2D7A)
  viralPink: 'linear-gradient(150deg, #C8005A 0%, #FF2D7A 55%, #FF8FBE 100%)',
  viralLime: 'linear-gradient(150deg, #7FA000 0%, #C8F000 60%, #E4FF7A 100%)',
  viralMix:  'linear-gradient(150deg, #FF2D7A 0%, #FF6BA5 45%, #C8F000 100%)',
};

export interface Agent {
  slug: string;
  name: string;
  desc: string;
  category: string;
  icon: LucideIcon;
  gradient: string;
  /** true = agente BÔNUS (viralização) — recebe destaque lime/rosa no Estúdio. */
  bonus?: boolean;
  /** Mensagem inicial customizada da IA. Se não tiver, usa a default genérica. */
  openingMessage?: string;
}

/* ── OS AGENTES — a esteira do curso, na ordem ── */
export const AGENTS: Agent[] = [
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
  {
    slug: 'agente-5',
    name: 'Nome Potente',
    desc: 'Cria nomes fortes e vendedores pro seu produto.',
    category: 'nome',
    icon: Tag,
    gradient: GRAD.sunset,
    openingMessage: 'Olá! Eu sou o **Nome Potente** 🏷️\n\nEu crio nomes fortes, claros e memoráveis pro seu produto.',
  },
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
    slug: 'agente-6',
    name: 'Promessa Irresistível',
    desc: 'Escreve promessas SMART pra headline da sua oferta.',
    category: 'promessa',
    icon: Megaphone,
    gradient: GRAD.rose,
    openingMessage: 'Olá! Eu sou a **Promessa Irresistível** 📣\n\nEu crio promessas fortes e específicas pra sua oferta.',
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
    slug: 'agente-10',
    name: 'Anúncio Problema/Solução',
    desc: 'Cria 5 anúncios que expõem a dor e entregam a solução.',
    category: 'anuncioPS',
    icon: Target,
    gradient: GRAD.adBlue,
    openingMessage:
      'Olá! Eu sou o **Anúncio Problema/Solução** 🎯\n\nEu crio **5 anúncios** que expõem a dor da sua cliente e entregam a solução na lata.\n\nPra começar, me conta:\n\n1. Qual é o seu **produto**?\n2. Quem é o **expert** por trás dele?\n3. Qual é o seu **nicho**?',
  },
  {
    slug: 'agente-11',
    name: 'Anúncio Mini-Aula',
    desc: 'Cria 5 anúncios que ensinam um passo e abrem pro próximo nível.',
    category: 'anuncioAula',
    icon: GraduationCap,
    gradient: GRAD.adSky,
    openingMessage:
      'Olá! Eu sou o **Anúncio Mini-Aula** 🎓\n\nEu crio **5 anúncios** que ensinam um passo na prática e abrem a porta pro próximo nível.\n\nPra começar, me conta:\n\n1. Qual é o seu **produto**?\n2. Quem é o **expert** por trás dele?\n3. Qual é o seu **nicho**?',
  },
  {
    slug: 'agente-7',
    name: 'Ganchos Virais',
    desc: 'Gera 20 ganchos de alta retenção pros seus vídeos.',
    category: 'ganchos',
    icon: Anchor,
    gradient: GRAD.viralPink,
    bonus: true,
    openingMessage: 'Olá! Eu sou os **Ganchos Virais** 🪝\n\nEu crio 20 ganchos que fazem a pessoa parar de rolar a tela.',
  },
  {
    slug: 'agente-8',
    name: 'Narrado Técnico',
    desc: 'Roteiros narrados técnicos de até 90s pra viralizar.',
    category: 'narrado',
    icon: Mic,
    gradient: GRAD.viralLime,
    bonus: true,
    openingMessage: 'Olá! Eu sou o **Narrado Técnico** 🎙️\n\nEu crio roteiros técnicos, fortes e fáceis de gravar.',
  },
  {
    slug: 'agente-9',
    name: 'Carrossel Viral',
    desc: 'Monta carrosséis de 10 slides que prendem e convertem.',
    category: 'carrossel',
    icon: GalleryHorizontalEnd,
    gradient: GRAD.viralMix,
    bonus: true,
    openingMessage: 'Olá! Eu sou o **Carrossel Viral** 🎠\n\nEu monto carrosséis estratégicos, slide a slide.',
  },
];

/** Mensagem de abertura default (quando o agente não define openingMessage). */
export const defaultOpening = (name: string) =>
  `Olá! Sou especialista em **${name}**.\n\nPra começar, me conta:\n\n1. Qual é o seu **nicho**?\n2. O que você quer criar hoje?`;
