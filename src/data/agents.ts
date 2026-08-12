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
  Target, GraduationCap, ScanFace,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

/* Especialidades — só id e cor. O rótulo vem do dicionário
   (agentes.categorias.<id>): duplicar o array por idioma é a armadilha nº 1
   do kit. */
export const CATEGORIES = [
  { id: 'estrutura',   color: 'text-[#BE0D3E]', dot: 'bg-[#BE0D3E]' },
  { id: 'roteiro',     color: 'text-[#C77E14]', dot: 'bg-[#F6B43A]' },
  { id: 'apostila',    color: 'text-[#D06A85]', dot: 'bg-[#ECA6BB]' },
  { id: 'pesquisa',    color: 'text-[#94002D]', dot: 'bg-[#94002D]' },
  { id: 'nome',        color: 'text-[#BE0D3E]', dot: 'bg-[#BE0D3E]' },
  { id: 'promessa',    color: 'text-[#D06A85]', dot: 'bg-[#E06B85]' },
  // anúncios (azul) — tráfego pago
  { id: 'anuncioPS',   color: 'text-[#1D4ED8]', dot: 'bg-[#2563EB]' },
  { id: 'anuncioAula', color: 'text-[#0369A1]', dot: 'bg-[#0EA5E9]' },
  // bônus de viralização — lime + rosa choque (id visual "Viral em 1 Minuto")
  { id: 'ganchos',     color: 'text-[#E8226C]', dot: 'bg-[#FF2D7A]' },
  { id: 'narrado',     color: 'text-[#6E8B00]', dot: 'bg-[#C8F000]' },
  { id: 'carrossel',   color: 'text-[#E8226C]', dot: 'bg-[#FF2D7A]' },
  { id: 'perfil',      color: 'text-[#B0004E]', dot: 'bg-[#FF2D7A]' },
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
  viralScan: 'linear-gradient(155deg, #5C0028 0%, #B0004E 38%, #FF2D7A 78%, #C8F000 128%)',
};

/* O agente guarda só o que NÃO é texto: slug, categoria, ícone, gradiente e
   os dois marcadores de comportamento. Nome, descrição e mensagem de abertura
   vivem no dicionário e são resolvidos no render por useAgents(). */
export interface AgentBase {
  /** identificador único. TEM QUE BATER com a linha de `viral_models` no
   *  Supabase (é de lá que o backend lê o PROMPT). ⚠️ NÃO renomeie. */
  slug: string;
  category: string;
  icon: LucideIcon;
  gradient: string;
  /** true = agente BÔNUS (viralização) — recebe destaque lime/rosa no Estúdio. */
  bonus?: boolean;
  /**
   * Agente-FERRAMENTA: em vez do chat, abre uma tela própria.
   * 'analisar-perfil' → <AnalisarPerfilAgent /> (upload de print + visão).
   * Agente com `tool` NÃO usa `viral_models` (o prompt mora na edge function).
   */
  tool?: 'analisar-perfil';
}

/** Agente já com os textos resolvidos no idioma da tela. */
export interface Agent extends AgentBase {
  name: string;
  desc: string;
  openingMessage?: string;
}

/* ── OS AGENTES — a esteira do curso, na ordem ──
   Para adicionar um 6º agente: acrescente o objeto aqui, as chaves
   agentes.<slug>.{nome,desc,abertura} nos DOIS dicionários, e a linha com o
   prompt em `viral_models`. */
export const AGENTS_BASE: AgentBase[] = [
  { slug: 'agente-4',  category: 'pesquisa',    icon: BarChart3,             gradient: GRAD.wine },
  { slug: 'agente-5',  category: 'nome',        icon: Tag,                   gradient: GRAD.sunset },
  { slug: 'agente-1',  category: 'estrutura',   icon: Blocks,                gradient: GRAD.red },
  { slug: 'agente-2',  category: 'roteiro',     icon: Clapperboard,          gradient: GRAD.orange },
  { slug: 'agente-6',  category: 'promessa',    icon: Megaphone,             gradient: GRAD.rose },
  { slug: 'agente-3',  category: 'apostila',    icon: BookOpen,              gradient: GRAD.rose },
  { slug: 'agente-10', category: 'anuncioPS',   icon: Target,                gradient: GRAD.adBlue },
  { slug: 'agente-11', category: 'anuncioAula', icon: GraduationCap,         gradient: GRAD.adSky },
  { slug: 'agente-7',  category: 'ganchos',     icon: Anchor,                gradient: GRAD.viralPink, bonus: true },
  { slug: 'agente-8',  category: 'narrado',     icon: Mic,                   gradient: GRAD.viralLime, bonus: true },
  { slug: 'agente-9',  category: 'carrossel',   icon: GalleryHorizontalEnd,  gradient: GRAD.viralMix,  bonus: true },
  { slug: 'agente-12', category: 'perfil',      icon: ScanFace,              gradient: GRAD.viralScan, bonus: true, tool: 'analisar-perfil' },
];

type TFunc = (k: string, o?: Record<string, unknown>) => string;

/** Mensagem de abertura default (quando o agente não tem uma própria). */
export const defaultOpening = (name: string, t: TFunc) =>
  t('agentes.aberturaDefault', { name });

export const resolveAgents = (t: TFunc): Agent[] =>
  AGENTS_BASE.map((a) => {
    // defaultValue: '' porque agente-ferramenta (agente-12) não tem abertura —
    // sem isso o t() devolveria a própria chave e ela viraria a mensagem.
    const abertura = t(`agentes.${a.slug}.abertura`, { defaultValue: '' });
    return {
      ...a,
      name: t(`agentes.${a.slug}.nome`),
      desc: t(`agentes.${a.slug}.desc`),
      // string vazia no dicionário = agente sem abertura própria
      openingMessage: abertura ? abertura : undefined,
    };
  });

/** Rótulo da especialidade no idioma da tela. */
export const categoryLabel = (id: string | undefined, t: TFunc) =>
  id ? t(`agentes.categorias.${id}`) : '';

/** Os agentes já traduzidos. Use isto nos componentes. */
export const useAgents = (): Agent[] => resolveAgents(useTranslation().t);
