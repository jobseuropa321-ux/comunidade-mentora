import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Download, Search, ChevronDown, ChevronUp, Instagram, MessageCircle, Ticket } from 'lucide-react';
import type { Matricula } from '@/lib/matricula';

/* ══════════════════════════════════════════════════════════════
   ADMIN · MATRÍCULAS — as fichas preenchidas em /matricula.

   Lê a tabela `matriculas` (RLS: só expert vê todas) e exporta CSV
   com ponto e vírgula, que o Excel em português abre direto.
   ══════════════════════════════════════════════════════════════ */

type Linha = Matricula & { id: string; created_at: string };

const COLUNAS: { chave: keyof Linha; rotulo: string }[] = [
  { chave: 'created_at', rotulo: 'Data' },
  { chave: 'nome', rotulo: 'Nome' },
  { chave: 'email', rotulo: 'E-mail' },
  { chave: 'whatsapp', rotulo: 'WhatsApp' },
  { chave: 'instagram', rotulo: 'Instagram' },
  { chave: 'cidade', rotulo: 'Cidade' },
  { chave: 'idade', rotulo: 'Idade' },
  { chave: 'area_atuacao', rotulo: 'Área' },
  { chave: 'tempo_atuacao', rotulo: 'Tempo de atuação' },
  { chave: 'onde_atende', rotulo: 'Onde atende' },
  { chave: 'faturamento', rotulo: 'Faturamento' },
  { chave: 'meta_faturamento', rotulo: 'Meta 6 meses' },
  { chave: 'sobre_voce', rotulo: 'Sobre ela' },
  { chave: 'maior_dificuldade', rotulo: 'Maior dificuldade' },
  { chave: 'motivo_compra', rotulo: 'O que fez comprar' },
  { chave: 'expectativa', rotulo: 'Expectativa' },
  { chave: 'como_conheceu', rotulo: 'Como conheceu' },
  { chave: 'origem', rotulo: 'Origem' },
];

