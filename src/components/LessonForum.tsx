import React, { useEffect, useState } from 'react';
import { MessageSquareText, Send, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useCurrentLang } from '@/i18n/LanguageProvider';
import { timeAgoShort } from '@/lib/formatLocale';

interface Props {
  lessonId: string;
}

interface CommentProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile: CommentProfile | null;
}

const Avatar: React.FC<{ profile: CommentProfile | null }> = ({ profile }) => {
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt="Avatar"
        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  const initial = (profile?.full_name?.trim()?.[0] || 'U').toUpperCase();
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-black"
      style={{ background: 'linear-gradient(135deg, #E06B85, #BE0D3E 60%, #94002D)' }}
    >
      {initial}
    </div>
  );
};

const LessonForum: React.FC<Props> = ({ lessonId }) => {
  const { t } = useTranslation();
  const lang = useCurrentLang();
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // Carrega os comentários da aula + perfil (nome/avatar) de quem escreveu.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: rows, error } = await supabase
          .from('lesson_comments')
          .select('id, user_id, content, created_at')
          .eq('lesson_id', lessonId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        const cRows = (rows ?? []) as Array<Omit<Comment, 'profile'>>;

        const authorIds = [...new Set(cRows.map((c) => c.user_id))];
        const profMap: Record<string, CommentProfile> = {};
        if (authorIds.length) {
          const { data: profRows } = await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url')
            .in('user_id', authorIds);
          (profRows ?? []).forEach((p: CommentProfile) => { profMap[p.user_id] = p; });
        }
        if (!cancelled) {
          setComments(cRows.map((c) => ({ ...c, profile: profMap[c.user_id] ?? null })));
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) toast.error(t('forum.erroCarregar'));
      }
    })();
    return () => { cancelled = true; };
  }, [lessonId]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending || !user) return;

    setSending(true);
    try {
      const { data: inserted, error } = await supabase
        .from('lesson_comments')
        .insert({ lesson_id: lessonId, user_id: user.id, content: text })
        .select('id, user_id, content, created_at')
        .single();
      if (error) throw error;
      const comment: Comment = {
        ...(inserted as Omit<Comment, 'profile'>),
        profile: {
          user_id: user.id,
          full_name: profile?.full_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
        },
      };
      setComments((prev) => [comment, ...prev]);
      setDraft('');
    } catch (error) {
      console.error(error);
      toast.error(t('forum.erroEnviar'));
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    const removed = comments.find((c) => c.id === commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    try {
      const { error } = await supabase.from('lesson_comments').delete().eq('id', commentId);
      if (error) throw error;
      toast.success(t('forum.comentarioExcluido'));
    } catch (error) {
      console.error(error);
      toast.error(t('forum.erroExcluir'));
      if (removed) setComments((prev) => [...prev, removed].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ));
    }
  };

  return (
    <section className="mt-2">
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50">
            {t('forum.duvidasDaAula')}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <MessageSquareText size={16} className="text-[#BE0D3E]" strokeWidth={2.5} />
            <h3 className="text-lg font-black tracking-tight text-[#1E1B11]">
              {t('forum.comentario', { count: comments.length })}
            </h3>
          </div>
        </div>
      </div>

      <div className="viral-card p-4 mb-4">
        <textarea
          className="input-instagram w-full resize-none"
          placeholder={t('forum.placeholder')}
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        />
        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white font-black text-sm tracking-tight active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)',
              boxShadow: '0 8px 25px rgba(255,45,122,0.4)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {sending ? (
              <>
                <Loader2 size={16} className="animate-spin" strokeWidth={2.5} />
                Enviando...
              </>
            ) : (
              <>
                Enviar
                <Send size={16} strokeWidth={2.5} />
              </>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {comments.map((comment) => {
          const isMe = comment.user_id === user?.id;
          return (
            <div key={comment.id} className="viral-card p-4">
              <div className="flex items-start gap-3">
                <Avatar profile={comment.profile} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm text-[#1E1B11] tracking-tight">
                      {comment.profile?.full_name || t('forum.aluna')}
                    </span>
                    {isMe && (
                      <span
                        className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
                        style={{ background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)' }}
                      >
                        Você
                      </span>
                    )}
                    <span className="text-[11px] font-bold text-[#5B4041]">{timeAgoShort(comment.created_at, lang)}</span>
                    {isMe && (
                      <button
                        type="button"
                        onClick={() => handleDelete(comment.id)}
                        className="ml-auto text-[#5B4041]/40 hover:text-[#BE0D3E] active:scale-95 transition-all"
                        aria-label={t('forum.excluirComentario')}
                      >
                        <Trash2 size={14} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-[#1E1B11]/80 mt-1 leading-relaxed break-words">
                    {comment.content}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default LessonForum;
