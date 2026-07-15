import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('A senha deve ter ao menos 6 caracteres.'); return; }
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDone(true);
    }, 700);
  };

  return (
    <div className="min-h-screen bg-[#FFF9EE] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <button onClick={() => navigate('/auth')} className="flex items-center gap-1.5 text-[12px] font-bold text-[#5B4041] mb-6 hover:text-[#BE0D3E] transition-colors">
          <ArrowLeft size={14} /> Voltar ao login
        </button>

        <div className="bg-white border border-[#BE0D3E]/15 rounded-3xl p-6 shadow-[0_12px_40px_rgba(255,45,122,0.12)]">
          {done ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-[#F6B43A] flex items-center justify-center mb-4">
                <CheckCircle2 size={30} className="text-[#1E1B11]" />
              </div>
              <h1 className="text-[18px] font-black text-[#1E1B11] mb-1">Senha redefinida</h1>
              <p className="text-[12px] text-[#5B4041] mb-6">Já pode entrar com a nova senha.</p>
              <button
                onClick={() => navigate('/auth')}
                className="w-full py-3.5 rounded-2xl text-[13px] font-black uppercase tracking-widest text-white"
                style={{ background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)', boxShadow: '0 8px 25px rgba(255,45,122,0.4)' }}
              >
                Ir para o login
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-[20px] font-black text-[#1E1B11] mb-1">Nova senha</h1>
              <p className="text-[12px] text-[#5B4041] mb-5">Escolha uma senha nova para sua conta.</p>
              <form onSubmit={submit} className="space-y-3">
                <div className="flex items-center gap-2 input-instagram">
                  <Lock size={16} className="text-[#BE0D3E]/60 shrink-0" />
                  <input className="flex-1 bg-transparent outline-none text-[14px]" placeholder="Nova senha" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 input-instagram">
                  <Lock size={16} className="text-[#BE0D3E]/60 shrink-0" />
                  <input className="flex-1 bg-transparent outline-none text-[14px]" placeholder="Confirmar senha" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
                </div>
                {error && <p className="text-[11px] text-red-500 font-semibold px-1">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl text-[13px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #BE0D3E 0%, #E06B85 100%)', boxShadow: '0 8px 25px rgba(255,45,122,0.4)' }}
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  Redefinir senha
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
