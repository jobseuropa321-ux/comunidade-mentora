import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Heart, MessageCircle, Send, Image as ImageIcon, X, Trash2, Loader2, Users, Instagram } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';
import { instagramUrl } from '@/lib/instagram';
import { supabase } from '@/integrations/supabase/client';

/* ─────────────────────────────────────────────
   TEXTOS DA TELA (toda a "escrita" daqui — edite à vontade)
───────────────────────────────────────────── */
const TXT = {
  title: 'Comunidade',
  heading: 'O que rolou por aí?',
  subtitle: 'Compartilhe seus resultados e inspire a galera.',
  placeholder: 'Compartilhe algo com a comunidade...',
  image_btn: 'Imagem',
  image_optimizing: 'Otimizando...',
  publish: 'Publicar',
  empty_title: 'Nenhum post ainda',
  empty_desc: 'Seja a primeira a compartilhar!',
  comment_placeholder: 'Escreva um comentário...',
  fullscreen_alt: 'Imagem em tela cheia',
  delete_post: 'Excluir post',
  delete_comment: 'Excluir comentário',
  remove_image: 'Remover imagem',
  send_comment: 'Enviar comentário',
  user_fallback: 'Usuário',
  toast_post_published: 'Post publicado!',
  toast_post_error: 'Erro ao publicar post',
  toast_comment_deleted: 'Comentário excluído',
  toast_post_deleted: 'Post excluído',
  toast_empty_post: 'Escreva algo ou adicione uma imagem',
  toast_image_too_large: 'Imagem muito grande. Máximo 25MB.',
  toast_load_error: 'Erro ao carregar posts',
  toast_like_error: 'Erro ao curtir',
  toast_comment_error: 'Erro ao comentar',
  toast_comment_delete_error: 'Erro ao excluir comentário',
  toast_post_delete_error: 'Erro ao excluir post',
};

