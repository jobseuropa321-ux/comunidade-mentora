import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Download, Search, ChevronDown, ChevronUp, Instagram, MessageCircle, Crown, LifeBuoy } from 'lucide-react';
import { type Lead, type LeadTipo, MENTORIA_CAMPOS, SUPORTE_CAMPOS } from '@/lib/leads';

/* ══════════════════════════════════════════════════════════════
   ADMIN · LEADS — aplicações da mentoria e pedidos de suporte.

   Mesma tabela (`leads`), muda o `tipo`. Os campos específicos vêm do
   jsonb `respostas`, rotulados por MENTORIA_CAMPOS / SUPORTE_CAMPOS.
   ══════════════════════════════════════════════════════════════ */

type Linha = Lead & { id: string; created_at: string };

const CONFIG: Record<LeadTipo, { titulo: string; sub: string; icone: React.ElementType; campos: { chave: string; rotulo: string }[]; rota: string; cor: string }> = {
  mentoria: { titulo: 'Aplicações da mentoria', sub: 'quem quer o acompanhamento do time', icone: Crown, campos: MENTORIA_CAMPOS, rota: '/mentoria', cor: 'linear-gradient(160deg, #1C1C1F 0%, #0B0B0C 65%, #17150C 100%)' },
  suporte:  { titulo: 'Pedidos de suporte', sub: 'quem pediu ajuda pelo formulário', icone: LifeBuoy, campos: SUPORTE_CAMPOS, rota: '/suporte', cor: 'linear-gradient(135deg, #BE0D3E 0%, #94002D 100%)' },
};

