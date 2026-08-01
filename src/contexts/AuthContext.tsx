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
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { checkSubscription, AccessDeniedError, SUB_DENIED_MSG, type SubStatus } from '@/lib/subscription';

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
  accessDeniedStatus: Exclude<SubStatus, 'active'> | null;
  clearAccessDeniedNotice: () => void;
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
  const [accessDeniedStatus, setAccessDeniedStatus] = useState<Exclude<SubStatus, 'active'> | null>(null);
  const interactiveSignIn = useRef(false);
  const authCheckVersion = useRef(0);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
    setProfile(data ? data as Profile : null);
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

  const clearAuthState = () => {
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsExpert(false);
    setIsTester(false);
  };

  const validateAndPublishSession = async (nextSession: Session): Promise<SubStatus> => {
    const version = ++authCheckVersion.current;
    setLoading(true);

    const email = nextSession.user.email;
    const status = email ? await checkSubscription(email) : 'not_found';
    if (version !== authCheckVersion.current) return status;

    if (status !== 'active') {
      // Mantém o motivo depois do signOut para que a rota /auth consiga
      // explicar por que a sessão foi encerrada, inclusive ao recarregar o app.
      setAccessDeniedStatus(status);
      await supabase.auth.signOut();
      if (version === authCheckVersion.current) {
        clearAuthState();
        setLoading(false);
      }
      return status;
    }

    setAccessDeniedStatus(null);
    setSession(nextSession);
    setUser(nextSession.user);
    void fetchProfile(nextSession.user.id);
    void checkRoles(nextSession.user.id);
    setLoading(false);
    return status;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // signIn() faz a validação e só publica o usuário depois que o gate passa.
      // Assim a rota pública não pula para /home antes de um eventual signOut.
      if (event === 'SIGNED_IN' && interactiveSignIn.current) {
        setSession(nextSession);
        return;
      }

      if (!nextSession) {
        authCheckVersion.current += 1;
        clearAuthState();
        setLoading(false);
        return;
      }

      // Evita chamadas Supabase dentro do callback de auth (pode causar deadlock).
      setLoading(true);
      setTimeout(() => { void validateAndPublishSession(nextSession); }, 0);
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
    const clean = email.trim().toLowerCase();
    setAccessDeniedStatus(null);
    interactiveSignIn.current = true;
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: clean, password });
      if (error || !data.session) {
        setLoading(false);
        return { error: error ?? new Error('Sessão não criada') };
      }

      // Autenticar não basta: o usuário só chega às rotas protegidas depois
      // que uma assinatura válida (ou role de equipe) foi confirmada.
      const status = await validateAndPublishSession(data.session);
      if (status !== 'active') {
        return { error: new AccessDeniedError(SUB_DENIED_MSG[status]) };
      }
      return { error: null };
    } finally {
      interactiveSignIn.current = false;
    }
  };

  const signOut = async () => {
    authCheckVersion.current += 1;
    setAccessDeniedStatus(null);
    await supabase.auth.signOut();
    clearAuthState();
    setLoading(false);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };
    const { error } = await supabase.from('profiles').update(updates).eq('user_id', user.id);
    if (!error) setProfile(prev => (prev ? { ...prev, ...updates } : prev));
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isExpert,
        isTester,
        loading,
        accessDeniedStatus,
        clearAccessDeniedNotice: () => setAccessDeniedStatus(null),
        signUp,
        signIn,
        signOut,
        updateProfile,
      }}
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
