import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Play, Clock, ChevronDown, ChevronUp, Loader2, CheckCircle2, FolderOpen, ExternalLink, Download, Sparkles, ChevronRight, NotebookPen } from 'lucide-react';
import { useModuleBySlug, useLessonProgress, type Lesson } from '@/hooks/useCourses';
import { useLocalizedNavigate } from '@/i18n/LanguageProvider';
import { useTranslation } from 'react-i18next';

/* ── AULA ROW ── */
const AulaRow: React.FC<{
  aula: Lesson;
  acento: string;
  index: number;
  moduleSlug: string;
  completed: boolean;
}> = ({ aula, acento, index, moduleSlug, completed }) => {
  const navigate = useLocalizedNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Aula que abre uma PÁGINA do app em vez do player: `video_url` guarda um
  // caminho interno (começa com "/"), ex.: a oferta do Viral 1 Min.
  // Sem isso o AulaDetail tentaria tocar o caminho num iframe.
  const paginaInterna = aula.video_url?.startsWith('/') ? aula.video_url : null;
  const abrirAula = () => navigate(paginaInterna ?? `/modulo/${moduleSlug}/aula/${index + 1}`);

  return (
    <div className="rounded-2xl border border-[#BE0D3E]/15 bg-[#FFFFFF] overflow-hidden transition-all">
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        onClick={() => setOpen(o => !o)}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: completed ? 'rgba(16,185,129,0.15)' : 'rgba(255,45,122,0.1)' }}>
          {completed
            ? <CheckCircle2 size={15} className="text-emerald-500" fill="#10B981" stroke="white" strokeWidth={2.5} />
            : <Play size={14} style={{ color: acento }} fill={acento} />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold truncate text-[#1E1B11]">
            {String(index + 1).padStart(2, '0')}. {aula.titulo}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <Clock size={9} className="text-[#5B4041]/40" />
            <span className="text-[9px] text-[#5B4041]/40">{aula.duracao}</span>
            {completed && (
              <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600">
                {t('modulo.concluida')}
              </span>
            )}
          </div>
        </div>

        {open
          ? <ChevronUp size={13} className="text-[#5B4041]/30 shrink-0" />
          : <ChevronDown size={13} className="text-[#5B4041]/30 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-[#BE0D3E]/10 px-4 pb-4 pt-3">
          {aula.descricao && (
            <p className="text-[11px] text-[#5B4041]/70 leading-relaxed mb-3">{aula.descricao}</p>
          )}
          <button
            onClick={abrirAula}
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-[11px] font-black text-white w-full justify-center"
            style={{ background: `linear-gradient(135deg, #BE0D3E, ${acento})`, boxShadow: `0 0 15px ${acento}40` }}
          >
            <Play size={12} fill="white" /> {t('modulo.assistirAula')}
          </button>
        </div>
      )}
    </div>
  );
};