const formatarData = (iso: string) => {
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

const csvCelula = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const exportarCsv = (linhas: Linha[]) => {
  const cab = COLUNAS.map(c => c.rotulo).join(';');
  const corpo = linhas.map(l => COLUNAS.map(c => csvCelula(c.chave === 'created_at' ? formatarData(l.created_at) : c.chave === 'origem' ? (l.origem === 'link' ? 'Link público' : 'App') : l[c.chave])).join(';'));
  const blob = new Blob(['﻿' + [cab, ...corpo].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `matriculas-${new Date().toISOString().slice(0, 10)}.csv`;
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

const Ficha: React.FC<{ l: Linha }> = ({ l }) => {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="rounded-2xl border border-[#BE0D3E]/15 bg-white overflow-hidden">
      <button onClick={() => setAberta(a => !a)} className="w-full text-left px-4 py-3.5 flex items-start gap-3"
        style={{ WebkitTapHighlightColor: 'transparent' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white text-[13px] font-black"
          style={{ background: 'linear-gradient(135deg, #BE0D3E, #94002D)' }}>
          {(l.nome || '?').trim().charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black text-[#1E1B11] truncate">{l.nome}</p>
          <p className="text-[10px] text-[#5B4041]/70 truncate mt-0.5">{l.area_atuacao} · {l.faturamento}</p>
          <p className="text-[9px] text-[#5B4041]/45 mt-0.5 flex items-center gap-1.5">
            {formatarData(l.created_at)}
            <span className={`rounded-md px-1.5 py-0.5 font-black uppercase tracking-wider ${l.origem === 'link' ? 'bg-[#F6B43A]/25 text-[#8A5A00]' : 'bg-[#BE0D3E]/10 text-[#BE0D3E]'}`}>
              {l.origem === 'link' ? 'pelo link' : 'pelo app'}
            </span>
          </p>
        </div>
        {aberta ? <ChevronUp size={15} className="text-[#5B4041]/50 mt-1" /> : <ChevronDown size={15} className="text-[#5B4041]/50 mt-1" />}
      </button>

      <div className="px-4 pb-3 flex gap-2">
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
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-[#BE0D3E]/10">
          <div className="grid grid-cols-2 gap-3 pt-3">
            <Detalhe rotulo="E-mail" valor={l.email} />
            <Detalhe rotulo="Cidade" valor={l.cidade} />
            <Detalhe rotulo="Idade" valor={l.idade} />
            <Detalhe rotulo="Tempo de atuação" valor={l.tempo_atuacao} />
            <Detalhe rotulo="Onde atende" valor={l.onde_atende} />
            <Detalhe rotulo="Meta 6 meses" valor={l.meta_faturamento} />
            <Detalhe rotulo="Maior dificuldade" valor={l.maior_dificuldade} />
            <Detalhe rotulo="Como conheceu" valor={l.como_conheceu} />
          </div>
          <Detalhe rotulo="Sobre ela" valor={l.sobre_voce} />
          <Detalhe rotulo="O que fez comprar" valor={l.motivo_compra} />
          <Detalhe rotulo="Expectativa" valor={l.expectativa} />
        </div>
      )}
    </div>
  );
};

const AdminMatriculas: React.FC = () => {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [origem, setOrigem] = useState<'todas' | 'app' | 'link'>('todas');

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const { data, error } = await supabase.from('matriculas').select('*').order('created_at', { ascending: false });
    setLoading(false);
    if (error) { toast.error('Erro ao carregar as fichas', { description: error.message }); return; }
    setLinhas((data ?? []) as Linha[]);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = origem === 'todas' ? linhas : linhas.filter(l => (l.origem ?? 'app') === origem);
    if (!q) return base;
    return base.filter(l => [l.nome, l.email, l.instagram, l.whatsapp, l.cidade, l.area_atuacao].some(v => (v ?? '').toLowerCase().includes(q)));
  }, [linhas, busca, origem]);
  const totalLink = linhas.filter(l => l.origem === 'link').length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #BE0D3E 0%, #94002D 100%)' }}>
        <div className="absolute -top-8 -right-6 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.22), transparent 65%)' }} />
        <div className="flex items-center justify-between relative">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-[#F6B43A]">Fichas de matrícula</p>
            <p className="text-[30px] font-black leading-none mt-1 tabular-nums">{linhas.length}</p>
            <p className="text-[10px] text-white/70 mt-1">ficha{linhas.length === 1 ? '' : 's'} · {linhas.length - totalLink} pelo app · {totalLink} pelo link</p>
          </div>
          <Ticket size={34} className="text-white/60" />
        </div>
      </div>

      <div className="rounded-xl bg-white border border-[#BE0D3E]/15 px-3 py-2.5">
        <p className="text-[9px] font-black uppercase tracking-widest text-[#5B4041]/50">Link público da ficha</p>
        <div className="flex items-center gap-2 mt-1">
          <code className="flex-1 text-[11px] text-[#1E1B11] truncate">{`${window.location.origin}/ficha`}</code>
          <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/ficha`); toast.success('Link copiado'); }}
            className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-[#BE0D3E] text-white shrink-0">Copiar</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 bg-[#F6D6DC]/50 p-1 rounded-xl">
        {([['todas', 'Todas'], ['app', 'Pelo app'], ['link', 'Pelo link']] as const).map(([id, rotulo]) => (
          <button key={id} onClick={() => setOrigem(id)}
            className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${origem === id ? 'bg-white text-[#BE0D3E] shadow-sm' : 'text-[#5B4041]/70'}`}>
            {rotulo}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B4041]/40" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, @, e-mail, cidade..."
            className="w-full rounded-xl bg-white border border-[#BE0D3E]/15 pl-9 pr-3 py-2.5 text-[12px] text-[#1E1B11] outline-none focus:border-[#BE0D3E]" />
        </div>
        <button onClick={() => carregar(true)} title="Atualizar"
          className="w-10 h-10 rounded-xl bg-white border border-[#BE0D3E]/15 flex items-center justify-center text-[#5B4041]">
          <RefreshCw size={14} />
        </button>
      </div>

      <button onClick={() => exportarCsv(filtradas)} disabled={filtradas.length === 0}
        className="w-full rounded-xl py-3 text-[11px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 disabled:opacity-40"
        style={{ background: 'linear-gradient(180deg, #E63462, #CB1B49)' }}>
        <Download size={14} /> Exportar {busca ? `${filtradas.length} filtradas` : 'tudo'} em CSV
      </button>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#BE0D3E] animate-spin" /></div>
      ) : filtradas.length === 0 ? (
        <p className="text-center text-[12px] text-[#5B4041]/60 py-10">{busca ? 'Nenhuma ficha bate com a busca.' : 'Nenhuma ficha preenchida ainda.'}</p>
      ) : (
        <div className="space-y-2">{filtradas.map(l => <Ficha key={l.id} l={l} />)}</div>
      )}
    </div>
  );
};

export default AdminMatriculas;
