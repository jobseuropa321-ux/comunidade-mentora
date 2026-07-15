// Mock local do feed da Comunidade (sem backend). Persiste no localStorage.
// Quando estruturar o Supabase, troca-se pela versão real (ver docs/backend/):
// tabelas community_posts / community_likes / community_comments + view enriched.

export interface MockProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  instagram: string | null;
}

export interface MockComment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile: MockProfile | null;
}

export interface MockPost {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  profile: MockProfile | null;
  likes_count: number;
  comments_count: number;
  user_has_liked: boolean;
  comments: MockComment[];
}

const KEY = 'dam_community_posts';

// "Outros membros" da comunidade (só pro feed não ficar vazio no mock).
const MEMBERS: MockProfile[] = [
  { user_id: 'm1', full_name: 'Marina Duarte', avatar_url: null, instagram: 'marinaduarte' },
  { user_id: 'm2', full_name: 'Rafa Nogueira', avatar_url: null, instagram: 'rafanog' },
  { user_id: 'm3', full_name: 'Bia Almeida',   avatar_url: null, instagram: null },
];

const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();

function seed(): MockPost[] {
  return [
    {
      id: 'seed-1', user_id: 'm1',
      content: 'Apliquei o gancho da aula de ontem e meu Reels bateu 42k em 6h 🚀 obrigada, equipe!',
      image_url: null, created_at: iso(35), profile: MEMBERS[0],
      likes_count: 12, comments_count: 1, user_has_liked: false,
      comments: [
        { id: 'sc-1', user_id: 'm2', content: 'Boaa! manda o print depois 👀', created_at: iso(20), profile: MEMBERS[1] },
      ],
    },
    {
      id: 'seed-2', user_id: 'm2',
      content: 'Alguém mais tá testando o formato POV essa semana? Tô com dúvida no CTA.',
      image_url: null, created_at: iso(90), profile: MEMBERS[1],
      likes_count: 5, comments_count: 0, user_has_liked: true,
      comments: [],
    },
    {
      id: 'seed-3', user_id: 'm3',
      content: 'Consistência tá sendo tudo pra mim. 14 dias postando sem falhar 🔥',
      image_url: null, created_at: iso(180), profile: MEMBERS[2],
      likes_count: 23, comments_count: 0, user_has_liked: false,
      comments: [],
    },
  ];
}

export function loadPosts(): MockPost[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as MockPost[];
  } catch { /* ignore parse/storage errors */ }
  const s = seed();
  savePosts(s);
  return s;
}

export function savePosts(posts: MockPost[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(posts)); } catch { /* ignore */ }
}

export const genId = (): string => `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