/* ── MODULE DETAIL ── */
const ModuleDetail: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useLocalizedNavigate();
  const { t } = useTranslation();
  const { data: modulo, loading } = useModuleBySlug(moduleId);

  const lessonIds = useMemo(() => modulo?.lessons.map(l => l.id) ?? [], [modulo]);
  const { completed } = useLessonProgress(lessonIds);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-7 h-7 text-[#BE0D3E] animate-spin" />
      </div>
    );
  }

  if (!modulo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <p className="text-[#5B4041]/50 text-sm mb-4">{t('modulo.naoEncontrado')}</p>
        <button onClick={() => navigate('/home')} className="text-[#BE0D3E] text-sm font-bold">{t('modulo.voltarInicio')}</button>
      </div>
    );
  }

  const totalAulas = modulo.lessons.length;
  const concluidas = modulo.lessons.filter(l => completed.has(l.id)).length;
  const progressPct = totalAulas > 0 ? Math.round((concluidas / totalAulas) * 100) : 0;

  // Módulos da seção "Materiais" não têm aulas: abrem direto num link (Drive) pra ver/baixar.
  const isMateriais = modulo.home_section === 'materiais';
  // Ferramenta interna (ex.: Edição com IA): material_url aponta pra uma página do
  // próprio app em vez do Drive — muda o CTA e abre na mesma aba (a ferramenta tem
  // botão "Sair" que volta pra /home).
  const isFerramenta = isMateriais && !!modulo.material_url?.startsWith('/');
  // Módulo de aulas TAMBÉM pode ter uma ferramenta interna (ex.: Caderno do
  // Desafio no Do Zero aos 10K) — aparece como card junto das aulas.
  const ferramentaDoModulo = !isMateriais && modulo.material_url?.startsWith('/') ? modulo.material_url : null;

  return (
    <div className="pb-28 max-w-lg mx-auto">

      {/* ── HERO ── */}
      <div className={`relative bg-gradient-to-br ${modulo.cor_fundo} overflow-hidden`} style={{ minHeight: 220 }}>
        {/* Overlay escurecedor só no topo pra garantir contraste do texto branco
            independente de qual gradiente o módulo tem (claro ou escuro) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/20 to-transparent" />

        <button
          onClick={() => navigate('/home')}
          className="absolute top-4 left-4 z-20 w-9 h-9 rounded-full flex items-center justify-center bg-white/15 backdrop-blur-md border border-white/25 hover:bg-white/25 transition-colors"
        >
          <ArrowLeft size={16} className="text-white" />
        </button>

        {modulo.tag && modulo.tag_color && (
          <span className="absolute top-4 right-4 z-20 text-[8px] font-black uppercase tracking-widest text-white px-2 py-1 rounded-lg"
            style={{ background: modulo.tag_color }}>
            {modulo.tag}
          </span>
        )}

        <div className="relative z-10 pt-14 pb-4 px-5">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-1">{isFerramenta ? t('modulo.badgeFerramenta') : isMateriais ? t('modulo.badgeMaterial') : t('modulo.badgeModulo')}</p>
          <h1 className="text-[42px] font-black leading-[0.85] tracking-tighter text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
            {modulo.title1}<br />{modulo.title2}
          </h1>
          <p className="text-[11px] text-white/60 mt-3">{modulo.instructor}</p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {[isFerramenta ? t('modulo.badgeFerramenta') : isMateriais ? t('modulo.materialApoio') : t('modulo.contagemAulas', { count: totalAulas }), modulo.duracao, modulo.nivel].filter(Boolean).map(p => (
              <span key={p} className="text-[9px] font-black uppercase tracking-widest bg-white/10 text-white/70 px-2.5 py-1 rounded-full border border-white/10">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">

        {/* DESCRIÇÃO */}
        <div className="bg-[#FFFFFF] border border-[#BE0D3E]/15 rounded-2xl p-5">
          <h3 className="text-[9px] font-black uppercase tracking-widest text-[#5B4041]/50 mb-3">{t('modulo.sobreEsteModulo')}</h3>
          <p className="text-[12px] text-[#5B4041]/80 leading-relaxed">{modulo.descricao}</p>
        </div>

        {isMateriais ? (
          /* MATERIAIS/FERRAMENTAS — abre o link (Drive) ou a ferramenta interna */
          <div>
            <h3 className="text-[9px] font-black uppercase tracking-widest text-[#5B4041]/50 mb-3">{isFerramenta ? t('modulo.badgeFerramenta') : t('modulo.badgeMaterial')}</h3>
            {modulo.material_url ? (
              <a
                href={modulo.material_url}
                target={isFerramenta ? undefined : '_blank'}
                rel={isFerramenta ? undefined : 'noopener noreferrer'}
                className="flex items-center gap-3 rounded-2xl p-4 text-white"
                style={{ background: `linear-gradient(135deg, #BE0D3E, ${modulo.cor_acento})`, boxShadow: `0 8px 24px ${modulo.cor_acento}33` }}
              >
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  {isFerramenta
                    ? <Sparkles size={20} className="text-white" />
                    : <FolderOpen size={20} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black leading-tight">{isFerramenta ? t('modulo.editarFotoIA') : t('modulo.verBaixarMaterial')}</p>
                  <p className="text-[10px] text-white/75 mt-0.5">{isFerramenta ? t('modulo.editarFotoIASub') : t('modulo.abreNoDrive')}</p>
                </div>
                {isFerramenta
                  ? <ChevronRight size={16} className="text-white/80 shrink-0" />
                  : <ExternalLink size={16} className="text-white/80 shrink-0" />}
              </a>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-[#BE0D3E]/20 bg-[#FFF7E6]/40 p-6 flex items-center gap-4">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-white border border-[#BE0D3E]/15 flex items-center justify-center">
                  <Download size={18} className="text-[#BE0D3E]/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-black text-[#1E1B11] mb-0.5">{t('modulo.materialEmBreve')}</p>
                  <p className="text-[10px] text-[#5B4041] leading-relaxed">{t('modulo.materialEmBreveSub')}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* PROGRESSO */}
            <div className="bg-[#FFFFFF] border border-[#BE0D3E]/15 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[9px] font-black uppercase tracking-widest text-[#5B4041]/50">{t('modulo.seuProgresso')}</h3>
                <span className="text-[10px] font-black text-emerald-600">{progressPct}%</span>
              </div>
              <div className="h-2 bg-[#BE0D3E]/8 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, #10B981, #059669)',
                  }}
                />
              </div>
              <p className="text-[11px] text-[#5B4041]/70 mt-2">
                {t('modulo.concluidasDe', { done: concluidas, total: totalAulas })}
              </p>
            </div>

            {/* FERRAMENTA DO MÓDULO (ex.: Caderno do Desafio) */}
            {ferramentaDoModulo && (
              <div>
                <h3 className="text-[9px] font-black uppercase tracking-widest text-[#5B4041]/50 mb-3">{t('modulo.badgeFerramenta')}</h3>
                <a
                  href={ferramentaDoModulo}
                  className="flex items-center gap-3 rounded-2xl p-4 text-white"
                  style={{ background: `linear-gradient(135deg, #BE0D3E, ${modulo.cor_acento})`, boxShadow: `0 8px 24px ${modulo.cor_acento}33` }}
                >
                  <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <NotebookPen size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black leading-tight">{t('modulo.cadernoDesafio')}</p>
                    <p className="text-[10px] text-white/75 mt-0.5">{t('modulo.cadernoDesafioSub')}</p>
                  </div>
                  <ChevronRight size={16} className="text-white/80 shrink-0" />
                </a>
              </div>
            )}

            {/* AULAS */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[9px] font-black uppercase tracking-widest text-[#5B4041]/50">{t('modulo.aulas')}</h3>
                <span className="text-[9px] text-[#5B4041]/30">{t('modulo.contagemAulas', { count: totalAulas })}</span>
              </div>
              <div className="space-y-2">
                {modulo.lessons.map((aula, i) => (
                  <AulaRow
                    key={aula.id}
                    aula={aula}
                    acento={modulo.cor_acento}
                    index={i}
                    moduleSlug={modulo.slug}
                    completed={completed.has(aula.id)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default ModuleDetail;
