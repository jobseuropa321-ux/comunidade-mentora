import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User as UserIcon, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type Mode = 'login' | 'signup';

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password || (mode === 'signup' && !fullName)) {
      setError('Preencha todos os campos.');
      return;
    }
    setLoading(true);
    const res = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password, fullName);
    setLoading(false);
    if (res.error) {
      setError('Não foi possível entrar. Tente novamente.');
      return;
    }
    navigate('/home', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FFF9EE] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo-app.png" alt="Amentora" className="h-28 w-auto" draggable={false} />
        </div>

        <div className="bg-white border border-[#BE0D3E]/15 rounded-3xl p-6 shadow-[0_12px_40px_rgba(255,45,122,0.12)]">
          {/* Tabs */}
          <div className="flex bg-[#FFF9EE] rounded-2xl p-1 mb-6">
            {(['login', 'signup'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all ${
                  mode === m ? 'text-white shadow-[0_4px_12px_rgba(255,45,122,0.35)]' : 'text-[#5B4041]'
                }`}
                style={mode === m ? { background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)' } : {}}
              >
                {m === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <div className="flex items-center gap-2 input-instagram">
                <UserIcon size={16} className="text-[#BE0D3E]/60 shrink-0" />
                <input
                  className="flex-1 bg-transparent outline-none text-[14px]"
                  placeholder="Seu nome"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>
            )}
            <div className="flex items-center gap-2 input-instagram">
              <Mail size={16} className="text-[#BE0D3E]/60 shrink-0" />
              <input
                className="flex-1 bg-transparent outline-none text-[14px]"
                placeholder="E-mail"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 input-instagram">
              <Lock size={16} className="text-[#BE0D3E]/60 shrink-0" />
              <input
                className="flex-1 bg-transparent outline-none text-[14px]"
                placeholder="Senha"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-[11px] text-red-500 font-semibold px-1">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl text-[13px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)', boxShadow: '0 8px 25px rgba(255,45,122,0.4)' }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={15} />}
              {mode === 'login' ? 'Entrar na comunidade' : 'Criar minha conta'}
            </button>
          </form>

          {mode === 'login' && (
            <button
              onClick={() => navigate('/reset-password')}
              className="w-full text-center text-[11px] text-[#5B4041] mt-4 hover:text-[#BE0D3E] transition-colors"
            >
              Esqueci minha senha
            </button>
          )}
        </div>

        <p className="text-[10px] text-[#5B4041]/60 text-center mt-5 leading-relaxed">
          Ao continuar, você concorda com nossos termos de uso e política de
          privacidade.
        </p>
      </div>
    </div>
  );
};

export default Auth;
