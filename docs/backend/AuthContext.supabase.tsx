/* ═══════════════════════════════════════════════════════════════════════
 *  AuthContext — VERSÃO REAL (Supabase)
 *
 *  Use este quando o Supabase estiver integrado:
 *  1. rode o SQL do BACKEND_SETUP.md (cria tabela `profiles` + trigger)
 *  2. apague `AuthContext.tsx` (o mock) e renomeie este pra `AuthContext.tsx`
 *
 *  Mínimo necessário pra tela de Perfil: sessão do usuário logado, o `profile`
 *  dele, `isExpert`, `signOut` e `updateProfile`. Sem lógica de assinatura/planos
 *  (isso é do `PlanContext`). Ajuste o fetch de role se seu app não usa `user_roles`.
 * ═══════════════════════════════════════════════════════════════════════ */
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  instagram: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isExpert: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isExpert, setIsExpert] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
    if (data) setProfile(data as Profile);
  };

  // Opcional: só se seu app tiver a tabela `user_roles`. Senão, deixe isExpert = false.
  const checkRole = async (userId: string) => {
    try {
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
      const roles = (data ?? []).map((r: any) => r.role as string);
      setIsExpert(roles.includes('expert'));
    } catch { setIsExpert(false); }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => { fetchProfile(session.user.id); checkRole(session.user.id); }, 0);
      } else {
        setProfile(null);
        setIsExpert(false);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) { fetchProfile(session.user.id); checkRole(session.user.id); }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsExpert(false);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };
    const { error } = await supabase.from('profiles').update(updates).eq('user_id', user.id);
    if (!error) setProfile(prev => (prev ? { ...prev, ...updates } : null));
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isExpert, loading, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
