import React, { useMemo, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, Play, ChevronLeft, ChevronRight, CheckCircle2, Clock, List, Download, FileText, BookOpen, X, Loader2 } from 'lucide-react';
import { useLesson, useLessonProgress } from '@/hooks/useCourses';
import LessonForum from '@/components/LessonForum';
import { useLocalizedNavigate, useCurrentLang, localizedPath } from '@/i18n/LanguageProvider';

const TIPO_ICON: Record<string, React.ReactNode> = {
  pdf:       <FileText size={14} />,
  planilha:  <BookOpen size={14} />,
  checklist: <CheckCircle2 size={14} />,
  video:     <Play size={14} />,
};

const TIPO_COLOR: Record<string, string> = {
  pdf:       'text-rose-400 bg-rose-400/10',
  planilha:  'text-emerald-400 bg-emerald-400/10',
  checklist: 'text-blue-400 bg-blue-400/10',
  video:     'text-orange-400 bg-orange-400/10',
};

/** O admin aceita URL colada — mas é comum colar o código <iframe> inteiro do
 *  Panda/YouTube. Nesse caso extraímos o src, senão o player não carrega. */
const embedSrc = (raw: string | null): string | null => {
  if (!raw) return null;
  const v = raw.trim();
  if (v.startsWith('<')) return v.match(/src=["']([^"']+)["']/i)?.[1] ?? null;
  return v;
};

