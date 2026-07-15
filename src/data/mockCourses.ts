/*
  ── Dados de curso LOCAIS (mock) ─────────────────────────────────────
  Substitui as tabelas do Supabase (modules / lessons / lesson_materials).
  A forma dos objetos é a mesma do schema descrito em
  docs/05-MODULO-E-AULA.md, então os hooks em `useCourses.ts` e as telas
  (Home / ModuleDetail / AulaDetail) funcionam sem tocar em nada.

  Para plugar um backend real depois, basta trocar as funções de
  `useCourses.ts` por chamadas à sua API — a interface dos hooks é o
  contrato que importa manter.

  Obs.: os gradientes ficam como strings literais (`from-[#...] to-[#...]`)
  de propósito — assim o Tailwind JIT gera as classes arbitrárias mesmo
  vindo de "dados".
*/

export interface Module {
  id: string;
  slug: string;
  position: number;
  is_published: boolean;
  home_section: 'inicio' | 'modulos';
  title1: string;
  title2: string;
  descricao: string;
  instructor: string;
  duracao: string;
  nivel: string;
  cor_fundo: string;
  cor_acento: string;
  cover_url: string | null;
  tag: string | null;
  tag_color: string | null;
}

export interface Lesson {
  id: string;
  module_id: string;
  position: number;
  titulo: string;
  descricao: string;
  conteudo: string;
  duracao: string;
  video_url: string | null;
}

export interface LessonMaterial {
  id: string;
  lesson_id: string;
  position: number;
  nome: string;
  tipo: 'pdf' | 'planilha' | 'checklist' | 'video';
  tamanho: string;
  url: string;
}

/* ── MÓDULOS ───────────────────────────────────────────────────────── */
export const MODULES: Module[] = [
  {
    id: 'm1',
    slug: 'comece-por-aqui',
    position: 1,
    is_published: true,
    home_section: 'inicio',
    title1: 'COMECE',
    title2: 'POR AQUI',
    descricao:
      'O ponto de partida da Amentora. Configure seu perfil, entenda como a plataforma funciona e dê os primeiros passos para publicar seu primeiro conteúdo ainda hoje.',
    instructor: 'Equipe Amentora',
    duracao: '32 min',
    nivel: 'Iniciante',
    cor_fundo: 'from-[#E06B85] to-[#BE0D3E]',
    cor_acento: '#BE0D3E',
    cover_url: null,
    tag: 'GRÁTIS',
    tag_color: '#1E1B11',
  },
  {
    id: 'm2',
    slug: 'mentalidade-viral',
    position: 2,
    is_published: true,
    home_section: 'inicio',
    title1: 'MENTA',
    title2: 'LIDADE',
    descricao:
      'Antes da técnica vem a cabeça certa. Aqui você quebra os bloqueios que travam a maioria dos criadores e monta uma rotina de produção que se sustenta no longo prazo.',
    instructor: 'Equipe Amentora',
    duracao: '48 min',
    nivel: 'Iniciante',
    cor_fundo: 'from-[#7A0A33] to-[#D81059]',
    cor_acento: '#D11A4C',
    cover_url: null,
    tag: null,
    tag_color: null,
  },
  {
    id: 'm3',
    slug: 'fundamentos',
    position: 3,
    is_published: true,
    home_section: 'modulos',
    title1: 'FUNDA',
    title2: 'MENTOS',
    descricao:
      'Os pilares de todo vídeo que performa: gancho, retenção e chamada para ação. Você vai entender por que os primeiros 3 segundos decidem o alcance do seu conteúdo.',
    instructor: 'Equipe Amentora',
    duracao: '1h 12min',
    nivel: 'Iniciante',
    cor_fundo: 'from-[#C81F5C] to-[#D11A4C]',
    cor_acento: '#BE0D3E',
    cover_url: null,
    tag: 'NOVO',
    tag_color: '#BE0D3E',
  },
  {
    id: 'm4',
    slug: 'roteiros-que-viralizam',
    position: 4,
    is_published: true,
    home_section: 'modulos',
    title1: 'ROTEIROS',
    title2: 'VIRAIS',
    descricao:
      'Modelos prontos de roteiro que já provaram funcionar. Aprenda a adaptar cada estrutura para o seu nicho e nunca mais fique travado na frente da câmera.',
    instructor: 'Equipe Amentora',
    duracao: '1h 05min',
    nivel: 'Intermediário',
    cor_fundo: 'from-[#5C0B30] to-[#9C0F47]',
    cor_acento: '#E06B85',
    cover_url: null,
    tag: null,
    tag_color: null,
  },
  {
    id: 'm5',
    slug: 'edicao-no-celular',
    position: 5,
    is_published: true,
    home_section: 'modulos',
    title1: 'EDIÇÃO',
    title2: 'NO CELULAR',
    descricao:
      'Edite vídeos com aparência profissional usando só o celular. Cortes, legendas, ritmo e trilha — tudo com apps gratuitos e um fluxo que cabe na sua rotina.',
    instructor: 'Equipe Amentora',
    duracao: '58 min',
    nivel: 'Intermediário',
    cor_fundo: 'from-[#BE185D] to-[#EC4899]',
    cor_acento: '#EC4899',
    cover_url: null,
    tag: null,
    tag_color: null,
  },
  {
    id: 'm6',
    slug: 'monetizacao',
    position: 6,
    is_published: true,
    home_section: 'modulos',
    title1: 'MONETI',
    title2: 'ZAÇÃO',
    descricao:
      'Transforme audiência em receita. Publicidade, produtos próprios, afiliados e comunidade paga — os caminhos reais para viver do que você cria.',
    instructor: 'Equipe Amentora',
    duracao: '1h 20min',
    nivel: 'Avançado',
    cor_fundo: 'from-[#A8253A] to-[#FF6B7D]',
    cor_acento: '#FF6B7D',
    cover_url: null,
    tag: 'PRO',
    tag_color: '#1E1B11',
  },
];

