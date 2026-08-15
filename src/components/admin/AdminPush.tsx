import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BellRing, Loader2, Send, Smartphone } from 'lucide-react';
import { useAdminLang } from '@/components/admin/AdminLang';

/* ══════════════════════════════════════════════════════════════
   ADMIN · NOTIFICAÇÕES — escreve e dispara o push.

   O disparo é POR IDIOMA, seguindo o seletor do topo: cada inscrição
   guarda o idioma em que a aluna estava quando permitiu. Sem isso, um
   aviso em português chegaria no celular da aluna espanhola.

   Quem envia de verdade é a edge function `send-push` (ela tem a chave
   VAPID privada). Aqui só montamos o texto e conferimos o alcance.
   ══════════════════════════════════════════════════════════════ */

interface Resultado {
  enviadas: number;
  falhas: number;
  removidas: number;
  total: number;
}

const AdminPush: React.FC = () => {
  const { adminLang: lang, isEs } = useAdminLang();
  const versao = isEs ? 'espanhol' : 'português';

  const [inscritos, setInscritos] = useState<number | null>(null);
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [link, setLink] = useState('');
  const [enviando, setEnviando] = useState<'teste' | 'todas' | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  const contar = useCallback(async () => {
    setInscritos(null);
    const { count, error } = await supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('lang', lang);
    if (error) { toast.error('Erro ao contar aparelhos', { description: error.message }); return; }
    setInscritos(count ?? 0);
  }, [lang]);

  useEffect(() => { contar(); }, [contar]);

  const disparar = async (teste: boolean) => {
    if (titulo.trim().length < 2) { toast.error('Escreva um título'); return; }
    if (texto.trim().length < 2) { toast.error('Escreva o texto do aviso'); return; }

    setEnviando(teste ? 'teste' : 'todas');
    setConfirmar(false);
    const { data, error } = await supabase.functions.invoke<Resultado>('send-push', {
      body: {
        title: titulo.trim(),
        body: texto.trim(),
        // Link vazio manda pra home do idioma certo — quem monta é a function.
        url: link.trim() || undefined,
        lang,
        teste,
      },
    });
    setEnviando(null);

    if (error) { toast.error('Falha no envio', { description: error.message }); return; }
    if (!data) { toast.error('Resposta vazia do servidor'); return; }

    if (data.total === 0) {
      toast('Nenhum aparelho inscrito ainda', { description: `Ninguém permitiu notificação no ${versao}.` });
      return;
    }
    toast.success(`${data.enviadas} de ${data.total} entregues`, {
      description: data.removidas
        ? `${data.removidas} aparelho(s) sem o app foram removidos da lista.`
        : data.falhas ? `${data.falhas} falha(s).` : undefined,
    });
    if (!teste) { setTitulo(''); setTexto(''); setLink(''); }
    contar();
  };

  const inputCls = 'w-full bg-[#FFF7E6] border border-[#BE0D3E]/15 text-[#1E1B11] text-[12px] rounded-xl px-3 py-2 focus:border-[#BE0D3E]/50 focus:outline-none transition-colors';
  const labelCls = 'text-[10px] font-black uppercase tracking-widest text-[#5B4041]';

  return (
    <div className="space-y-4">
      {/* Alcance */}
      <div className="bg-white border border-[#BE0D3E]/15 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#BE0D3E]/10 text-[#BE0D3E] flex items-center justify-center shrink-0">
          <Smartphone size={17} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-black text-[#1E1B11] leading-none">
            {inscritos === null ? '—' : inscritos} aparelho{inscritos === 1 ? '' : 's'}
          </p>
          <p className="text-[10px] text-[#5B4041] mt-1">
            permitiram notificação na versão em {versao}
          </p>
        </div>
      </div>

      {/* Mensagem */}
      <div className="bg-white border border-[#BE0D3E]/15 rounded-2xl p-4 space-y-3">
        <div>
          <label className={labelCls}>Título</label>
          <input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={60}
            placeholder={isEs ? 'Ej: Clase nueva en el aire' : 'Ex: Aula nova no ar'} className={`mt-1.5 ${inputCls}`} />
          <p className="text-[9px] text-[#5B4041]/60 mt-0.5">{titulo.length}/60 · aparece em negrito no celular</p>
        </div>
        <div>
          <label className={labelCls}>Texto</label>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3} maxLength={160}
            placeholder={isEs ? 'Ej: Entra a ver el módulo de posicionamiento.' : 'Ex: Entra pra ver o módulo de posicionamento.'}
            className={`mt-1.5 resize-none ${inputCls}`} />
          <p className="text-[9px] text-[#5B4041]/60 mt-0.5">{texto.length}/160</p>
        </div>
        <div>
          <label className={labelCls}>Para onde o clique leva (opcional)</label>
          <input value={link} onChange={e => setLink(e.target.value)}
            placeholder={isEs ? '/es/home' : '/home'} className={`mt-1.5 ${inputCls}`} />
          <p className="text-[9px] text-[#5B4041]/60 mt-0.5">
            Em branco abre a home do {versao}. Use o caminho do app, ex: {isEs ? '/es/ao-vivo' : '/ao-vivo'}
          </p>
        </div>
      </div>

      {/* Prévia — o que a aluna vê na bandeja */}
      {(titulo || texto) && (
        <div className="bg-[#1E1B11] rounded-2xl p-3 flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#BE0D3E] flex items-center justify-center shrink-0">
            <BellRing size={14} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-black text-white leading-tight break-words">{titulo || '—'}</p>
            <p className="text-[11px] text-white/70 leading-snug mt-0.5 break-words">{texto}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => disparar(true)} disabled={!!enviando}
          className="py-3 rounded-xl bg-white border border-[#BE0D3E]/20 text-[#BE0D3E] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
          {enviando === 'teste' ? <Loader2 size={12} className="animate-spin" /> : <BellRing size={12} />} Testar em mim
        </button>
        <button onClick={() => setConfirmar(true)} disabled={!!enviando || !inscritos}
          className="py-3 rounded-xl bg-gradient-to-r from-[#BE0D3E] to-[#E06B85] text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(190,13,62,0.3)] disabled:opacity-50">
          {enviando === 'todas' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Enviar pra todas
        </button>
      </div>

      <p className="text-[10px] text-[#5B4041] leading-relaxed px-1">
        "Testar em mim" manda só pros seus aparelhos — use antes de disparar pra turma.
        Notificação enviada não volta atrás.
      </p>

      {confirmar && (
        <div className="fixed inset-0 z-[110] bg-[#1E1B11]/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmar(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-black text-[#1E1B11] mb-1">Enviar para {inscritos} aparelho{inscritos === 1 ? '' : 's'}?</h3>
            <p className="text-[12px] text-[#5B4041] leading-relaxed mb-4">
              Vai chegar agora no celular de quem permitiu notificação na versão em {versao}. Não tem como cancelar depois.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmar(false)} className="flex-1 py-2.5 rounded-xl bg-[#F6D6DC] text-[#5B4041] text-[11px] font-black uppercase tracking-widest">Cancelar</button>
              <button onClick={() => disparar(false)} className="flex-1 py-2.5 rounded-xl bg-[#BE0D3E] text-white text-[11px] font-black uppercase tracking-widest">Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPush;