const AulaDetail: React.FC = () => {
  const { moduleId, aulaId } = useParams<{ moduleId: string; aulaId: string }>();
  const navigate = useLocalizedNavigate();
  const lang = useCurrentLang();
  const [playing, setPlaying] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const aulaIndex = aulaId ? Math.max(0, parseInt(aulaId, 10) - 1) : 0;
  const { data, loading } = useLesson(moduleId, aulaIndex);

  const lessonId = data?.lesson.id;
  const lessonIds = useMemo(() => (lessonId ? [lessonId] : []), [lessonId]);
  const { completed, toggle } = useLessonProgress(lessonIds);
  const isCompleted = !!lessonId && completed.has(lessonId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-7 h-7 text-[#BE0D3E] animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <p className="text-[#5B4041]/50 text-sm mb-4">Aula não encontrada</p>
        <button onClick={() => navigate('/home')} className="text-[#BE0D3E] text-sm font-bold">Voltar ao início</button>
      </div>
    );
  }

  // Aula que é uma PÁGINA do app (video_url = caminho interno, ex. a oferta do
  // Viral 1 Min): quem chega por link direto vai pra página em vez de ver o
  // caminho virar src de iframe. O ModuleDetail já navega direto pra lá.
  if (data.lesson.video_url?.startsWith('/')) {
    return <Navigate to={localizedPath(data.lesson.video_url, lang)} replace />;
  }

  const { module: modulo, lessons, lesson: aula } = data;

  const prevAula = aulaIndex > 0 ? lessons[aulaIndex - 1] : null;
  const nextAula = aulaIndex < lessons.length - 1 ? lessons[aulaIndex + 1] : null;

  const goToAula = (idx: number) => {
    setPlaying(false);
    navigate(`/modulo/${moduleId}/aula/${idx + 1}`);
  };

  return (
    <div className="min-h-screen bg-[#FFF9EE] max-w-lg mx-auto">

      {/* TOP BAR */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button
          onClick={() => navigate(`/modulo/${moduleId}`)}
          className="glass-btn-pink shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
          title="Voltar"
        >
          <ArrowLeft size={17} strokeWidth={2.5} />
        </button>

        <div className="flex-1 mx-3 text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#BE0D3E]">
            {modulo.title1} {modulo.title2}
          </p>
          <p className="text-[11px] font-bold text-[#1E1B11] truncate mt-0.5">{aula.titulo}</p>
        </div>

        <button
          onClick={() => setListOpen(o => !o)}
          className="glass-btn-lime shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[#1E1B11] hover:scale-105 active:scale-95 transition-transform"
          title="Lista de aulas"
        >
          <List size={17} strokeWidth={2.5} />
        </button>
      </div>

      {/* PLAYER */}
      <div
        className="mx-4 rounded-2xl overflow-hidden relative bg-[#1E1B11]"
        style={{ aspectRatio: '16/9' }}
      >
        {embedSrc(aula.video_url) ? (
          <iframe
            src={embedSrc(aula.video_url)!}
            title={aula.titulo}
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #FBF3E2, #FBF3E2)' }} />
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 60% 40%, ${modulo.cor_acento}18 0%, transparent 70%)` }} />
            <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-sm rounded-lg px-2 py-1">
              <p className="text-[9px] font-black text-white/70 uppercase tracking-widest">
                Aula {String(aulaIndex + 1).padStart(2, '0')} / {lessons.length}
              </p>
            </div>
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-lg px-2 py-1">
              <Clock size={9} className="text-white/50" />
              <p className="text-[9px] text-white/70">{aula.duracao}</p>
            </div>
            {!playing ? (
              <button
                onClick={() => setPlaying(true)}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, ${modulo.cor_acento}, #BE0D3E)`,
                    boxShadow: `0 0 30px ${modulo.cor_acento}60, inset 0 2px 4px rgba(255,255,255,0.2)`,
                  }}
                >
                  <Play size={24} fill="white" className="text-white ml-1" />
                </div>
                <p className="text-[10px] text-white/50 font-semibold">Em breve</p>
              </button>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-end gap-1.5">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="w-1.5 rounded-full"
                      style={{
                        height: `${16 + Math.sin(i * 1.2) * 12}px`,
                        background: modulo.cor_acento,
                        animation: `eq-bar ${0.4 + i * 0.1}s ease-in-out infinite alternate`,
                        opacity: 0.8,
                      }} />
                  ))}
                </div>
                <style>{`@keyframes eq-bar { from { transform:scaleY(0.4); } to { transform:scaleY(1); } }`}</style>
              </div>
            )}
          </>
        )}
      </div>

      {/* MARCAR COMO CONCLUÍDA */}
      <div className="px-4 mt-3">
        <button
          onClick={() => lessonId && toggle(lessonId, !isCompleted)}
          disabled={!lessonId}
          className={`w-full rounded-2xl py-3.5 text-[13px] font-black transition-transform active:scale-[0.98] ${
            isCompleted ? '' : 'card-glass-liquid-lime'
          }`}
          style={{
            color: '#1E1B11',
            WebkitTapHighlightColor: 'transparent',
            ...(isCompleted
              ? {
                  background: 'rgba(200,240,0,0.18)',
                  border: '1.5px solid rgba(200,240,0,0.55)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 6px rgba(200,240,0,0.15)',
                }
              : {}),
          }}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            <CheckCircle2
              size={16}
              strokeWidth={2.75}
              fill={isCompleted ? '#1E1B11' : 'transparent'}
              className="text-[#1E1B11]"
            />
            {isCompleted ? 'Aula concluída · desmarcar' : 'Marcar como concluída'}
          </span>
        </button>
      </div>

      {/* NAVEGAÇÃO */}
      <div className="flex items-center gap-3 px-4 mt-3">
        <button
          onClick={() => prevAula && goToAula(aulaIndex - 1)}
          disabled={!prevAula}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-bold"
          style={{
            background: prevAula ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)',
            border: '1px solid rgba(255,45,122,0.12)',
            color: prevAula ? '#5B4041' : '#5B404125',
          }}
        >
          <ChevronLeft size={15} /> Anterior
        </button>

        <button
          onClick={() => nextAula && goToAula(aulaIndex + 1)}
          disabled={!nextAula}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-bold"
          style={{
            background: nextAula ? `linear-gradient(135deg, #BE0D3E, ${modulo.cor_acento})` : 'rgba(255,255,255,0.3)',
            border: nextAula ? 'none' : '1px solid rgba(255,45,122,0.12)',
            color: nextAula ? 'white' : '#5B404125',
            boxShadow: nextAula ? `0 4px 15px ${modulo.cor_acento}40` : 'none',
          }}
        >
          Próxima <ChevronRight size={15} />
        </button>
      </div>

      {/* CONTEÚDO */}
      <div className="px-4 mt-5 space-y-4 pb-12">
        <div>
          <h2 className="text-[18px] font-black text-[#1E1B11] leading-tight">{aula.titulo}</h2>
          {aula.descricao && (
            <p className="text-[12px] text-[#5B4041]/60 mt-1 leading-relaxed" dangerouslySetInnerHTML={{
              __html: aula.descricao.replace(
                /(https?:\/\/[^\s<]+)/g,
                '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-pink-500 underline break-all">$1</a>'
              )
            }} />
          )}
        </div>

        {aula.conteudo && (
          <div className="bg-[#FFFFFF] border border-[#BE0D3E]/12 rounded-2xl p-4">
            <h3 className="text-[9px] font-black uppercase tracking-widest text-[#5B4041]/40 mb-3">Resumo</h3>
            <p className="text-[12px] text-[#5B4041]/75 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{aula.conteudo}</p>
          </div>
        )}

        {aula.materials.length > 0 && (
          <div>
            <h3 className="text-[9px] font-black uppercase tracking-widest text-[#5B4041]/40 mb-3">
              Material complementar
            </h3>
            <div className="space-y-2">
              {aula.materials.map(mat => (
                <div key={mat.id}
                  className="flex items-center gap-3 bg-[#FFFFFF] border border-[#BE0D3E]/12 rounded-2xl px-4 py-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${TIPO_COLOR[mat.tipo] ?? 'text-gray-400 bg-gray-400/10'}`}>
                    {TIPO_ICON[mat.tipo] ?? <FileText size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-[#1E1B11] truncate">{mat.nome}</p>
                    <p className="text-[9px] text-[#5B4041]/40 mt-0.5 capitalize">{mat.tipo} · {mat.tamanho}</p>
                  </div>
                  <button
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${modulo.cor_acento}18`, border: `1px solid ${modulo.cor_acento}25` }}
                    onClick={() => mat.url && window.open(mat.url, '_blank')}
                    disabled={!mat.url}
                  >
                    <Download size={13} style={{ color: modulo.cor_acento }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FÓRUM */}
        {lessonId && <LessonForum lessonId={lessonId} />}
      </div>

      {/* DRAWER LISTA */}
      {listOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-[#1E1B11]/40 backdrop-blur-sm" onClick={() => setListOpen(false)} />
          <div
            className="fixed bottom-0 inset-x-0 z-50 max-w-lg mx-auto rounded-t-3xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF9EE 100%)',
              border: '1px solid rgba(255,45,122,0.2)',
              borderBottom: 'none',
              boxShadow: '0 -20px 50px rgba(255,45,122,0.2)',
              maxHeight: '75vh',
            }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[#BE0D3E]/25" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#BE0D3E]/15">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#BE0D3E]">
                {modulo.title1} {modulo.title2} · {lessons.length} aulas
              </span>
              <button onClick={() => setListOpen(false)}
                className="w-7 h-7 rounded-full bg-[#BE0D3E]/10 text-[#5B4041] hover:text-[#BE0D3E] hover:bg-[#BE0D3E]/15 flex items-center justify-center transition-colors">
                <X size={13} />
              </button>
            </div>
            <div className="overflow-y-auto p-3 space-y-1.5" style={{ maxHeight: 'calc(75vh - 72px)' }}>
              {lessons.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => { goToAula(i); setListOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                    i === aulaIndex
                      ? 'bg-[#BE0D3E]/10 border border-[#BE0D3E]/30'
                      : 'bg-white/50 border border-[#BE0D3E]/10 hover:bg-[#BE0D3E]/5'
                  }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${modulo.cor_acento}18` }}>
                    <Play size={11} style={{ color: modulo.cor_acento }} fill={modulo.cor_acento} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-bold truncate ${i === aulaIndex ? 'text-[#1E1B11]' : 'text-[#1E1B11]/80'}`}>
                      {String(i + 1).padStart(2, '0')}. {a.titulo}
                    </p>
                    <p className="text-[9px] text-[#5B4041] mt-0.5">{a.duracao}</p>
                  </div>
                  {i === aulaIndex && (
                    <span className="text-[8px] font-black uppercase tracking-widest shrink-0 px-2 py-1 rounded-md bg-[#BE0D3E] text-white">
                      Atual
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AulaDetail;
