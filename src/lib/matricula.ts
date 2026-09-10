import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/* ══════════════════════════════════════════════════════════════
   FICHA DE MATRÍCULA — dados e opções compartilhados entre a página
   /matricula, o botão na aula e a aba do admin.

   Campanha em português: o botão só aparece no app em PT e a página
   tem os textos direto no código (não passa pelo dicionário i18n).
   ══════════════════════════════════════════════════════════════ */

/** Link do grupo onde a aluna garante o ingresso. Vazio = botão do grupo
 *  fica em "em breve" na tela final. */
export const GRUPO_INGRESSO_URL = '';

export interface Matricula {
  id?: string;
  user_id?: string;
  email?: string | null;
  nome: string;
  whatsapp: string;
  instagram: string;
  cidade: string;
  idade: string;
  area_atuacao: string;
  tempo_atuacao: string;
  onde_atende: string;
  faturamento: string;
  meta_faturamento: string;
  sobre_voce: string;
  maior_dificuldade: string;
  motivo_compra: string;
  expectativa: string;
  como_conheceu: string;
  created_at?: string;
  updated_at?: string;
}

export const MATRICULA_VAZIA: Matricula = {
  nome: '', whatsapp: '', instagram: '', cidade: '', idade: '',
  area_atuacao: '', tempo_atuacao: '', onde_atende: '',
  faturamento: '', meta_faturamento: '',
  sobre_voce: '', maior_dificuldade: '',
  motivo_compra: '', expectativa: '', como_conheceu: '',
};

export const OPCOES = {
  idade: ['Até 20', '21 a 30', '31 a 40', '41 a 50', '51+'],
  area: ['Cabelo', 'Unhas', 'Estética', 'Sobrancelhas e cílios', 'Maquiagem', 'Barbearia', 'Massagem e terapias', 'Ainda não atuo', 'Outra'],
  tempo: ['Ainda vou começar', 'Menos de 1 ano', '1 a 3 anos', '3 a 5 anos', 'Mais de 5 anos'],
  onde: ['Salão próprio', 'Em casa', 'A domicílio', 'Alugo cadeira ou sala', 'Online'],
  faturamento: ['Ainda não faturo', 'Até R$ 1.000', 'R$ 1.000 a 3.000', 'R$ 3.000 a 5.000', 'R$ 5.000 a 10.000', 'R$ 10.000 a 20.000', 'Acima de R$ 20.000'],
  meta: ['R$ 3.000', 'R$ 5.000', 'R$ 10.000', 'R$ 20.000', 'R$ 30.000 ou mais'],
  dificuldade: ['Atrair clientes', 'Fechar vendas', 'Postar com constância', 'Precificar', 'Organizar o tempo', 'Insegurança para aparecer', 'Outra'],
  conheceu: ['Instagram', 'YouTube', 'TikTok', 'Anúncio', 'Indicação de amiga', 'Outro'],
} as const;

/** Só dígitos, DDD + número. Aceita colado com máscara. */
export const limparWhatsapp = (v: string) => v.replace(/\D/g, '');

/** (11) 99999-9999 conforme digita. */
export const mascararWhatsapp = (v: string) => {
  const d = limparWhatsapp(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export const limparInstagram = (v: string) => v.trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '');

/** Ficha da aluna logada (null = ainda não preencheu). */
export function useMinhaMatricula() {
  const { user } = useAuth();
  const [matricula, setMatricula] = useState<Matricula | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) { setMatricula(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from('matriculas').select('*').eq('user_id', user.id).maybeSingle();
    setMatricula((data as Matricula | null) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  return { matricula, loading, reload };
}
