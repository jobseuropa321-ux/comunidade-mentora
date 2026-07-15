import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Heart, MessageCircle, Send, Image as ImageIcon, X, Trash2, Loader2, Users, ChevronDown, Instagram } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { compressImage } from '@/lib/imageCompression';
import { instagramUrl } from '@/lib/instagram';

/* ─────────────────────────────────────────────────────────────
 *  TEXTOS DA TELA (toda a "escrita" daqui — edite à vontade)
 * ───────────────────────────────────────────────────────────── */
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
  load_more: 'Carregar mais',
  comment_placeholder: 'Escreva um comentário...',
  fullscreen_alt: 'Imagem em tela cheia',
  delete_post: 'Excluir post',
  delete_comment: 'Excluir comentário',
  remove_image: 'Remover imagem',
  send_comment: 'Enviar comentário',
  user_fallback: 'Usuário',
  toast_post_published: 'Post publicado!',
  toast_post_error: 'Erro ao publicar post',
  toast_load_error: 'Erro ao carregar posts',
  toast_comment_error: 'Erro ao comentar',
  toast_comment_deleted: 'Comentário excluído',
  toast_comment_delete_error: 'Erro ao excluir comentário',
  toast_post_deleted: 'Post excluído',
  toast_post_delete_error: 'Erro ao excluir post',
  toast_empty_post: 'Escreva algo ou adicione uma imagem',
  toast_image_too_large: 'Imagem muito grande. Máximo 25MB.',
};

/* Avatar próprio (sem sistema de "pet"): foto se houver, senão inicial do nome. */
const Avatar: React.FC<{ url?: string | null; name?: string | null; size: number }> = ({ url, name, size }) => {
  if (url) {
    return <img src={url} alt="Avatar" className="object-cover w-full h-full" style={{ width: size, height: size }} />;
  }
  const initial = (name?.trim()?.[0] || 'U').toUpperCase();
  return (
    <div
      className="flex items-center justify-center w-full h-full"
      style={{ width: size, height: size, background: 'linear-gradient(135deg, #FF7AAF, #FF2D7A 60%, #E8226C)' }}
    >
      <span className="font-black text-white leading-none" style={{ fontSize: size * 0.4 }}>{initial}</span>
    </div>
  );
};

interface UserProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  instagram?: string | null;
}

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
      className="inline-flex items-center justify-center text-[#FF2D7A] hover:scale-110 active:scale-95 transition-transform shrink-0"
      aria-label="Instagram"
    >
      <Instagram className="w-3.5 h-3.5" strokeWidth={2.5} />
    </a>
  );
};

interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  profile: UserProfile | null;
  likes_count: number;
  comments_count: number;
  user_has_liked: boolean;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile: UserProfile | null;
}

