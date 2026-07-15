import React, { useState } from 'react';
import { MessageSquareText, Send, Loader2 } from 'lucide-react';

interface Props {
  lessonId: string;
}

interface Comment {
  id: string;
  name: string;
  initials: string;
  gradient: string;
  time: string;
  text: string;
  isMe?: boolean;
}

const seedComments = (lessonId: string): Comment[] => [
  {
    id: `${lessonId}-c1`,
    name: 'Marina Costa',
    initials: 'MC',
    gradient: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)',
    time: 'há 1h',
    text: 'Gente, quando ela fala do "gancho nos 3 primeiros segundos", isso vale pra vídeo de talking head também ou só pra edição rápida?',
  },
  {
    id: `${lessonId}-c2`,
    name: 'Thiago Alves',
    initials: 'TA',
    gradient: 'linear-gradient(135deg, #F6B43A 0%, #9FE000 100%)',
    time: 'há 2h',
    text: 'Apliquei essa técnica de corte no meu último Reels e o retention subiu de 38% pra 61%. Surreal.',
  },
  {
    id: `${lessonId}-c3`,
    name: 'Bia Ferraz',
    initials: 'BF',
    gradient: 'linear-gradient(135deg, #E06B85 0%, #F6B43A 100%)',
    time: 'há 4h',
    text: 'Alguém tem exemplo de legenda estilo "closed caption animada" pronta pra usar no CapCut? Essa aula deu vontade de testar hoje.',
  },
];

const LessonForum: React.FC<Props> = ({ lessonId }) => {
  const [comments, setComments] = useState<Comment[]>(() => seedComments(lessonId));
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    window.setTimeout(() => {
      const newComment: Comment = {
        id: `${lessonId}-you-${Date.now()}`,
        name: 'Você',
        initials: 'EU',
        gradient: 'linear-gradient(135deg, #BE0D3E 0%, #F6B43A 100%)',
        time: 'agora',
        text,
        isMe: true,
      };
      setComments((prev) => [newComment, ...prev]);
      setDraft('');
      setSending(false);
    }, 500);
  };

  return (
    <section className="mt-2">
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50">
            Dúvidas da aula
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <MessageSquareText size={16} className="text-[#BE0D3E]" strokeWidth={2.5} />
            <h3 className="text-lg font-black tracking-tight text-[#1E1B11]">
              {comments.length} {comments.length === 1 ? 'comentário' : 'comentários'}
            </h3>
          </div>
        </div>
      </div>

      <div className="viral-card p-4 mb-4">
        <textarea
          className="input-instagram w-full resize-none"
          placeholder="Tire sua dúvida sobre a aula..."
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
        {comments.map((comment) => (
          <div key={comment.id} className="viral-card p-4">
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-black"
                style={{ background: comment.gradient }}
              >
                {comment.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-sm text-[#1E1B11] tracking-tight">
                    {comment.name}
                  </span>
                  {comment.isMe && (
                    <span
                      className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
                      style={{ background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)' }}
                    >
                      Você
                    </span>
                  )}
                  <span className="text-[11px] font-bold text-[#5B4041]">{comment.time}</span>
                </div>
                <p className="text-sm text-[#1E1B11]/80 mt-1 leading-relaxed break-words">
                  {comment.text}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default LessonForum;