/* ── AULAS ─────────────────────────────────────────────────────────── */
export const LESSONS: Lesson[] = [
  // m1 — Comece por aqui
  { id: 'l1-1', module_id: 'm1', position: 1, titulo: 'Boas-vindas à Comunidade', descricao: 'O que você vai encontrar por aqui e como aproveitar cada recurso da plataforma.', conteudo: 'Bem-vindo! Este é o mapa da comunidade: área de membros com os módulos, mentorias ao vivo toda semana, o chat com IA para gerar roteiros, a biblioteca de referências virais e o calendário de alertas de tendência.\n\nComece assistindo às aulas na ordem e marque cada uma como concluída para acompanhar seu progresso.', duracao: '4 min', video_url: null },
  { id: 'l1-2', module_id: 'm1', position: 2, titulo: 'Configurando seu perfil', descricao: 'Deixe seu perfil pronto para se conectar com a comunidade.', conteudo: 'Um perfil completo aumenta suas conexões dentro da comunidade. Adicione seu nome, foto e @ do Instagram na tela de perfil.', duracao: '6 min', video_url: null },
  { id: 'l1-3', module_id: 'm1', position: 3, titulo: 'Como usar as ferramentas', descricao: 'Um tour pelo chat com IA, biblioteca e calendário de alertas.', conteudo: 'Cada ferramenta foi desenhada para tirar uma desculpa da sua frente. Sem ideia? Chat com IA. Sem referência? Biblioteca. Sem saber o que postar hoje? Calendário de alertas.', duracao: '9 min', video_url: null },
  { id: 'l1-4', module_id: 'm1', position: 4, titulo: 'Seu primeiro post em 1 minuto', descricao: 'Do zero ao publicar usando um roteiro pronto.', conteudo: 'Escolha um roteiro pronto no botão de câmera, grave seguindo o teleprompter e publique. É esse o ciclo que você vai repetir todos os dias.', duracao: '13 min', video_url: null },

  // m2 — Mentalidade
  { id: 'l2-1', module_id: 'm2', position: 1, titulo: 'O criador consistente', descricao: 'Por que consistência vence talento no longo prazo.', conteudo: 'Quem posta todo dia por 90 dias aprende mais do que quem estuda por 90 dias sem postar. A câmera é o melhor professor.', duracao: '11 min', video_url: null },
  { id: 'l2-2', module_id: 'm2', position: 2, titulo: 'Vencendo o medo da câmera', descricao: 'Técnicas práticas para gravar sem travar.', conteudo: 'O medo não some — ele diminui com repetição. Grave takes curtos, não busque perfeição no primeiro vídeo e use roteiro para não se perder.', duracao: '14 min', video_url: null },
  { id: 'l2-3', module_id: 'm2', position: 3, titulo: 'Montando sua rotina de produção', descricao: 'Como gravar uma semana de conteúdo em uma tarde.', conteudo: 'Batch recording: separe um bloco de 2 horas, grave 5 a 7 vídeos de uma vez e distribua ao longo da semana. Menos fricção, mais volume.', duracao: '23 min', video_url: null },

  // m3 — Fundamentos
  { id: 'l3-1', module_id: 'm3', position: 1, titulo: 'Os 3 primeiros segundos', descricao: 'O gancho que decide se o vídeo viraliza ou morre.', conteudo: 'Nos 3 primeiros segundos o espectador decide se fica. Comece pelo resultado, por uma pergunta forte ou por uma quebra de expectativa. Nunca comece com "oi gente".', duracao: '15 min', video_url: null },
  { id: 'l3-2', module_id: 'm3', position: 2, titulo: 'Retenção: mantendo até o fim', descricao: 'Ritmo, cortes e loops que seguram a audiência.', conteudo: 'Retenção é a métrica que o algoritmo mais valoriza. Corte pausas, entregue valor em camadas e feche o vídeo com um loop que puxa de volta pro início.', duracao: '18 min', video_url: null },
  { id: 'l3-3', module_id: 'm3', position: 3, titulo: 'CTA sem parecer forçado', descricao: 'Chamadas para ação que a audiência realmente segue.', conteudo: 'A melhor CTA é natural: peça o que faz sentido pro conteúdo. "Salva esse vídeo pra não esquecer" converte mais que "segue o perfil".', duracao: '12 min', video_url: null },
  { id: 'l3-4', module_id: 'm3', position: 4, titulo: 'Analisando o que funcionou', descricao: 'Lendo métricas para repetir o acerto.', conteudo: 'Todo vídeo é um experimento. Olhe retenção, alcance e salvamentos. Encontre o padrão dos seus melhores vídeos e faça mais daquilo.', duracao: '17 min', video_url: null },

  // m4 — Roteiros
  { id: 'l4-1', module_id: 'm4', position: 1, titulo: 'A estrutura "problema → solução"', descricao: 'O roteiro mais versátil que existe.', conteudo: 'Apresente um problema que a audiência tem, agite a dor por 5 segundos e entregue a solução. Simples, testado e funciona em qualquer nicho.', duracao: '13 min', video_url: null },
  { id: 'l4-2', module_id: 'm4', position: 2, titulo: 'Listas e "X coisas que"', descricao: 'Por que formatos de lista performam tão bem.', conteudo: 'Listas prometem valor claro e criam curiosidade ("qual será a número 1?"). Numere na tela e mantenha cada item curto.', duracao: '11 min', video_url: null },
  { id: 'l4-3', module_id: 'm4', position: 3, titulo: 'Storytelling em 60 segundos', descricao: 'Contando uma história completa em um minuto.', conteudo: 'Toda história precisa de tensão. Comece no meio da ação, crie um obstáculo e resolva no fim. Emoção retém mais que informação.', duracao: '19 min', video_url: null },
  { id: 'l4-4', module_id: 'm4', position: 4, titulo: 'Adaptando roteiros para o seu nicho', descricao: 'Pegue um modelo pronto e torne ele seu.', conteudo: 'Um bom roteiro é um esqueleto. Troque os exemplos pelos do seu nicho, ajuste o tom pra sua voz e você tem conteúdo original com estrutura validada.', duracao: '22 min', video_url: null },

  // m5 — Edição
  { id: 'l5-1', module_id: 'm5', position: 1, titulo: 'Configurando o app de edição', descricao: 'Deixe seu app pronto para editar rápido.', conteudo: 'Cortes rápidos e legendas automáticas são o básico. Configure o app uma vez e transforme edição de 1 hora em 10 minutos.', duracao: '10 min', video_url: null },
  { id: 'l5-2', module_id: 'm5', position: 2, titulo: 'Legendas que prendem', descricao: 'Como legendas dinâmicas aumentam a retenção.', conteudo: '85% das pessoas assistem sem som. Legendas grandes, animadas e com palavras-chave destacadas seguram quem está no mudo.', duracao: '16 min', video_url: null },
  { id: 'l5-3', module_id: 'm5', position: 3, titulo: 'Ritmo, trilha e finalização', descricao: 'Os detalhes que dão cara profissional.', conteudo: 'Corte no ritmo da música, use uma trilha em alta e exporte na maior qualidade. Pequenos detalhes separam o amador do profissional.', duracao: '32 min', video_url: null },

  // m6 — Monetização
  { id: 'l6-1', module_id: 'm6', position: 1, titulo: 'Quando começar a monetizar', descricao: 'Você não precisa de milhões de seguidores.', conteudo: 'Audiência engajada vale mais que audiência grande. Com uma base pequena e fiel você já pode vender produto próprio ou fechar publi.', duracao: '14 min', video_url: null },
  { id: 'l6-2', module_id: 'm6', position: 2, titulo: 'Publicidade e parcerias', descricao: 'Como precificar e fechar publis.', conteudo: 'Cobre pelo resultado que você entrega, não pelo número de seguidores. Tenha um mídia kit simples e mostre engajamento real.', duracao: '21 min', video_url: null },
  { id: 'l6-3', module_id: 'm6', position: 3, titulo: 'Produto próprio e afiliados', descricao: 'Criando renda que não depende de marca.', conteudo: 'Produto próprio te dá margem e independência. Comece com algo pequeno (um ebook, um template) e valide antes de escalar.', duracao: '26 min', video_url: null },
  { id: 'l6-4', module_id: 'm6', position: 4, titulo: 'Comunidade paga', descricao: 'Transformando seguidores em membros.', conteudo: 'Uma comunidade paga é receita recorrente e previsível. Entregue acesso, proximidade e transformação — foi assim que a Amentora nasceu.', duracao: '19 min', video_url: null },
];

