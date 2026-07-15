import React, { useState, useEffect } from 'react';
import { Play, Clock, MonitorPlay, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLiveStatus } from '@/hooks/useLiveStatus';
import { getUpcomingLives } from '@/data/liveSchedule';
import { supabase } from '@/integrations/supabase/client';

const cardSpring = { type: 'spring', stiffness: 220, damping: 24 } as const;

/* ─────────────────────────────────────────────────────────────
 *  TEXTOS DA TELA (troque à vontade — é toda a "escrita" daqui)
 * ───────────────────────────────────────────────────────────── */
const TXT = {
  title: 'Mentoria Ao Vivo',
  subtitle: 'Aulas e encontros semanais ao vivo com os mentores, ensinando e tirando dúvidas em tempo real!',
  badge: 'Ao vivo',
  fallback_title: 'Aula ao vivo',
  presenter_prefix: 'com',
  watch_btn: 'Assistir ao vivo',
  no_live: 'Sem live no momento',
  no_live_desc: 'Quando começar uma aula ao vivo, ela aparece aqui.',
  upcoming: 'Próximas aulas',
  no_upcoming: 'Nenhuma aula agendada',
  no_upcoming_desc: 'Quando uma nova aula ao vivo for marcada, ela aparece aqui com data e horário.',
  replays: 'Replays',
  no_replays: 'Em breve, replays aqui',
  no_replays_desc: 'As gravações das aulas ao vivo ficam disponíveis nesta área pra você assistir quando quiser.',
};

interface Replay {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  cover_url: string | null;
  duration_label: string | null;
  recorded_at: string | null;
}

const formatBRDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase();
};