const PAGE_SIZE = 20;

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
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Recebe pré-preenchimento (texto + imagem) vindo de outras páginas
  useEffect(() => {
    const compose = (location.state as { compose?: { text?: string; image?: File } } | null)?.compose;
    if (!compose) return;
    if (compose.text) setNewPostContent(compose.text);
    if (compose.image) {
      setSelectedImage(compose.image);
      setImagePreview(URL.createObjectURL(compose.image));
    }
    // Limpa o state pra não re-disparar em próximos renders / refresh
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [posting, setPosting] = useState(false);
  const [compressingImage, setCompressingImage] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchInitial();
    const channel = supabase
      .channel('community-posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' }, async (payload) => {
        const newId = (payload.new as { id: string }).id;
        const { data } = await supabase
          .from('community_posts_enriched')
          .select('*')
          .eq('id', newId)
          .maybeSingle();
        if (!data) return;
        setPosts(prev => prev.find(p => p.id === data.id) ? prev : [enrichRow(data, false), ...prev]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'community_posts' }, (payload) => {
        const oldId = (payload.old as { id: string }).id;
        setPosts(prev => prev.filter(p => p.id !== oldId));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Scroll até o post quando vem de uma notificação (?post=id)
  useEffect(() => {
    if (loading || posts.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const targetPostId = params.get('post');
    if (!targetPostId) return;
    // Limpa o param da URL sem recarregar
    window.history.replaceState({}, '', window.location.pathname);
    setHighlightedPostId(targetPostId);
    setTimeout(() => {
      const el = document.getElementById(`post-${targetPostId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightedPostId(null), 2000);
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, posts.length]);

  const enrichRow = (row: EnrichedRow, userHasLiked: boolean): Post => ({
    id: row.id,
    user_id: row.user_id,
    content: row.content,
    image_url: row.image_url,
    created_at: row.created_at,
    profile: { user_id: row.user_id, full_name: row.full_name, avatar_url: row.avatar_url, instagram: row.instagram },
    likes_count: row.likes_count,
    comments_count: row.comments_count,
    user_has_liked: userHasLiked,
  });

  const fetchInitial = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [postsResult, likesResult] = await Promise.all([
        supabase
          .from('community_posts_enriched')
          .select('*')
          .order('created_at', { ascending: false })
          .range(0, PAGE_SIZE - 1),
        supabase
          .from('community_likes')
          .select('post_id')
          .eq('user_id', user.id),
      ]);
      if (postsResult.error) throw postsResult.error;
      const userLikedSet = new Set(likesResult.data?.map(l => l.post_id) || []);
      const rows = (postsResult.data || []) as EnrichedRow[];
      setPosts(rows.map(r => enrichRow(r, userLikedSet.has(r.id))));
      setHasMore(rows.length === PAGE_SIZE);
      setPage(1);
    } catch (error) {
      console.error(error);
      toast.error(TXT.toast_load_error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!user || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('community_posts_enriched')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      const rows = (data || []) as EnrichedRow[];
      const ids = rows.map(r => r.id);
      const { data: userLikes } = ids.length
        ? await supabase.from('community_likes').select('post_id').eq('user_id', user.id).in('post_id', ids)
        : { data: [] };
      const userLikedSet = new Set(userLikes?.map(l => l.post_id) || []);
      setPosts(prev => [...prev, ...rows.map(r => enrichRow(r, userLikedSet.has(r.id)))]);
      setHasMore(rows.length === PAGE_SIZE);
      setPage(prev => prev + 1);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Limite generoso só pra rejeitar arquivos absurdos (raw 50MP etc).
    // Após compressão a imagem fica em ~200-500KB.
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
      let imageUrl = null;
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('community-images').upload(fileName, selectedImage);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('community-images').getPublicUrl(fileName);
        imageUrl = publicUrl;
      }
      const { data: inserted, error } = await supabase
        .from('community_posts')
        .insert({ user_id: user.id, content: newPostContent.trim(), image_url: imageUrl })
        .select('id, user_id, content, image_url, created_at')
        .single();
      if (error) throw error;
      // Optimistic insert: aparece na hora pra quem publicou. Realtime dedup por id se chegar depois.
      if (inserted) {
        setPosts(prev => prev.find(p => p.id === inserted.id) ? prev : [
          enrichRow({
            id: inserted.id,
            user_id: inserted.user_id,
            content: inserted.content,
            image_url: inserted.image_url,
            created_at: inserted.created_at,
            full_name: profile?.full_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
            instagram: profile?.instagram ?? null,
            likes_count: 0,
            comments_count: 0,
          }, false),
          ...prev,
        ]);
      }
      setNewPostContent(''); removeImage(); toast.success(TXT.toast_post_published);
    } catch (error) { console.error(error); toast.error(TXT.toast_post_error); }
    finally { setPosting(false); }
  };

  const handleLike = async (postId: string, hasLiked: boolean) => {
    if (!user) return;
    try {
      if (hasLiked) {
        await supabase.from('community_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      } else {
        await supabase.from('community_likes').insert({ post_id: postId, user_id: user.id });
        notifyCommunity(postId, 'like');
      }
      setPosts(prev => prev.map(post => post.id === postId
        ? { ...post, user_has_liked: !hasLiked, likes_count: hasLiked ? post.likes_count - 1 : post.likes_count + 1 }
        : post
      ));
    } catch (error) { console.error(error); }
  };

  const toggleComments = async (postId: string) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(postId)) { newExpanded.delete(postId); }
    else { newExpanded.add(postId); if (!comments[postId]) await fetchComments(postId); }
    setExpandedComments(newExpanded);
  };

  const fetchComments = async (postId: string) => {
    setLoadingComments(prev => new Set(prev).add(postId));
    try {
      const { data, error } = await supabase.from('community_comments').select('id, user_id, content, created_at').eq('post_id', postId).order('created_at', { ascending: true });
      if (error) throw error;
      const userIds = [...new Set(data?.map(c => c.user_id) || [])];
      const missingUserIds = userIds.filter(id => !profiles[id]);
      let updatedProfiles = profiles;
      if (missingUserIds.length > 0) {
        const { data: newProfiles } = await supabase.from('profiles').select('user_id, full_name, avatar_url, instagram').in('user_id', missingUserIds);
        if (newProfiles) { updatedProfiles = { ...profiles }; newProfiles.forEach(p => { updatedProfiles[p.user_id] = p; }); setProfiles(updatedProfiles); }
      }
      setComments(prev => ({ ...prev, [postId]: (data || []).map(c => ({ ...c, profile: updatedProfiles[c.user_id] || null })) }));
    } catch (error) { console.error(error); }
    finally { setLoadingComments(prev => { const s = new Set(prev); s.delete(postId); return s; }); }
  };

  const handleComment = async (postId: string) => {
    const content = newComments[postId]?.trim();
    if (!user || !content) return;
    try {
      const { error } = await supabase.from('community_comments').insert({ post_id: postId, user_id: user.id, content });
      if (error) throw error;
      setNewComments(prev => ({ ...prev, [postId]: '' }));
      await fetchComments(postId);
      setPosts(prev => prev.map(post => post.id === postId ? { ...post, comments_count: post.comments_count + 1 } : post));
      notifyCommunity(postId, 'comment');
    } catch (error) { console.error(error); toast.error(TXT.toast_comment_error); }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('community_comments').delete().eq('id', commentId);
      if (error) throw error;
      toast.success(TXT.toast_comment_deleted); await fetchComments(postId);
      setPosts(prev => prev.map(post => post.id === postId ? { ...post, comments_count: post.comments_count - 1 } : post));
    } catch (error) { console.error(error); toast.error(TXT.toast_comment_delete_error); }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;
    try {
      const baseQuery = supabase.from('community_posts').delete().eq('id', postId);
      const { error } = isExpert ? await baseQuery : await baseQuery.eq('user_id', user.id);
      if (error) throw error;
      // Optimistic remove: some na hora. Realtime confirma depois (idempotente).
      setPosts(prev => prev.filter(p => p.id !== postId));
      toast.success(TXT.toast_post_deleted);
    } catch (error) { console.error(error); toast.error(TXT.toast_post_delete_error); }
  };

  // Notificação/push opcional — precisa da edge function `notify-community-interaction`.
  // Se seu app não tem push, isto silenciosamente não faz nada (o .catch engole o erro).
  const notifyCommunity = (postId: string, type: 'comment' | 'like') => {
    supabase.functions.invoke('notify-community-interaction', { body: { post_id: postId, type } }).catch(() => {});
  };

  const getPostProfile = (post: Post) => profiles[post.user_id] || post.profile;
  const getCommentProfile = (comment: Comment) => profiles[comment.user_id] || comment.profile;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 text-[#FF2D7A] animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-24 space-y-5 max-w-lg mx-auto">
      {/* Header — glass lime */}
      <div className="card-glass-liquid-lime rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Users size={14} className="text-[#1A1A1A]" />
          <span className="text-[9px] font-black uppercase tracking-widest text-[#1A1A1A]">{TXT.title}</span>
        </div>
        <h1 className="text-[20px] font-black text-[#1A1A1A] leading-tight">{TXT.heading}</h1>
        <p className="text-[12px] text-[#1A1A1A]/70 font-medium mt-1 leading-snug">
          {TXT.subtitle}
        </p>
      </div>

      {/* Create Post — sempre expandido */}
      <div className="card-glass-liquid rounded-2xl p-4">
        <div className="flex gap-3">
          <div className="w-11 h-11 shrink-0 rounded-full ring-2 ring-white/70 shadow-[0_4px_12px_rgba(255,45,122,0.2)] overflow-hidden">
            <Avatar url={profile?.avatar_url} name={profile?.full_name} size={44} />
          </div>
          <div className="flex-1 space-y-3">
            <Textarea
              placeholder={TXT.placeholder}
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              className="min-h-[80px] resize-none bg-white/70 backdrop-blur border-[#FF2D7A]/15 text-[#1A1A1A] placeholder:text-[#6E6E6E]/50 rounded-xl focus:border-[#FF2D7A]/50 text-[13px] p-3"
            />

            {imagePreview && (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-40 rounded-xl object-cover border border-white/60 shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                />
                <button
                  className="absolute -top-2 -right-2 w-7 h-7 bg-[#1A1A1A] rounded-full flex items-center justify-center shadow-[0_4px_10px_rgba(0,0,0,0.3)] hover:scale-110 transition-transform"
                  onClick={removeImage}
                  aria-label={TXT.remove_image}
                >
                  <X className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className={`cursor-pointer ${compressingImage ? 'pointer-events-none opacity-60' : ''}`}>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} disabled={compressingImage} />
                <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur px-3 py-2 rounded-xl border border-[#FF2D7A]/15 hover:bg-white/90 transition-colors">
                  {compressingImage ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#FF2D7A] animate-spin" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-[#1A1A1A]" />
                  )}
                  <span className="text-[11px] font-bold text-[#1A1A1A]">{compressingImage ? TXT.image_optimizing : TXT.image_btn}</span>
                </div>
              </label>

              <button
                onClick={handleCreatePost}
                disabled={posting || (!newPostContent.trim() && !selectedImage)}
                className="flex items-center gap-1.5 bg-gradient-to-r from-[#FF2D7A] to-[#FF5A99] text-white text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-[0_6px_18px_rgba(255,45,122,0.4)] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-transform"
              >
                {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {TXT.publish}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Posts Feed */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="card-glass-liquid rounded-2xl p-8 text-center">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-[14px] font-bold text-[#1A1A1A]">{TXT.empty_title}</p>
            <p className="text-[12px] text-[#6E6E6E] mt-1">{TXT.empty_desc}</p>
          </div>
        ) : (
          posts.map((post) => {
            const postProfile = getPostProfile(post);
            return (
              <div key={post.id} id={`post-${post.id}`} className={`card-glass-liquid rounded-2xl overflow-hidden transition-all duration-700 ${highlightedPostId === post.id ? 'ring-2 ring-[#FF2D7A] shadow-[0_0_20px_rgba(255,45,122,0.3)]' : ''}`}>
                <div className="p-4 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 shrink-0 rounded-full ring-2 ring-white/70 shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
                      <Avatar url={postProfile?.avatar_url} name={postProfile?.full_name} size={40} />
                    </div>
                    <div>
                      <p className="font-bold text-[13px] text-[#1A1A1A] leading-tight flex items-center gap-1.5">
                        <span className="truncate">{postProfile?.full_name || TXT.user_fallback}</span>
                        <InstagramLink handle={postProfile?.instagram} />
                      </p>
                      <p className="text-[10px] text-[#6E6E6E]/70 mt-0.5">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  {(post.user_id === user?.id || isExpert) && (
                    <button
                      className="p-2 text-[#6E6E6E]/50 hover:text-red-500 hover:bg-red-50/60 rounded-lg transition-colors"
                      onClick={() => handleDeletePost(post.id)}
                      aria-label={TXT.delete_post}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {post.content && (
                  <div className="px-4 pb-3">
                    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[13px] text-[#1A1A1A]/90 leading-relaxed">{post.content}</p>
                  </div>
                )}

                {post.image_url && (
                  <div className="w-full px-4 pb-3">
                    <img
                      src={post.image_url}
                      alt="Post"
                      className="w-full object-cover max-h-[400px] cursor-pointer hover:opacity-95 transition-opacity rounded-xl border border-white/60 shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                      onClick={() => setFullscreenImage(post.image_url)}
                    />
                  </div>
                )}

                <div className="px-4 py-3 flex items-center gap-2 border-t border-white/40">
                  <button
                    onClick={() => handleLike(post.id, post.user_has_liked)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                      post.user_has_liked
                        ? 'bg-gradient-to-r from-[#FF2D7A] to-[#FF5A99] text-white shadow-[0_4px_12px_rgba(255,45,122,0.35)]'
                        : 'bg-white/70 backdrop-blur text-[#1A1A1A] border border-[#FF2D7A]/15 hover:bg-white'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${post.user_has_liked ? 'fill-white' : ''}`} />
                    <span>{post.likes_count}</span>
                  </button>
                  <button
                    onClick={() => toggleComments(post.id)}
                    className="flex items-center gap-1.5 bg-white/70 backdrop-blur text-[#1A1A1A] border border-[#FF2D7A]/15 px-3 py-1.5 rounded-xl text-[11px] font-bold hover:bg-white transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{post.comments_count}</span>
                  </button>
                </div>

                {expandedComments.has(post.id) && (
                  <div className="px-4 pb-4 space-y-3 border-t border-white/40 pt-3 bg-white/40">
                    {loadingComments.has(post.id) ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 text-[#FF2D7A] animate-spin" />
                      </div>
                    ) : (
                      <>
                        {comments[post.id]?.map((comment) => {
                          const commentProfile = getCommentProfile(comment);
                          const canDelete = comment.user_id === user?.id || isExpert;
                          return (
                            <div key={comment.id} className="flex gap-2.5">
                              <div className="w-8 h-8 shrink-0 rounded-full ring-1 ring-white/70 overflow-hidden">
                                <Avatar url={commentProfile?.avatar_url} name={commentProfile?.full_name} size={32} />
                              </div>
                              <div className="flex-1 bg-white/80 backdrop-blur rounded-xl p-2.5 border border-white/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-[11px] text-[#1A1A1A]">{commentProfile?.full_name || TXT.user_fallback}</span>
                                    <InstagramLink handle={commentProfile?.instagram} />
                                    <span className="text-[9px] text-[#6E6E6E]/60">
                                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                                    </span>
                                  </div>
                                  {canDelete && (
                                    <button
                                      className="text-[#6E6E6E]/40 hover:text-red-500 transition-colors shrink-0"
                                      onClick={() => handleDeleteComment(post.id, comment.id)}
                                      aria-label={TXT.delete_comment}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                <p className="text-[12px] text-[#1A1A1A]/90 leading-relaxed">{comment.content}</p>
                              </div>
                            </div>
                          );
                        })}

                        <div className="flex gap-2 pt-1">
                          <div className="w-8 h-8 shrink-0 rounded-full ring-1 ring-white/70 overflow-hidden">
                            <Avatar url={profile?.avatar_url} name={profile?.full_name} size={32} />
                          </div>
                          <div className="flex-1 flex gap-2">
                            <Input
                              placeholder={TXT.comment_placeholder}
                              value={newComments[post.id] || ''}
                              onChange={(e) => setNewComments(prev => ({ ...prev, [post.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(post.id); } }}
                              className="flex-1 h-9 text-[12px] bg-white/80 backdrop-blur border-[#FF2D7A]/15 text-[#1A1A1A] placeholder:text-[#6E6E6E]/50 rounded-xl focus:border-[#FF2D7A]/50 px-3"
                            />
                            <button
                              onClick={() => handleComment(post.id)}
                              disabled={!newComments[post.id]?.trim()}
                              className="w-9 h-9 bg-gradient-to-r from-[#FF2D7A] to-[#FF5A99] rounded-xl flex items-center justify-center shadow-[0_4px_12px_rgba(255,45,122,0.35)] disabled:opacity-40 hover:scale-105 active:scale-95 disabled:hover:scale-100 transition-transform"
                              aria-label={TXT.send_comment}
                            >
                              <Send className="w-3.5 h-3.5 text-white" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {hasMore && posts.length > 0 && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full flex items-center justify-center gap-2 bg-white/70 backdrop-blur border border-[#FF2D7A]/15 hover:bg-white text-[#1A1A1A] text-[11px] font-black uppercase tracking-widest py-3 rounded-2xl transition-colors disabled:opacity-60"
          >
            {loadingMore ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#FF2D7A]" />
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                {TXT.load_more}
              </>
            )}
          </button>
        )}
      </div>

      {/* Fullscreen Image */}
      <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-transparent border-none">
          <img
            src={fullscreenImage || ''}
            alt={TXT.fullscreen_alt}
            className="w-full h-full object-contain max-h-[90vh] rounded-2xl border border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Community;
