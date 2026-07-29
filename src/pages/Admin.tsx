import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, BookOpen, Radio, KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AdminCourses from '@/components/admin/AdminCourses';
import AdminLive from '@/components/admin/AdminLive';
import AdminAccess from '@/components/admin/AdminAccess';

type Tab = 'cursos' | 'aovivo' | 'acessos';

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { isExpert, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('cursos');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-7 h-7 text-[#BE0D3E] animate-spin" />
      </div>
    );
  }

  // Gate de UX — a segurança REAL é o RLS (has_role expert) no Supabase.
  if (!isExpert) {
    navigate('/home', { replace: true });
    return null;
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'cursos', label: 'Cursos', icon: BookOpen },
    { id: 'aovivo', label: 'Ao Vivo', icon: Radio },
    { id: 'acessos', label: 'Acessos', icon: KeyRound },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-28">
      {/* Topbar */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate('/home')}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(180deg, #E63462, #CB1B49)' }}
          aria-label="Voltar"
        >
          <ArrowLeft size={17} strokeWidth={2.5} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={15} className="text-[#BE0D3E]" />
            <h1 className="text-[18px] font-black text-[#1E1B11] leading-none">Administração</h1>
          </div>
          <p className="text-[10px] text-[#5B4041]/60 mt-0.5">Configure a área de membros e o Ao Vivo</p>
        </div>
      </div>

      {/* Abas */}
      <div className="grid grid-cols-3 gap-1 bg-[#F6D6DC]/50 p-1 rounded-xl mb-5">
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors ${
                active ? 'bg-white text-[#BE0D3E] shadow-sm' : 'text-[#5B4041]/70'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <t.icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'cursos' && <AdminCourses />}
      {tab === 'aovivo' && <AdminLive />}
      {tab === 'acessos' && <AdminAccess />}
    </div>
  );
};

export default Admin;
