/* ═══════════════════════════════════════════════════════════════════════
 *  AuthContext — VERSÃO REAL (Supabase)
 *
 *  Substitui o antigo mock localStorage. Autentica de verdade via Supabase
 *  (email/senha), carrega o `profile` (tabela public.profiles) e os papéis
 *  (public.user_roles → isExpert / isTester).
 *
 *  Contrato mantido IDÊNTICO ao que as telas já consomem:
 *    user, session, profile, isExpert, isTester, loading,
 *    signUp(email, password, fullName), signIn(email, password),
 *    signOut(), updateProfile(updates)
 *  → nenhuma tela precisou mudar.
 *
 *  O backend fica em docs/backend/ (SQL já aplicado no projeto
 *  joqajomzignamixxqeet). O trigger handle_new_user cria a linha em
 *  `profiles` no cadastro, lendo o full_name do metadata que o signUp envia.
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
  isTester: boolean;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: unknown }>;
  signIn: (email: string, password: string) => Promise<{ error: unknown }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: unknown }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isExpert, setIsExpert] = useState(false);
  const [isTester, setIsTester] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
    if (data) setProfile(data as Profile);
  };

  const checkRoles = async (userId: string) => {
    try {
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
      const roles = (data ?? []).map((r: { role: string }) => r.role);
      setIsExpert(roles.includes('expert'));
      setIsTester(roles.includes('tester'));
    } catch {
      setIsExpert(false);
      setIsTester(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        // setTimeout(0) evita deadlock de chamadas ao supabase dentro do callback
        const uid = nextSession.user.id;
        setTimeout(() => { fetchProfile(uid); checkRoles(uid); }, 0);
      } else {
        setProfile(null);
        setIsExpert(false);
        setIsTester(false);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current);
      setUser(current?.user ?? null);
      if (current?.user) { fetchProfile(current.user.id); checkRoles(current.user.id); }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: fullName?.trim() || null },
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsExpert(false);
    setIsTester(false);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };
    const { error } = await supabase.from('profiles').update(updates).eq('user_id', user.id);
    if (!error) setProfile(prev => (prev ? { ...prev, ...updates } : prev));
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, isExpert, isTester, loading, signUp, signIn, signOut, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