const formatarData = (iso: string) => {
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

const csvCelula = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const exportarCsv = (tipo: LeadTipo, linhas: Linha[]) => {
  const campos = CONFIG[tipo].campos;
  const cab = ['Data', 'Nome', 'E-mail', 'WhatsApp', 'Instagram', ...campos.map(c => c.rotulo), 'Origem'].join(';');
  const corpo = linhas.map(l => [
    formatarData(l.created_at), l.nome, l.email, l.whatsapp, l.instagram,
    ...campos.map(c => l.respostas?.[c.chave] ?? ''),
    l.origem === 'link' ? 'Link público' : 'App',
  ].map(csvCelula).join(';'));
  const blob = new Blob(['﻿' + [cab, ...corpo].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${tipo}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

const Detalhe: React.FC<{ rotulo: string; valor: string | null | undefined }> = ({ rotulo, valor }) => (
  valor ? (
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-[#5B4041]/45">{rotulo}</p>
      <p className="text-[12px] text-[#1E1B11] leading-relaxed whitespace-pre-wrap break-words mt-0.5">{valor}</p>
    </div>
  ) : null
);

const Card: React.FC<{ l: Linha; tipo: LeadTipo }> = ({ l, tipo }) => {
  const [aberta, setAberta] = useState(false);
  const r = l.respostas ?? {};
  const resumo = tipo === 'mentoria'
    ? [r.profissao, r.faturamento, r.urgencia].filter(Boolean).join(' · ')
    : [r.assunto, r.mensagem].filter(Boolean).join(' · ');
  return (
    <div className="rounded-2xl border border-[#BE0D3E]/15 bg-white overflow-hidden">
      <button onClick={() => setAberta(a => !a)} className="w-full text-left px-4 py-3.5 flex items-start gap-3" style={{ WebkitTapHighlightColor: 'transparent' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white text-[13px] font-black"
          style={{ background: tipo === 'mentoria' ? 'linear-gradient(135deg, #D4AF37, #B8860B)' : 'linear-gradient(135deg, #BE0D3E, #94002D)', color: tipo === 'mentoria' ? '#0B0B0C' : 'white' }}>
          {(l.nome || '?').trim().charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black text-[#1E1B11] truncate">{l.nome}</p>
          <p className="text-[10px] text-[#5B4041]/70 truncate mt-0.5">{resumo || '—'}</p>
          <p className="text-[9px] text-[#5B4041]/45 mt-0.5 flex items-center gap-1.5">
            {formatarData(l.created_at)}
            <span className={`rounded-md px-1.5 py-0.5 font-black uppercase tracking-wider ${l.origem === 'link' ? 'bg-[#F6B43A]/25 text-[#8A5A00]' : 'bg-[#BE0D3E]/10 text-[#BE0D3E]'}`}>
              {l.origem === 'link' ? 'pelo link' : 'pelo app'}
            </span>
          </p>
        </div>
        {aberta ? <ChevronUp size={15} className="text-[#5B4041]/50 mt-1" /> : <ChevronDown size={15} className="text-[#5B4041]/50 mt-1" />}
      </button>

      <div className="px-4 pb-3 flex gap-2 flex-wrap">
        {l.whatsapp && (
          <a href={`https://wa.me/55${l.whatsapp}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-[#25D366]/12 text-[#128C4A]">
            <MessageCircle size={11} /> WhatsApp
          </a>
        )}
        {l.instagram && (
          <a href={`https://instagram.com/${l.instagram}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-[#BE0D3E]/10 text-[#BE0D3E]">
            <Instagram size={11} /> @{l.instagram}
          </a>
        )}
      </div>

      {aberta && (
        <div className="px-4 pb-4 pt-3 space-y-3 border-t border-[#BE0D3E]/10">
          <Detalhe rotulo="E-mail" valor={l.email} />
          <div className="grid grid-cols-2 gap-3">
            {CONFIG[tipo].campos.filter(c => (r[c.chave] ?? '').length <= 40).map(c => <Detalhe key={c.chave} rotulo={c.rotulo} valor={r[c.chave]} />)}
          </div>
          {CONFIG[tipo].campos.filter(c => (r[c.chave] ?? '').length > 40).map(c => <Detalhe key={c.chave} rotulo={c.rotulo} valor={r[c.chave]} />)}
        </div>
      )}
    </div>
  );
};

const AdminLeads: React.FC<{ tipo: LeadTipo }> = ({ tipo }) => {
  const cfg = CONFIG[tipo];
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const { data, error } = await supabase.from('leads').select('*').eq('tipo', tipo).order('created_at', { ascending: false });
    setLoading(false);
    if (error) { toast.error('Erro ao carregar', { description: error.message }); return; }
    setLinhas((data ?? []) as Linha[]);
  }, [tipo]);
  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return linhas;
    return linhas.filter(l => [l.nome, l.email, l.instagram, l.whatsapp, ...Object.values(l.respostas ?? {})].some(v => (v ?? '').toLowerCase().includes(q)));
  }, [linhas, busca]);

  const link = `${window.location.origin}${cfg.rota}`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ background: cfg.cor, border: tipo === 'mentoria' ? '1px solid rgba(212,175,55,0.45)' : 'none' }}>
        <div className="flex items-center justify-between relative">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: tipo === 'mentoria' ? '#D4AF37' : '#F6B43A' }}>{cfg.titulo}</p>
            <p className="text-[30px] font-black leading-none mt-1 tabular-nums">{linhas.length}</p>
            <p className="text-[10px] text-white/70 mt-1">{cfg.sub}</p>
          </div>
          <cfg.icone size={34} style={{ color: tipo === 'mentoria' ? '#D4AF37' : 'rgba(255,255,255,0.6)' }} />
        </div>
      </div>

      <div className="rounded-xl bg-white border border-[#BE0D3E]/15 px-3 py-2.5">
        <p className="text-[9px] font-black uppercase tracking-widest text-[#5B4041]/50">Link público</p>
        <div className="flex items-center gap-2 mt-1">
          <code className="flex-1 text-[11px] text-[#1E1B11] truncate">{link}</code>
          <button onClick={() => { navigator.clipboard?.writeText(link); toast.success('Link copiado'); }}
            className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-[#BE0D3E] text-white shrink-0">Copiar</button>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B4041]/40" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, @, e-mail, resposta..."
            className="w-full rounded-xl bg-white border border-[#BE0D3E]/15 pl-9 pr-3 py-2.5 text-[12px] text-[#1E1B11] outline-none focus:border-[#BE0D3E]" />
        </div>
        <button onClick={() => carregar(true)} title="Atualizar" className="w-10 h-10 rounded-xl bg-white border border-[#BE0D3E]/15 flex items-center justify-center text-[#5B4041]">
          <RefreshCw size={14} />
        </button>
      </div>

      <button onClick={() => exportarCsv(tipo, filtradas)} disabled={filtradas.length === 0}
        className="w-full rounded-xl py-3 text-[11px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 disabled:opacity-40"
        style={{ background: 'linear-gradient(180deg, #E63462, #CB1B49)' }}>
        <Download size={14} /> Exportar {busca ? `${filtradas.length} filtradas` : 'tudo'} em CSV
      </button>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#BE0D3E] animate-spin" /></div>
      ) : filtradas.length === 0 ? (
        <p className="text-center text-[12px] text-[#5B4041]/60 py-10">{busca ? 'Nada bate com a busca.' : 'Nenhum registro ainda.'}</p>
      ) : (
        <div className="space-y-2">{filtradas.map(l => <Card key={l.id} l={l} tipo={tipo} />)}</div>
      )}
    </div>
  );
};

export default AdminLeads;