/** Detecta YouTube e retorna URL de embed. Se não for YouTube, retorna null (cai no fluxo "abrir nova aba"). */
const buildYouTubeEmbedUrl = (rawUrl: string | null): string | null => {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl.trim());
    const host = u.hostname.replace(/^www\./, '');
    let videoId: string | null = null;
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      // /watch?v=ID
      videoId = u.searchParams.get('v');
      // /live/ID  /embed/ID  /shorts/ID
      if (!videoId) {
        const m = u.pathname.match(/^\/(?:live|embed|shorts)\/([^/?]+)/);
        if (m) videoId = m[1];
      }
    } else if (host === 'youtu.be') {
      const m = u.pathname.match(/^\/([^/?]+)/);
      if (m) videoId = m[1];
    }
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`;
  } catch {
    return null;
  }
};

/* ── Indicador pulsante "AO VIVO" ── */
const LivePulse: React.FC<{ label: string }> = ({ label }) => (
  <div className="inline-flex items-center gap-1.5 bg-[#1E1B11] rounded-full px-2.5 py-1">
    <span className="relative flex w-2 h-2">
      <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
      <span className="relative rounded-full w-2 h-2 bg-red-500" />
    </span>
    <span className="text-[9px] font-black uppercase tracking-widest text-white">{label}</span>
  </div>
);

/* ── Capa gerada da Mentoria Ao Vivo (portrait) ── */
const LiveCover: React.FC<{
  title: string;
  day: string;
  month: string;
  weekday: string;
  time: string;
  presenterLabel: string;
}> = ({ title, day, month, weekday, time, presenterLabel }) => (
  <div className="absolute inset-0 bg-gradient-to-br from-[#94002D] via-[#BE0D3E] to-[#E06B85] overflow-hidden">
    {/* brilhos decorativos */}
    <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/15 blur-xl" />
    <div className="absolute -bottom-12 -left-8 w-32 h-32 rounded-full bg-black/10 blur-xl" />
    <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '12px 12px' }} />

    <div className="relative h-full flex flex-col items-center justify-between py-3 px-2.5 text-center">
      {/* topo: pill ao vivo */}
      <div className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-1.5 py-0.5">
        <span className="w-1 h-1 rounded-full bg-white" />
        <span className="text-[7px] font-black uppercase tracking-[0.15em] text-white">{weekday}</span>
      </div>

      {/* centro: título */}
      <div className="flex flex-col items-center">
        <span className="text-[12px] font-black uppercase leading-[0.95] text-white drop-shadow-sm tracking-tight">{title}</span>
        <span className="mt-1 h-[2px] w-6 rounded-full bg-white/70" />
      </div>

      {/* data grande */}
      <div className="flex flex-col items-center leading-none">
        <span className="text-[34px] font-black text-white drop-shadow tracking-tighter">{day}</span>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/95 -mt-1">{month}</span>
      </div>

      {/* base: horário + responsável */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[9px] font-black text-white">{time}</span>
        <span className="text-[8px] font-semibold text-white/85">{presenterLabel}</span>
      </div>
    </div>
  </div>
);

const AoVivo: React.FC = () => {
  const reduce = useReducedMotion() ?? false;
  const { status, loading } = useLiveStatus();
  const isLive = status.is_active && !!status.stream_url;
  const youtubeEmbedUrl = isLive ? buildYouTubeEmbedUrl(status.stream_url) : null;

  // Replays publicados (Supabase). Admin gerencia em /admin → aba Ao Vivo.
  const [replays, setReplays] = useState<Replay[]>([]);
  const [playingReplay, setPlayingReplay] = useState<Replay | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from('live_replays')
        .select('id, title, description, video_url, cover_url, duration_label, recorded_at')
        .eq('is_published', true)
        .order('position', { ascending: false })
        .order('recorded_at', { ascending: false, nullsFirst: false });
      if (!cancel && data) setReplays(data as Replay[]);
    })();
    return () => { cancel = true; };
  }, []);

  const upcoming = getUpcomingLives();

  const openStream = () => {
    if (status.stream_url) window.open(status.stream_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="px-4 pt-2 pb-28">
      {/* Header */}
      <motion.h2
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-[26px] leading-none font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-[#BE0D3E] to-[#E06B85] tracking-tighter"
      >
        {TXT.title}
      </motion.h2>
      <motion.p
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-[#5B4041] text-[11px] font-light tracking-[0.15em] uppercase opacity-80 mb-5 leading-tight"
      >
        {TXT.subtitle}
      </motion.p>

      {/* Card principal — aula acontecendo agora ou estado vazio */}
      {!loading && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...cardSpring, delay: 0.12 }}
        >
        {isLive ? (
          youtubeEmbedUrl ? (
            // YouTube live: player embarcado no app
            <section className="rounded-2xl mb-6 overflow-hidden border-2 border-[#BE0D3E]/25 shadow-[0_10px_30px_rgba(190,13,62,0.18)] bg-[#1E1B11]">
              {/* Header com pulse + título */}
              <div className="px-4 py-3 flex items-center gap-2 bg-[#1E1B11]">
                <LivePulse label={TXT.badge} />
                <p className="text-[12px] font-black text-white truncate flex-1">
                  {status.title || TXT.fallback_title}
                </p>
              </div>
              {/* Player 16:9 */}
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={youtubeEmbedUrl}
                  title={status.title || TXT.fallback_title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              {/* Descrição/presenter abaixo */}
              {(status.description || status.presenter) && (
                <div className="px-4 py-3 bg-white">
                  {status.description && (
                    <p className="text-[11px] text-[#1E1B11] leading-relaxed">
                      {status.description}
                    </p>
                  )}
                  {status.presenter && (
                    <p className="text-[10px] text-[#5B4041] mt-1">{TXT.presenter_prefix} {status.presenter}</p>
                  )}
                </div>
              )}
            </section>
          ) : (
            // Não-YouTube (Meet, custom): card glass-lime com botão pra abrir externo
            <section className="card-glass-liquid-lime rounded-2xl p-5 mb-6">
              <div className="mb-3">
                <LivePulse label={TXT.badge} />
              </div>
              <h3 className="text-[20px] font-black text-[#1E1B11] leading-tight mb-1.5">
                {status.title || TXT.fallback_title}
              </h3>
              {status.description && (
                <p className="text-[11px] text-[#1E1B11]/70 leading-relaxed mb-5 max-w-[90%]">
                  {status.description}
                </p>
              )}
              {status.presenter && !status.description && (
                <p className="text-[11px] text-[#1E1B11]/70 leading-relaxed mb-5">
                  {TXT.presenter_prefix} {status.presenter}
                </p>
              )}
              <button
                onClick={openStream}
                className="bg-[#1E1B11] text-white text-[11px] font-black py-3 px-5 rounded-xl uppercase tracking-widest flex items-center gap-2 shadow-[0_6px_18px_rgba(30,27,17,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-transform"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <Play size={14} fill="#fff" /> {TXT.watch_btn}
              </button>
            </section>
          )
        ) : (
          <section className="bg-white border border-[#BE0D3E]/15 rounded-2xl p-5 mb-6 text-center shadow-[0_4px_14px_rgba(190,13,62,0.06)]">
            <div className="w-12 h-12 rounded-full bg-[#FFF7E6] flex items-center justify-center mx-auto mb-3">
              <MonitorPlay size={20} className="text-[#BE0D3E]/70" />
            </div>
            <h3 className="text-[14px] font-black text-[#1E1B11] mb-1">{TXT.no_live}</h3>
            <p className="text-[11px] text-[#5B4041] leading-relaxed">
              {TXT.no_live_desc}
            </p>
          </section>
        )}
        </motion.div>
      )}

      {/* Próximas aulas */}
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...cardSpring, delay: 0.2 }}
        className="mb-6 -mx-4"
      >
        <h3 className="text-[10px] font-black text-[#5B4041] uppercase tracking-widest mb-3 px-4">{TXT.upcoming}</h3>
        {upcoming.length === 0 ? (
          <div className="px-4">
            <div className="rounded-2xl border-2 border-dashed border-[#BE0D3E]/20 bg-[#FFF7E6]/40 p-6 flex items-center gap-4">
              <div className="shrink-0 w-14 h-14 rounded-xl bg-white border border-[#BE0D3E]/15 flex items-center justify-center shadow-[0_4px_12px_rgba(190,13,62,0.08)]">
                <Clock size={20} className="text-[#BE0D3E]/60" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-black text-[#1E1B11] mb-0.5">{TXT.no_upcoming}</p>
                <p className="text-[10px] text-[#5B4041] leading-relaxed">
                  {TXT.no_upcoming_desc}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="flex gap-3 overflow-x-auto pb-2 px-4 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          >
            {upcoming.map((l) => {
              const d = new Date(l.date + 'T00:00:00');
              const day = d.toLocaleDateString('pt-BR', { day: '2-digit' });
              const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
              const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
              return (
                <div
                  key={l.date}
                  className="shrink-0 w-[120px] h-[164px] rounded-[1rem] border border-[#BE0D3E]/20 relative overflow-hidden shadow-[0_8px_20px_rgba(190,13,62,0.12)] snap-start"
                >
                  <LiveCover
                    title={TXT.title}
                    day={day}
                    month={month}
                    weekday={weekday}
                    time={l.time}
                    presenterLabel={`${TXT.presenter_prefix} ${l.presenter}`}
                  />
                </div>
              );
            })}
            <div className="w-1 shrink-0" />
          </div>
        )}
      </motion.section>

      {/* Replays — carrossel com capas portrait */}
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...cardSpring, delay: 0.28 }}
        className="-mx-4"
      >
        <h3 className="text-[10px] font-black text-[#5B4041] uppercase tracking-widest mb-3 px-4">{TXT.replays}</h3>
        {replays.length === 0 ? (
          <div className="px-4">
            <div className="rounded-2xl border-2 border-dashed border-[#BE0D3E]/20 bg-[#FFF7E6]/40 p-6 flex items-center gap-4">
              <div className="shrink-0 w-14 h-14 rounded-xl bg-white border border-[#BE0D3E]/15 flex items-center justify-center shadow-[0_4px_12px_rgba(190,13,62,0.08)]">
                <Play size={20} className="text-[#BE0D3E]/60 ml-0.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-black text-[#1E1B11] mb-0.5">{TXT.no_replays}</p>
                <p className="text-[10px] text-[#5B4041] leading-relaxed">
                  {TXT.no_replays_desc}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="flex gap-3 overflow-x-auto pb-2 px-4 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          >
            {replays.map(r => (
              <button
                key={r.id}
                onClick={() => setPlayingReplay(r)}
                className="shrink-0 w-[148px] h-[200px] rounded-[1rem] border border-[#BE0D3E]/20 relative overflow-hidden shadow-[0_8px_20px_rgba(190,13,62,0.12)] bg-[#FFF7E6] active:scale-[0.97] transition-transform snap-start"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {/* Capa (ou fallback) */}
                {r.cover_url ? (
                  <img
                    src={r.cover_url}
                    alt={r.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#BE0D3E]/30 to-[#E06B85]/30" />
                )}
                {/* Overlay escuro na base */}
                <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                {/* Botão play centralizado */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,0.25)]">
                    <Play size={18} className="text-[#1E1B11] ml-0.5" fill="#1E1B11" />
                  </div>
                </div>

                {/* Badge de duração */}
                {r.duration_label && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5">
                    <Clock size={9} className="text-white" />
                    <span className="text-[9px] font-black text-white">{r.duration_label}</span>
                  </div>
                )}

                {/* Título + data */}
                <div className="absolute inset-x-0 bottom-0 p-3 text-left">
                  <p className="text-[11px] font-black text-white leading-tight mb-0.5 line-clamp-2 drop-shadow">{r.title}</p>
                  {r.recorded_at && (
                    <p className="text-[9px] text-white/75 font-semibold">{formatBRDate(r.recorded_at)}</p>
                  )}
                </div>
              </button>
            ))}
            <div className="w-1 shrink-0" />
          </div>
        )}
      </motion.section>

      {/* Modal de player do replay */}
      {playingReplay && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPlayingReplay(null)}
        >
          <div
            className="relative w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPlayingReplay(null)}
              className="absolute -top-10 right-0 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white"
            >
              <X size={18} />
            </button>
            <div className="aspect-video w-full bg-black rounded-xl overflow-hidden">
              <iframe
                src={buildYouTubeEmbedUrl(playingReplay.video_url) ?? playingReplay.video_url}
                title={playingReplay.title}
                className="w-full h-full"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
            <div className="mt-3 text-white">
              <h3 className="text-[16px] font-black leading-tight">{playingReplay.title}</h3>
              {playingReplay.description && (
                <p className="text-[12px] text-white/70 mt-1 leading-relaxed">{playingReplay.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AoVivo;
