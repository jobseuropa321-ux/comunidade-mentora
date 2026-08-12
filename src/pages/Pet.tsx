import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Cat,
  Flame,
  Bone,
  Sparkles,
  Check,
  Trophy,
  Video,
  MessageCircle,
  BookOpen,
  Heart,
  Zap,
  type LucideIcon,
} from 'lucide-react';

type Mission = {
  id: string;
  xp: number;
  Icon: LucideIcon;
  done: boolean;
};



/* Missões neutras: label e hint saem de pet.missoes.<id> no render. */
const INITIAL_MISSIONS: Mission[] = [
  { id: 'reels',       xp: 20, Icon: Video,          done: false },
  { id: 'comentarios', xp: 10, Icon: MessageCircle,  done: true },
  { id: 'aula',        xp: 15, Icon: BookOpen,       done: false },
  { id: 'curtidas',    xp: 8,  Icon: Heart,          done: false },
];

const Pet: React.FC = () => {
  const { t } = useTranslation();
  const LEVEL_TITLES = t('pet.niveis', { returnObjects: true }) as string[];
  const [petName] = useState('Mimi');
  const [level, setLevel] = useState(3);
  const [xp, setXp] = useState(60);
  const [streak, setStreak] = useState(7);
  const [missions, setMissions] = useState<Mission[]>(INITIAL_MISSIONS);
  const [leveledUp, setLeveledUp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [feeding, setFeeding] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [petted, setPetted] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const levelTitle = useMemo(
    () => LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    [level]
  );

  const mood = useMemo(() => {
    if (xp >= 80) return { label: 'Radiante', color: '#F6B43A' };
    if (xp >= 40) return { label: t('pet.humor.animada'), color: '#E06B85' };
    return { label: t('pet.humor.cochilando'), color: '#5B4041' };
  }, [xp]);

  const doneCount = missions.filter(m => m.done).length;
  const allDone = doneCount === missions.length;

  const showToast = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1700);
  };

  const gainXp = (amount: number, label: string) => {
    setXp(prevXp => {
      let total = prevXp + amount;
      let newLevel = level;
      while (total >= 100) {
        total -= 100;
        newLevel += 1;
      }
      if (newLevel !== level) {
        setLevel(newLevel);
        setLeveledUp(true);
        if (levelTimer.current) clearTimeout(levelTimer.current);
        levelTimer.current = setTimeout(() => setLeveledUp(false), 2600);
      }
      return total;
    });
    showToast(t('pet.toastXp', { xp: amount, acao: label }));
  };

  const handleFeed = () => {
    if (feeding) return;
    setFeeding(true);
    gainXp(12, t('pet.acaoAlimentou', { nome: petName }));
    setTimeout(() => setFeeding(false), 350);
  };

  const handlePlay = () => {
    if (playing) return;
    setPlaying(true);
    gainXp(18, t('pet.acaoBrincou', { nome: petName }));
    setTimeout(() => setPlaying(false), 350);
  };

  const handlePet = () => {
    if (petted) return;
    setPetted(true);
    gainXp(3, t('pet.acaoCarinho'));
    setTimeout(() => setPetted(false), 350);
  };

  const toggleMission = (id: string) => {
    setMissions(prev =>
      prev.map(m => {
        if (m.id !== id || m.done) return m;
        gainXp(m.xp, t('pet.missaoConcluida'));
        return { ...m, done: true };
      })
    );
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-28">
      {/* Cabeçalho da seção */}
      <div className="mb-5">
        <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50">
          {t('pet.gamificacao')}
        </p>
        <h1 className="page-title font-black tracking-tighter text-[26px] sm:text-[28px] text-[#1E1B11] leading-tight">
          {t('pet.titulo')}
        </h1>
        <p className="text-[13px] text-[#5B4041] mt-1">
          {t('pet.subtitulo', { nome: petName })}
        </p>
      </div>

      {/* Card principal do pet */}
      <div className="card-glass-liquid-pink rounded-3xl p-6 relative overflow-hidden">
        {/* blobs decorativos */}
        <div
          className="absolute -top-10 -right-10 w-36 h-36 rounded-full blur-2xl opacity-40 pointer-events-none"
          style={{ background: '#F6B43A' }}
        />
        <div
          className="absolute -bottom-14 -left-10 w-40 h-40 rounded-full blur-2xl opacity-30 pointer-events-none"
          style={{ background: '#BE0D3E' }}
        />

        {/* banner de level up */}
        <div
          className={`absolute inset-x-4 top-4 z-20 transition-all duration-300 ${
            leveledUp ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3 pointer-events-none'
          }`}
        >
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-2.5 text-white shadow-lg"
            style={{ background: 'linear-gradient(135deg, #F6B43A 0%, #9FCB00 100%)' }}
          >
            <Trophy size={20} className="text-[#1E1B11] shrink-0" />
            <div className="min-w-0">
              <p className="text-[12px] font-black text-[#1E1B11] leading-tight">{t('pet.subiuNivel')}</p>
              <p className="text-[11px] font-bold text-[#1E1B11]/70 truncate">
                Nível {level} · {levelTitle}
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* avatar */}
          <button
            onClick={handlePet}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            className={`relative w-28 h-28 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
              petted ? 'scale-95' : 'scale-100 active:scale-95'
            }`}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)',
                boxShadow: '0 12px 30px rgba(255,45,122,0.45)',
              }}
            />
            <Cat size={56} className="text-white relative z-10" strokeWidth={1.8} />
            <div
              className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full flex items-center justify-center border-[3px] border-white z-10"
              style={{ background: '#F6B43A' }}
            >
              <Flame size={16} className="text-[#1E1B11]" fill="#1E1B11" />
            </div>
          </button>
          <p className="text-[10px] font-bold text-[#5B4041] mt-2">{t('pet.toqueCarinho', { nome: petName })}</p>

          {/* nome + nível */}
          <h2 className="font-lilita text-[24px] text-[#1E1B11] mt-3 tracking-tight">{petName}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-[10px] font-black uppercase tracking-wide text-white px-2.5 py-1 rounded-full"
              style={{ background: 'linear-gradient(135deg, #BE0D3E, #E06B85)' }}
            >
              Nível {level}
            </span>
            <span
              className="text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full bg-white text-[#1E1B11]/70 border border-[#1E1B11]/10"
            >
              {levelTitle}
            </span>
          </div>
          <p className="text-[11px] font-bold mt-1.5 flex items-center gap-1" style={{ color: mood.color }}>
            <Sparkles size={12} /> Humor: {mood.label}
          </p>

          {/* ofensiva */}
          <div className="flex items-center gap-1.5 mt-3 bg-white/70 rounded-full px-3.5 py-1.5">
            <Flame size={15} className="text-[#BE0D3E]" fill="#BE0D3E" />
            <span className="text-[13px] font-black text-[#1E1B11]">{streak} dias</span>
            <span className="text-[11px] font-bold text-[#5B4041]">{t('pet.deOfensiva')}</span>
          </div>

          {/* barra de xp */}
          <div className="w-full mt-5">
            <div className="w-full h-3 rounded-full bg-white/70 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${xp}%`,
                  background: 'linear-gradient(90deg, #BE0D3E 0%, #F6B43A 100%)',
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] font-black text-[#1E1B11]">{xp} / 100 XP</span>
              <span className="text-[11px] font-bold text-[#5B4041]">
                {t('pet.faltamXp', { xp: 100 - xp, nivel: level + 1 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ações de interação */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <button
          onClick={handleFeed}
          style={{ WebkitTapHighlightColor: 'transparent' }}
          className={`glass-btn-lime rounded-2xl py-3.5 flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-transform ${
            feeding ? 'scale-95' : ''
          }`}
        >
          <Bone size={20} className="text-[#1E1B11]" />
          <span className="text-[12px] font-black text-[#1E1B11]">{t('pet.alimentar')}</span>
          <span className="text-[9px] font-bold text-[#1E1B11]/60">+12 XP</span>
        </button>
        <button
          onClick={handlePlay}
          style={{ WebkitTapHighlightColor: 'transparent' }}
          className={`glass-btn-pink rounded-2xl py-3.5 flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-transform ${
            playing ? 'scale-95' : ''
          }`}
        >
          <Sparkles size={20} className="text-white" />
          <span className="text-[12px] font-black text-white">{t('pet.brincar')}</span>
          <span className="text-[9px] font-bold text-white/70">+18 XP</span>
        </button>
      </div>

      {/* missões do dia */}
      <div className="mt-7">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5B4041]/50">
              Ganhe XP extra
            </p>
            <h3 className="font-black tracking-tight text-[18px] text-[#1E1B11]">{t('pet.missoesDoDia')}</h3>
          </div>
          <div className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 border border-[#1E1B11]/5 shadow-sm">
            <Zap size={13} className="text-[#BE0D3E]" />
            <span className="text-[11px] font-black text-[#1E1B11]">
              {doneCount}/{missions.length}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {missions.map(m => (
            <button
              key={m.id}
              onClick={() => toggleMission(m.id)}
              disabled={m.done}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              className={`viral-card w-full p-4 flex items-center gap-3 text-left transition-all active:scale-[0.98] ${
                m.done ? 'opacity-60' : ''
              }`}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: m.done ? 'rgba(200,240,0,0.25)' : 'rgba(255,45,122,0.08)',
                }}
              >
                <m.Icon size={18} className={m.done ? 'text-[#7a9400]' : 'text-[#BE0D3E]'} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[13px] font-bold text-[#1E1B11] leading-snug ${
                    m.done ? 'line-through decoration-2' : ''
                  }`}
                >
                  {t(`pet.missoes.${m.id}.label`)}
                </p>
                <p className="text-[10.5px] text-[#5B4041] mt-0.5 truncate">{t(`pet.missoes.${m.id}.hint`)}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span
                  className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(200,240,0,0.3)', color: '#5a7000' }}
                >
                  +{m.xp} XP
                </span>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                    m.done ? 'border-[#F6B43A] bg-[#F6B43A]' : 'border-[#1E1B11]/15'
                  }`}
                >
                  {m.done && <Check size={14} className="text-[#1E1B11]" strokeWidth={3} />}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* rodapé motivacional */}
      <div className="mt-6">
        {allDone ? (
          <div className="card-glass-liquid-lime rounded-2xl p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shrink-0">
              <Trophy size={20} className="text-[#F6B43A]" fill="#F6B43A" />
            </div>
            <div>
              <p className="text-[13px] font-black text-[#1E1B11]">{t('pet.todasConcluidas')}</p>
              <p className="text-[11px] font-bold text-[#1E1B11]/60">
                A {petName} está orgulhosa de você. Volte amanhã pra manter a ofensiva.
              </p>
            </div>
          </div>
        ) : (
          <div className="viral-card rounded-2xl p-4 flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,45,122,0.08)' }}
            >
              <Flame size={20} className="text-[#BE0D3E]" />
            </div>
            <div>
              <p className="text-[13px] font-black text-[#1E1B11]">{t('pet.naoPercaOfensiva')}</p>
              <p className="text-[11px] font-bold text-[#5B4041]">
                Complete as missões restantes hoje pra manter a {petName} feliz e sua sequência viva.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* toast de xp */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 bottom-28 z-50 transition-all duration-300 ${
          toast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        <div
          className="flex items-center gap-2 rounded-full px-4 py-2.5 text-white text-[12px] font-black shadow-lg whitespace-nowrap"
          style={{ background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)', boxShadow: '0 8px 25px rgba(255,45,122,0.4)' }}
        >
          <Sparkles size={14} />
          {toast}
        </div>
      </div>
    </div>
  );
};

export default Pet;