/* Tempo relativo em pt-BR (sem depender de date-fns). */
const timeAgo = (isoStr: string): string => {
  const diff = Math.max(0, Date.now() - new Date(isoStr).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} d`;
  return new Date(isoStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

/* Avatar: foto se houver, senão inicial do nome num círculo vermelho. */
const Avatar: React.FC<{ url?: string | null; name?: string | null; size: number }> = ({ url, name, size }) => {
  if (url) {
    return <img src={url} alt="Avatar" className="object-cover w-full h-full" style={{ width: size, height: size }} />;
  }
  const initial = (name?.trim()?.[0] || 'U').toUpperCase();
  return (
    <div
      className="flex items-center justify-center w-full h-full"
      style={{ width: size, height: size, background: 'linear-gradient(135deg, #E06B85, #BE0D3E 60%, #94002D)' }}
    >
      <span className="font-black text-white leading-none" style={{ fontSize: size * 0.4 }}>{initial}</span>
    </div>
  );
};

// Ícone do Instagram clicável ao lado do nome (para no link, não dispara cliques do card)
const InstagramLink: React.FC<{ handle: string | null | undefined }> = ({ handle }) => {
  const url = instagramUrl(handle);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center justify-center text-[#BE0D3E] hover:scale-110 active:scale-95 transition-transform shrink-0"
      aria-label="Instagram"
    >
      <Instagram className="w-3.5 h-3.5" strokeWidth={2.5} />
    </a>
  );
};

/* ── Burst de coraçõezinhos ao curtir ── */
const HeartBurst: React.FC = () => (
  <span className="absolute inset-0 pointer-events-none" aria-hidden="true">
    {[0, 1, 2, 3, 4, 5].map(i => {
      const angle = (i * 60 + 15) * (Math.PI / 180);
      const dist = 22 + (i % 2) * 7;
      return (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/2"
          initial={{ x: '-50%', y: '-50%', scale: 0.4, opacity: 1 }}
          animate={{
            x: `calc(-50% + ${Math.cos(angle) * dist}px)`,
            y: `calc(-50% + ${Math.sin(angle) * -dist}px)`,
            scale: 1,
            opacity: 0,
          }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
        >
          <Heart size={8 + (i % 3) * 2} className="text-[#E06B85] fill-[#E06B85]" />
        </motion.span>
      );
    })}
  </span>
);

const cardSpring = { type: 'spring', stiffness: 220, damping: 24 } as const;

/* ─────────────────────────────────────────────
   Tipos locais do feed — MESMA shape que a UI consome
   (antes vinha de '@/data/mockCommunity').
───────────────────────────────────────────── */
interface FeedProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  instagram: string | null;
}
interface FeedComment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile: FeedProfile | null;
}
interface FeedPost {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  profile: FeedProfile | null;
  likes_count: number;
  comments_count: number;
  user_has_liked: boolean;
  comments: FeedComment[];
}
/* Linha crua da view community_posts_enriched. */
interface EnrichedRow {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
  instagram: string | null;
  likes_count: number;
  comments_count: number;
}

const Community: React.FC = () => {
  const { user, profile, isExpert } = useAuth();
  const reduce = useReducedMotion() ?? false;
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [compressingImage, setCompressingImage] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [bursts, setBursts] = useState<Record<string, number>>({});
  const location = useLocation();
  const navigate = useNavigate();

  // Depois da 1ª pintura, novos posts entram sem re-escalonar a lista toda
  const mountedRef = useRef(false);
  useEffect(() => { mountedRef.current = true; }, []);

  // Recebe pré-preenchimento (texto + imagem) vindo de outras páginas
  useEffect(() => {
    const compose = (location.state as { compose?: { text?: string; image?: File } } | null)?.compose;
    if (!compose) return;
    if (compose.text) setNewPostContent(compose.text);
    if (compose.image) {
      setSelectedImage(compose.image);
      setImagePreview(URL.createObjectURL(compose.image));
    }
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carrega o feed do Supabase (view enriquecida) + curtidas do usuário + comentários.
  const fetchFeed = async () => {
    if (!user) return;
    try {
      const [postsRes, likesRes] = await Promise.all([
        supabase
          .from('community_posts_enriched')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('community_likes')
          .select('post_id')
          .eq('user_id', user.id),
      ]);
      if (postsRes.error) throw postsRes.error;
      const rows = (postsRes.data ?? []) as EnrichedRow[];
      const likedSet = new Set((likesRes.data ?? []).map((l: { post_id: string }) => l.post_id));

      // Comentários de todos os posts do feed, com o perfil (nome/avatar/@) do autor.
      const postIds = rows.map((r) => r.id);
      const commentsByPost: Record<string, FeedComment[]> = {};
      if (postIds.length) {
        const { data: commentRows } = await supabase
          .from('community_comments')
          .select('id, post_id, user_id, content, created_at')
          .in('post_id', postIds)
          .order('created_at', { ascending: true });
        const cRows = (commentRows ?? []) as Array<{
          id: string; post_id: string; user_id: string; content: string; created_at: string;
        }>;
        const authorIds = [...new Set(cRows.map((c) => c.user_id))];
        const profMap: Record<string, FeedProfile> = {};
        if (authorIds.length) {
          const { data: profRows } = await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url, instagram')
            .in('user_id', authorIds);
          (profRows ?? []).forEach((p: FeedProfile) => { profMap[p.user_id] = p; });
        }
        cRows.forEach((c) => {
          if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
          commentsByPost[c.post_id].push({
            id: c.id,
            user_id: c.user_id,
            content: c.content,
            created_at: c.created_at,
            profile: profMap[c.user_id] ?? null,
          });
        });
      }

      setPosts(rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        content: r.content,
        image_url: r.image_url,
        created_at: r.created_at,
        profile: { user_id: r.user_id, full_name: r.full_name, avatar_url: r.avatar_url, instagram: r.instagram },
        likes_count: Number(r.likes_count) || 0,
        comments_count: Number(r.comments_count) || 0,
        user_has_liked: likedSet.has(r.id),
        comments: commentsByPost[r.id] ?? [],
      })));
    } catch (error) {
      console.error(error);
      toast.error(TXT.toast_load_error);
    }
  };

  // Carga inicial + realtime: novos posts / posts apagados atualizam o feed pra todos.
  useEffect(() => {
    if (!user) return;
    fetchFeed();
    const channel = supabase
      .channel(`community-posts-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' }, () => { fetchFeed(); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'community_posts' }, () => { fetchFeed(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const myProfile = () => ({
    user_id: user?.id || 'me',
    full_name: profile?.full_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    instagram: profile?.instagram ?? null,
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error(TXT.toast_image_too_large);
      e.target.value = '';
      return;
    }
    setCompressingImage(true);
    try {
      const compressed = await compressImage(file);
      setSelectedImage(compressed);
      setImagePreview(URL.createObjectURL(compressed));
    } finally {
      setCompressingImage(false);
      e.target.value = '';
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (imagePreview) { URL.revokeObjectURL(imagePreview); setImagePreview(null); }
  };

  const handleCreatePost = async () => {
    if (!user || (!newPostContent.trim() && !selectedImage)) { toast.error(TXT.toast_empty_post); return; }
    setPosting(true);
    try {
      let imageUrl: string | null = null;
      if (selectedImage) {
        const ext = (selectedImage.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('community-images').upload(path, selectedImage);
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from('community-images').getPublicUrl(path).data.publicUrl;
      }
      const { data: inserted, error } = await supabase
        .from('community_posts')
        .insert({ user_id: user.id, content: newPostContent.trim(), image_url: imageUrl })
        .select('id, user_id, content, image_url, created_at')
        .single();
      if (error) throw error;
      const post: FeedPost = {
        id: inserted.id,
        user_id: inserted.user_id,
        content: inserted.content,
        image_url: inserted.image_url,
        created_at: inserted.created_at,
        profile: myProfile(),
        likes_count: 0,
        comments_count: 0,
        user_has_liked: false,
        comments: [],
      };
      // Insert otimista (dedup por id caso o realtime traga o mesmo post depois).
      setPosts(prev => prev.find(p => p.id === post.id) ? prev : [post, ...prev]);
      setNewPostContent(''); removeImage();
      toast.success(TXT.toast_post_published);
    } catch (error) {
      console.error(error);
      toast.error(TXT.toast_post_error);
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId: string, hasLiked: boolean) => {
    if (!user) return;
    if (!hasLiked) setBursts(prev => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
    // Atualização otimista da contagem + flag.
    setPosts(prev => prev.map(post => post.id === postId
      ? { ...post, user_has_liked: !hasLiked, likes_count: hasLiked ? post.likes_count - 1 : post.likes_count + 1 }
      : post
    ));
    try {
      const { error } = hasLiked
        ? await supabase.from('community_likes').delete().eq('post_id', postId).eq('user_id', user.id)
        : await supabase.from('community_likes').insert({ post_id: postId, user_id: user.id });
      if (error) throw error;
    } catch (error) {
      console.error(error);
      // Reverte em caso de falha.
      setPosts(prev => prev.map(post => post.id === postId
        ? { ...post, user_has_liked: hasLiked, likes_count: hasLiked ? post.likes_count + 1 : post.likes_count - 1 }
        : post
      ));
      toast.error(TXT.toast_like_error);
    }
  };

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId); else next.add(postId);
      return next;
    });
  };

  const handleComment = async (postId: string) => {
    const content = newComments[postId]?.trim();
    if (!user || !content) return;
    setNewComments(prev => ({ ...prev, [postId]: '' }));
    try {
      const { data: inserted, error } = await supabase
        .from('community_comments')
        .insert({ post_id: postId, user_id: user.id, content })
        .select('id, user_id, content, created_at')
        .single();
      if (error) throw error;
      const comment: FeedComment = {
        id: inserted.id,
        user_id: inserted.user_id,
        content: inserted.content,
        created_at: inserted.created_at,
        profile: myProfile(),
      };
      setPosts(prev => prev.map(post => post.id === postId
        ? { ...post, comments: [...post.comments, comment], comments_count: post.comments_count + 1 }
        : post
      ));
    } catch (error) {
      console.error(error);
      setNewComments(prev => ({ ...prev, [postId]: content }));
      toast.error(TXT.toast_comment_error);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!user) return;
    // Remoção otimista.
    setPosts(prev => prev.map(post => post.id === postId
      ? { ...post, comments: post.comments.filter(c => c.id !== commentId), comments_count: Math.max(0, post.comments_count - 1) }
      : post
    ));
    try {
      const { error } = await supabase.from('community_comments').delete().eq('id', commentId);
      if (error) throw error;
      toast.success(TXT.toast_comment_deleted);
    } catch (error) {
      console.error(error);
      toast.error(TXT.toast_comment_delete_error);
      fetchFeed(); // ressincroniza se o RLS bloqueou.
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;
    // Remoção otimista (o realtime confirma depois, idempotente).
    setPosts(prev => prev.filter(p => p.id !== postId));
    try {
      const query = supabase.from('community_posts').delete().eq('id', postId);
      const { error } = isExpert ? await query : await query.eq('user_id', user.id);
      if (error) throw error;
      toast.success(TXT.toast_post_deleted);
    } catch (error) {
      console.error(error);
      toast.error(TXT.toast_post_delete_error);
      fetchFeed(); // ressincroniza se o RLS bloqueou.
    }
  };

  return (
    <div className="px-4 pt-3 pb-24 max-w-lg mx-auto">
      {/* ═══ Header — pegada do Estúdio: eyebrow + serif gradiente + SVG animado ═══ */}
      <div className="relative mb-5 pr-[92px]">
        {/* Constelação da comunidade — pontos conectados que se desenham e respiram */}
        <svg
          viewBox="0 0 90 78"
          className="absolute -right-1 top-0 w-[84px] h-[72px]"
          fill="none"
          aria-hidden="true"
        >
          {/* linhas da rede (se desenham na entrada) */}
          {[
            'M14 58 L38 30',
            'M38 30 L70 44',
            'M70 44 L52 66',
            'M14 58 L52 66',
            'M38 30 L58 12',
          ].map((d, i) => (
            <motion.path
              key={d}
              d={d}
              stroke="#BE0D3E"
              strokeOpacity="0.28"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeDasharray="1 0"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, delay: 0.35 + i * 0.12, ease: 'easeOut' }}
            />
          ))}
          {/* nós = pessoinhas (cabeça + ombros) conectadas — pulsam suave, em compasso */}
          {[
            { cx: 14, cy: 58, s: 6.5, fill: '#BE0D3E', d: 0 },
            { cx: 38, cy: 30, s: 8, fill: '#E06B85', d: 0.5 },
            { cx: 70, cy: 44, s: 6, fill: '#F6B43A', d: 1 },
            { cx: 52, cy: 66, s: 5.2, fill: '#ECA6BB', d: 1.5 },
            { cx: 58, cy: 12, s: 4.8, fill: '#94002D', d: 2 },
          ].map(n => (
            <motion.g
              key={`${n.cx}-${n.cy}`}
              initial={reduce ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.4 + n.d * 0.18 }}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            >
              {/* flutuação lenta e contínua (sem piscar) */}
              <motion.g
                animate={reduce ? undefined : { y: [0, -2.4, 0] }}
                transition={{ duration: 4.2 + n.d * 0.6, repeat: Infinity, ease: 'easeInOut', delay: n.d * 0.5 }}
              >
                {/* halo pra pessoinha "assentar" sobre as linhas */}
                <circle cx={n.cx} cy={n.cy} r={n.s * 1.05} fill="#FFF7E6" opacity="0.9" />
                {/* cabeça */}
                <circle cx={n.cx} cy={n.cy - n.s * 0.42} r={n.s * 0.4} fill={n.fill} />
                {/* ombros */}
                <path
                  d={`M ${n.cx - n.s * 0.72} ${n.cy + n.s * 0.72} a ${n.s * 0.72} ${n.s * 0.72} 0 0 1 ${n.s * 1.44} 0 Z`}
                  fill={n.fill}
                />
              </motion.g>
            </motion.g>
          ))}
          {/* anel de destaque no nó central */}
          <motion.circle
            cx="38" cy="30" r="9"
            stroke="#E06B85" strokeWidth="1.2" strokeOpacity="0.45"
            initial={reduce ? false : { scale: 0.4, opacity: 0 }}
            animate={reduce ? { scale: 1, opacity: 1 } : { scale: [0.6, 1.25], opacity: [0.6, 0] }}
            transition={reduce ? undefined : { duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: 1 }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        </svg>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-[#5B4041]/70 mb-1.5"
        >
          <Users size={11} className="text-[#BE0D3E]" /> {TXT.title}
        </motion.p>
        <motion.h2
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.06 }}
          className="text-[27px] leading-[1.02] font-black mb-1 text-transparent bg-clip-text bg-gradient-to-r from-[#BE0D3E] to-[#E06B85] tracking-tight"
        >
          {TXT.heading}
        </motion.h2>
        {/* traço caligráfico que se desenha sozinho */}
        <svg viewBox="0 0 150 10" className="w-[150px] h-[10px] mb-2" fill="none" aria-hidden="true">
          <motion.path
            d="M2 7 Q 38 1.5 74 5 Q 112 8.5 148 3.5"
            stroke="#E06B85"
            strokeWidth="2.4"
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <motion.p
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ duration: 0.5, delay: 0.16 }}
          className="text-[#5B4041] text-[11px] leading-snug"
        >
          {TXT.subtitle}
        </motion.p>
      </div>

      {/* ═══ Criar post ═══ */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...cardSpring, delay: 0.12 }}
        className="card-glass-liquid rounded-2xl p-4 mb-5"
      >
        <div className="flex gap-3">
          <div className="w-11 h-11 shrink-0 rounded-full ring-2 ring-white/70 shadow-[0_4px_12px_rgba(190,13,62,0.2)] overflow-hidden">
            <Avatar url={profile?.avatar_url} name={profile?.full_name} size={44} />
          </div>
          <div className="flex-1 space-y-3">
            <textarea
              placeholder={TXT.placeholder}
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              className="w-full min-h-[80px] resize-none bg-white/70 backdrop-blur border border-[#BE0D3E]/15 text-[#1E1B11] placeholder:text-[#5B4041]/50 rounded-xl focus:border-[#BE0D3E]/50 focus:outline-none focus:shadow-[0_0_0_3px_rgba(190,13,62,0.08)] text-[13px] p-3 transition-shadow"
            />

            <AnimatePresence>
              {imagePreview && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.18 }}
                  className="relative inline-block"
                >
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-40 rounded-xl object-cover border border-white/60 shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                  />
                  <button
                    className="absolute -top-2 -right-2 w-7 h-7 bg-[#1E1B11] rounded-full flex items-center justify-center shadow-[0_4px_10px_rgba(0,0,0,0.3)] hover:scale-110 transition-transform"
                    onClick={removeImage}
                    aria-label={TXT.remove_image}
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between">
              <label className={`cursor-pointer ${compressingImage ? 'pointer-events-none opacity-60' : ''}`}>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} disabled={compressingImage} />
                <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur px-3 py-2 rounded-xl border border-[#BE0D3E]/15 hover:bg-white/90 transition-colors">
                  {compressingImage ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#BE0D3E] animate-spin" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-[#1E1B11]" />
                  )}
                  <span className="text-[11px] font-bold text-[#1E1B11]">{compressingImage ? TXT.image_optimizing : TXT.image_btn}</span>
                </div>
              </label>

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                onClick={handleCreatePost}
                disabled={posting || (!newPostContent.trim() && !selectedImage)}
                className="flex items-center gap-1.5 bg-gradient-to-r from-[#BE0D3E] to-[#E06B85] text-white text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-[0_6px_18px_rgba(190,13,62,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {TXT.publish}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ Feed ═══ */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...cardSpring, delay: 0.2 }}
            className="card-glass-liquid rounded-2xl p-8 text-center"
          >
            <motion.div
              className="text-3xl mb-2"
              animate={reduce ? undefined : { y: [0, -6, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              💬
            </motion.div>
            <p className="text-[14px] font-bold text-[#1E1B11]">{TXT.empty_title}</p>
            <p className="text-[12px] text-[#5B4041] mt-1">{TXT.empty_desc}</p>
          </motion.div>
        ) : (
          <AnimatePresence initial={!reduce}>
            {posts.map((post, i) => {
              const postProfile = post.profile;
              return (
                <motion.div
                  key={post.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: mountedRef.current ? -16 : 26, scale: mountedRef.current ? 0.98 : 1 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
                  transition={{ ...cardSpring, delay: mountedRef.current ? 0 : 0.2 + Math.min(i, 5) * 0.08 }}
                  className="card-glass-liquid rounded-2xl overflow-hidden"
                >
                  <div className="p-4 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 shrink-0 rounded-full ring-2 ring-white/70 shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
                        <Avatar url={postProfile?.avatar_url} name={postProfile?.full_name} size={40} />
                      </div>
                      <div>
                        <p className="font-bold text-[13px] text-[#1E1B11] leading-tight flex items-center gap-1.5">
                          <span className="truncate">{postProfile?.full_name || TXT.user_fallback}</span>
                          <InstagramLink handle={postProfile?.instagram} />
                        </p>
                        <p className="text-[10px] text-[#5B4041]/70 mt-0.5">
                          {timeAgo(post.created_at)}
                        </p>
                      </div>
                    </div>
                    {(post.user_id === user?.id || isExpert) && (
                      <button
                        className="p-2 text-[#5B4041]/50 hover:text-red-500 hover:bg-red-50/60 rounded-lg transition-colors"
                        onClick={() => handleDeletePost(post.id)}
                        aria-label={TXT.delete_post}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {post.content && (
                    <div className="px-4 pb-3">
                      <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[13px] text-[#1E1B11]/90 leading-relaxed">{post.content}</p>
                    </div>
                  )}

                  {post.image_url && (
                    <div className="w-full px-4 pb-3">
                      <motion.img
                        whileHover={{ scale: 1.01 }}
                        src={post.image_url}
                        alt="Post"
                        className="w-full object-cover max-h-[400px] cursor-pointer rounded-xl border border-white/60 shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                        onClick={() => setFullscreenImage(post.image_url)}
                      />
                    </div>
                  )}

                  <div className="px-4 py-3 flex items-center gap-2 border-t border-white/40">
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={() => handleLike(post.id, post.user_has_liked)}
                      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                        post.user_has_liked
                          ? 'bg-gradient-to-r from-[#BE0D3E] to-[#E06B85] text-white shadow-[0_4px_12px_rgba(190,13,62,0.35)]'
                          : 'bg-white/70 backdrop-blur text-[#1E1B11] border border-[#BE0D3E]/15 hover:bg-white'
                      }`}
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <motion.span
                        key={`${post.id}-${post.user_has_liked}`}
                        initial={reduce ? false : { scale: post.user_has_liked ? 0.4 : 1 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                        className="inline-flex"
                      >
                        <Heart className={`w-3.5 h-3.5 ${post.user_has_liked ? 'fill-white' : ''}`} />
                      </motion.span>
                      <span>{post.likes_count}</span>
                      {!reduce && bursts[post.id] && <HeartBurst key={bursts[post.id]} />}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-1.5 bg-white/70 backdrop-blur text-[#1E1B11] border border-[#BE0D3E]/15 px-3 py-1.5 rounded-xl text-[11px] font-bold hover:bg-white transition-colors"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{post.comments_count}</span>
                    </motion.button>
                  </div>

                  <AnimatePresence initial={false}>
                    {expandedComments.has(post.id) && (
                      <motion.div
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={reduce ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden border-t border-white/40 bg-white/40"
                      >
                        <div className="px-4 pb-4 pt-3 space-y-3">
                          {post.comments.map((comment) => {
                            const commentProfile = comment.profile;
                            const canDelete = comment.user_id === user?.id || isExpert;
                            return (
                              <motion.div
                                key={comment.id}
                                initial={reduce ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.22 }}
                                className="flex gap-2.5"
                              >
                                <div className="w-8 h-8 shrink-0 rounded-full ring-1 ring-white/70 overflow-hidden">
                                  <Avatar url={commentProfile?.avatar_url} name={commentProfile?.full_name} size={32} />
                                </div>
                                <div className="flex-1 bg-white/80 backdrop-blur rounded-xl p-2.5 border border-white/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-[11px] text-[#1E1B11]">{commentProfile?.full_name || TXT.user_fallback}</span>
                                      <InstagramLink handle={commentProfile?.instagram} />
                                      <span className="text-[9px] text-[#5B4041]/60">
                                        {timeAgo(comment.created_at)}
                                      </span>
                                    </div>
                                    {canDelete && (
                                      <button
                                        className="text-[#5B4041]/40 hover:text-red-500 transition-colors shrink-0"
                                        onClick={() => handleDeleteComment(post.id, comment.id)}
                                        aria-label={TXT.delete_comment}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-[12px] text-[#1E1B11]/90 leading-relaxed">{comment.content}</p>
                                </div>
                              </motion.div>
                            );
                          })}

                          <div className="flex gap-2 pt-1">
                            <div className="w-8 h-8 shrink-0 rounded-full ring-1 ring-white/70 overflow-hidden">
                              <Avatar url={profile?.avatar_url} name={profile?.full_name} size={32} />
                            </div>
                            <div className="flex-1 flex gap-2">
                              <input
                                type="text"
                                placeholder={TXT.comment_placeholder}
                                value={newComments[post.id] || ''}
                                onChange={(e) => setNewComments(prev => ({ ...prev, [post.id]: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(post.id); } }}
                                className="flex-1 h-9 text-[12px] bg-white/80 backdrop-blur border border-[#BE0D3E]/15 text-[#1E1B11] placeholder:text-[#5B4041]/50 rounded-xl focus:border-[#BE0D3E]/50 focus:outline-none px-3"
                              />
                              <motion.button
                                whileTap={{ scale: 0.88 }}
                                onClick={() => handleComment(post.id)}
                                disabled={!newComments[post.id]?.trim()}
                                className="w-9 h-9 bg-gradient-to-r from-[#BE0D3E] to-[#E06B85] rounded-xl flex items-center justify-center shadow-[0_4px_12px_rgba(190,13,62,0.35)] disabled:opacity-40"
                                aria-label={TXT.send_comment}
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                              >
                                <Send className="w-3.5 h-3.5 text-white" />
                              </motion.button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* ═══ Imagem em tela cheia ═══ */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setFullscreenImage(null)}
          >
            <motion.img
              initial={reduce ? false : { scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduce ? undefined : { scale: 0.94, opacity: 0 }}
              transition={cardSpring}
              src={fullscreenImage}
              alt={TXT.fullscreen_alt}
              className="max-w-[95vw] max-h-[90vh] object-contain rounded-2xl border border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Community;
