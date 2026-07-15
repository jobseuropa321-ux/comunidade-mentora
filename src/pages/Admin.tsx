import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LayoutGrid, BookOpen, Users, Eye, EyeOff, Plus, GripVertical, ShieldCheck } from 'lucide-react';
import { useAllModules } from '@/hooks/useCourses';
import { LESSONS } from '@/data/mockCourses';

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { modules, loading } = useAllModules(true);

  // Estado local de publicação (demo — no app real isso persiste no banco).
  const [published, setPublished] = useState<Record<string, boolean>>({});
  const isPublished = (id: string, fallback: boolean) => published[id] ?? fallback;
  const togglePublish = (id: string, current: boolean) =>
    setPublished((p) => ({ ...p, [id]: !current }));

  const lessonCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of LESSONS) map[l.module_id] = (map[l.module_id] ?? 0) + 1;
    return map;
  }, []);

  const totalAulas = LESSONS.length;

  const stats = [
    { icon: LayoutGrid, label: 'Módulos', value: modules.length, color: '#BE0D3E' },
    { icon: BookOpen, label: 'Aulas', value: totalAulas, color: '#E06B85' },
    { icon: Users, label: 'Membros', value: '1.284', color: '#F6B43A' },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-28">
      {/* Topbar */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate('/home')}
          className="glass-btn-pink shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-95 transition-transform"
          aria-label="Voltar"
        >
          <ArrowLeft size={17} strokeWidth={2.5} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={15} className="text-[#BE0D3E]" />
            <h1 className="text-[18px] font-black text-[#1E1B11] leading-none">Administração</h1>
          </div>
          <p className="text-[10px] text-[#5B4041]/60 mt-0.5">Gerencie módulos e conteúdo</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="viral-card p-4 flex flex-col items-center text-center">
            <s.icon size={19} style={{ color: s.color }} />
            <span className="text-[16px] font-black text-[#1E1B11] mt-1.5">{s.value}</span>
            <span className="text-[8px] font-bold uppercase tracking-widest text-[#5B4041]/60">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Ações */}
      <button
        className="w-full mb-5 py-3.5 rounded-2xl text-[12px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)', boxShadow: '0 8px 25px rgba(255,45,122,0.4)' }}
      >
        <Plus size={15} /> Novo módulo
      </button>

      {/* Lista de módulos */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[9px] font-black uppercase tracking-widest text-[#5B4041]/50">Módulos</h2>
        <span className="text-[9px] text-[#5B4041]/30">{modules.length} no total</span>
      </div>

      {loading ? (
        <p className="text-[12px] text-[#5B4041]/50 text-center py-8">Carregando…</p>
      ) : (
        <div className="space-y-2">
          {modules.map((m) => {
            const pub = isPublished(m.id, m.is_published);
            return (
              <div key={m.id} className="viral-card p-3.5 flex items-center gap-3">
                <GripVertical size={16} className="text-[#5B4041]/25 shrink-0" />
                <div
                  className={`w-10 h-10 rounded-xl shrink-0 bg-gradient-to-br ${m.cor_fundo}`}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-black text-[#1E1B11] truncate">
                    {m.title1} {m.title2}
                  </p>
                  <p className="text-[10px] text-[#5B4041]/60">
                    {lessonCount[m.id] ?? 0} aulas · {m.home_section === 'inicio' ? 'Comece por aqui' : 'Módulos'}
                  </p>
                </div>
                <button
                  onClick={() => togglePublish(m.id, pub)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-colors ${
                    pub ? 'bg-emerald-500/12 text-emerald-600' : 'bg-[#5B4041]/10 text-[#5B4041]'
                  }`}
                >
                  {pub ? <Eye size={12} /> : <EyeOff size={12} />}
                  {pub ? 'No ar' : 'Oculto'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[9px] text-[#5B4041]/50 text-center mt-6 leading-relaxed">
        Painel demonstrativo — as alterações não são persistidas. No app real este
        painel é protegido por role <span className="font-semibold">expert</span>.
      </p>
    </div>
  );
};

export default Admin;
