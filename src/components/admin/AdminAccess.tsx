import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { readFnError } from '@/lib/functionsError';
import { toast } from 'sonner';
import {
  Loader2, KeyRound, Copy, Check, X, ShieldAlert, UserPlus,
  RotateCcw, History, MessageCircle,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   ADMIN · ACESSOS — libera acesso na mão (bônus, permuta, suporte).

   O frontend aqui NÃO escreve em subscriptions nem em user_roles:
   RLS dessas tabelas só permite SELECT do próprio dono. Toda a
   escrita passa pela edge function `admin-grant-access`, que roda
   com service_role e reconsulta no banco se quem chamou é expert.
   Ou seja: o botão abaixo é só um formulário — a autorização real
   acontece no servidor.

   A senha vem na resposta e aparece UMA vez (não fica salva em
   lugar nenhum). Se perder, gera de novo pro mesmo e-mail.
   ══════════════════════════════════════════════════════════════ */

const LOGIN_URL = 'https://app.comunidadedigital.com.br/auth';

type AccessType = 'aluna' | 'expert';
type Duration = '1m' | '6m' | '12m' | 'lifetime';

interface GrantResult {
  email: string;
  password: string;
  action: 'created' | 'password_reset';
  accessType: AccessType;
  expiresAt: string | null;
}

interface GrantLog {
  id: string;
  email: string;
  access_type: AccessType;
  action: 'created' | 'password_reset';
  expires_at: string | null;
  granted_by_email: string | null;
  created_at: string;
}

const DURATIONS: { id: Duration; label: string }[] = [
  { id: '1m', label: '1 mês' },
  { id: '6m', label: '6 meses' },
  { id: '12m', label: '1 ano' },
  { id: 'lifetime', label: 'Vitalício' },
];

/** Mensagens de erro da edge function traduzidas pra tela. */
const ERROR_MSG: Record<string, string> = {
  sem_permissao: 'Sua conta não tem permissão de expert pra liberar acessos.',
  sessao_invalida: 'Sua sessão expirou. Saia e entre de novo.',
  nao_autenticado: 'Sua sessão expirou. Saia e entre de novo.',
  email_invalido: 'E-mail inválido — confira se digitou certo.',
  limite_atingido: 'Você já liberou 30 acessos nesta hora. Espere um pouco.',
  falha_conta: 'O Supabase recusou criar a conta agora. Tente de novo em alguns segundos.',
  erro_assinatura: 'A conta foi criada, mas a assinatura falhou. Gere de novo.',
  erro_papel: 'A conta foi criada, mas o papel de expert falhou. Gere de novo.',
};

/** clipboard.writeText só existe em https/localhost — fallback pro textarea. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* cai no fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/* ── Botãozinho de copiar com feedback ── */
const CopyButton: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [done, setDone] = useState(false);
  const handle = async () => {
    const ok = await copyText(value);
    if (!ok) { toast.error('Não deu pra copiar — selecione e copie na mão'); return; }
    setDone(true);
    toast.success(`${label} copiado`);
    setTimeout(() => setDone(false), 1600);
  };
  return (
    <button onClick={handle} title={`Copiar ${label.toLowerCase()}`}
      className="shrink-0 w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center text-white hover:bg-white/25 active:scale-95 transition-all"
      style={{ WebkitTapHighlightColor: 'transparent' }}>
      {done ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
};

const AdminAccess: React.FC = () => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [accessType, setAccessType] = useState<AccessType>('aluna');
  const [duration, setDuration] = useState<Duration>('12m');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<GrantResult | null>(null);
  const [logs, setLogs] = useState<GrantLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('access_grants')
      .select('id, email, access_type, action, expires_at, granted_by_email, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (!error) setLogs((data ?? []) as GrantLog[]);
    setLoadingLogs(false);
  };
  useEffect(() => { fetchLogs(); }, []);

  const emailOk = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim());

  const handleGrant = async () => {
    if (!emailOk) { toast.error('Digite um e-mail válido'); return; }
    setSending(true);
    setResult(null);
    const { data, error } = await supabase.functions.invoke('admin-grant-access', {
      body: {
        email: email.trim().toLowerCase(),
        fullName: fullName.trim() || undefined,
        accessType,
        duration,
      },
    });
    setSending(false);

    if (error) {
      const body = await readFnError(error);
      const key = body?.error ?? '';
      toast.error(ERROR_MSG[key] ?? 'Não deu pra liberar o acesso agora', {
        description: ERROR_MSG[key] ? undefined : (body?.error ?? error.message),
      });
      return;
    }

    const res = data as GrantResult;
    setResult(res);
    setEmail('');
    setFullName('');
    toast.success(res.action === 'created' ? 'Conta criada e acesso liberado' : 'Senha redefinida e acesso liberado');
    fetchLogs();
  };

  const readyMessage = result
    ? `Oi! Seu acesso à Comunidade Digital está liberado 💗\n\n`
      + `Entrar: ${LOGIN_URL}\n`
      + `E-mail: ${result.email}\n`
      + `Senha: ${result.password}\n\n`
      + `Depois de entrar, se quiser trocar a senha é só usar "Esqueci minha senha" na tela de login.`
    : '';

  const inputCls = 'w-full bg-[#FFF7E6] border border-[#BE0D3E]/15 text-[#1E1B11] text-[12px] rounded-xl px-3 py-2 focus:border-[#BE0D3E]/50 focus:outline-none transition-colors';
  const labelCls = 'text-[10px] font-black uppercase tracking-widest text-[#5B4041]';

  return (
    <div className="space-y-4">
      {/* ── Resultado (senha em texto, aparece uma vez) ── */}
      {result && (
        <div className="rounded-2xl p-4 border-2 border-[#94002D] bg-gradient-to-br from-[#BE0D3E] to-[#E06B85] text-white">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                {result.action === 'created' ? <UserPlus size={12} /> : <RotateCcw size={12} />}
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {result.action === 'created' ? 'Conta criada' : 'Senha redefinida'}
                  {result.accessType === 'expert' ? ' · expert' : ''}
                </span>
              </div>
              <p className="text-[11px] text-white/80 leading-snug">
                Copie agora — a senha não fica guardada em nenhum lugar.
              </p>
            </div>
            <button onClick={() => setResult(null)} aria-label="Fechar"
              className="shrink-0 w-7 h-7 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25">
              <X size={13} />
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/70">E-mail</p>
                <p className="text-[13px] font-bold break-all">{result.email}</p>
              </div>
              <CopyButton value={result.email} label="E-mail" />
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/70">Senha</p>
                <p className="text-[18px] font-black tracking-[0.12em] font-mono break-all">{result.password}</p>
              </div>
              <CopyButton value={result.password} label="Senha" />
            </div>
          </div>

          <button onClick={async () => {
            const ok = await copyText(readyMessage);
            toast[ok ? 'success' : 'error'](ok ? 'Mensagem copiada — cole no WhatsApp' : 'Não deu pra copiar');
          }}
            className="mt-3 w-full py-2.5 rounded-xl bg-white text-[#BE0D3E] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
            style={{ WebkitTapHighlightColor: 'transparent' }}>
            <MessageCircle size={12} /> Copiar mensagem pronta
          </button>

          <p className="text-[10px] text-white/75 mt-2.5 leading-relaxed">
            {result.accessType === 'expert'
              ? 'Acesso de expert: entra em tudo e no painel de administração.'
              : result.expiresAt
                ? `Acesso liberado até ${new Date(result.expiresAt).toLocaleDateString('pt-BR')}.`
                : 'Acesso vitalício (sem data de expiração).'}
          </p>
        </div>
      )}

      {/* ── Formulário ── */}
      <div className="bg-white border border-[#BE0D3E]/15 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-1.5">
          <KeyRound size={13} className="text-[#BE0D3E]" />
          <h3 className="text-[12px] font-black text-[#1E1B11] uppercase tracking-widest">Liberar acesso</h3>
        </div>

        <div>
          <label className={labelCls}>E-mail da pessoa</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email"
            autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email"
            placeholder="nome@email.com" className={`mt-1.5 ${inputCls}`} />
          {email.trim() && !emailOk && <p className="text-[10px] text-red-500 mt-1">E-mail inválido</p>}
        </div>

        <div>
          <label className={labelCls}>Nome (opcional)</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)}
            placeholder="Como ela aparece na comunidade" className={`mt-1.5 ${inputCls}`} />
        </div>

        <div>
          <label className={labelCls}>Tipo de acesso</label>
          <div className="grid grid-cols-2 gap-1 bg-[#F6D6DC]/50 p-1 rounded-xl mt-1.5">
            {([
              { id: 'aluna' as AccessType, label: 'Aluna' },
              { id: 'expert' as AccessType, label: 'Expert (admin)' },
            ]).map(o => (
              <button key={o.id} onClick={() => setAccessType(o.id)}
                className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                  accessType === o.id ? 'bg-white text-[#BE0D3E] shadow-sm' : 'text-[#5B4041]/70'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {accessType === 'aluna' ? (
          <div>
            <label className={labelCls}>Validade</label>
            <div className="grid grid-cols-4 gap-1 bg-[#F6D6DC]/50 p-1 rounded-xl mt-1.5">
              {DURATIONS.map(d => (
                <button key={d.id} onClick={() => setDuration(d.id)}
                  className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors ${
                    duration === d.id ? 'bg-white text-[#BE0D3E] shadow-sm' : 'text-[#5B4041]/70'
                  }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 bg-[#FFF7E6] border border-[#BE0D3E]/25 rounded-xl p-3">
            <ShieldAlert size={14} className="text-[#BE0D3E] shrink-0 mt-0.5" />
            <p className="text-[10px] text-[#5B4041] leading-relaxed">
              <strong className="text-[#1E1B11]">Cuidado:</strong> expert entra no painel de administração
              e pode editar cursos, lives e liberar outros acessos. Use só pra equipe.
            </p>
          </div>
        )}

        <button onClick={handleGrant} disabled={sending || !emailOk}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#BE0D3E] to-[#E06B85] text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(190,13,62,0.3)] disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] transition-transform">
          {sending ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
          {sending ? 'Liberando...' : 'Gerar senha e liberar'}
        </button>

        <p className="text-[10px] text-[#5B4041] leading-relaxed">
          Se o e-mail já tiver conta, a senha é <strong>redefinida</strong> (a antiga para de funcionar)
          e o acesso é renovado. Nenhum e-mail é enviado — você copia e manda.
        </p>
      </div>

      {/* ── Histórico ── */}
      <div className="bg-white border border-[#BE0D3E]/15 rounded-2xl p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <History size={13} className="text-[#BE0D3E]" />
          <h3 className="text-[12px] font-black text-[#1E1B11] uppercase tracking-widest">
            Últimas liberações
          </h3>
        </div>

        {loadingLogs ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 text-[#BE0D3E] animate-spin" /></div>
        ) : logs.length === 0 ? (
          <p className="text-[11px] text-[#5B4041] py-2">Nenhum acesso liberado na mão até agora.</p>
        ) : (
          <div className="space-y-2">
            {logs.map(l => (
              <div key={l.id} className="flex items-center gap-2.5 border-b border-[#BE0D3E]/10 last:border-0 pb-2 last:pb-0">
                <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                  l.access_type === 'expert' ? 'bg-[#1E1B11] text-white' : 'bg-[#FFF7E6] text-[#BE0D3E]'
                }`}>
                  {l.action === 'created' ? <UserPlus size={12} /> : <RotateCcw size={12} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-[#1E1B11] truncate">{l.email}</p>
                  <p className="text-[9px] text-[#5B4041]">
                    {l.access_type === 'expert' ? 'Expert' : 'Aluna'}
                    {' · '}
                    {l.action === 'created' ? 'conta criada' : 'senha redefinida'}
                    {l.expires_at ? ` · até ${new Date(l.expires_at).toLocaleDateString('pt-BR')}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-[9px] text-[#5B4041]/70">
                  {new Date(l.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAccess;