/* ── MATERIAIS DE APOIO ────────────────────────────────────────────── */
export const MATERIALS: LessonMaterial[] = [
  { id: 'mat-1', lesson_id: 'l1-4', position: 1, nome: 'Checklist do primeiro post', tipo: 'checklist', tamanho: '1 pág', url: '#' },
  { id: 'mat-2', lesson_id: 'l3-1', position: 1, nome: '30 ganchos prontos', tipo: 'pdf', tamanho: '820 KB', url: '#' },
  { id: 'mat-3', lesson_id: 'l3-2', position: 1, nome: 'Planilha de retenção', tipo: 'planilha', tamanho: '2 abas', url: '#' },
  { id: 'mat-4', lesson_id: 'l4-1', position: 1, nome: 'Modelos de roteiro (10x)', tipo: 'pdf', tamanho: '1.4 MB', url: '#' },
  { id: 'mat-5', lesson_id: 'l4-4', position: 1, nome: 'Template de adaptação', tipo: 'planilha', tamanho: '1 aba', url: '#' },
  { id: 'mat-6', lesson_id: 'l5-3', position: 1, nome: 'Presets de edição', tipo: 'video', tamanho: '5 arquivos', url: '#' },
  { id: 'mat-7', lesson_id: 'l6-2', position: 1, nome: 'Mídia kit editável', tipo: 'pdf', tamanho: '640 KB', url: '#' },
];
