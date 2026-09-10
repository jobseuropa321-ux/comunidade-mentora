/* ══════════════════════════════════════════════════════════════
   LEADS — aplicação da mentoria (/mentoria) e suporte (/suporte).

   Os dois gravam na tabela `leads` (tipo + respostas em jsonb) e
   aparecem na aba Fichas do admin. Sem login, a pessoa informa o
   e-mail e a linha entra como origem 'link'.

   Campanha em português — textos direto no código, de propósito.
   ══════════════════════════════════════════════════════════════ */

/** WhatsApp do time comercial (aplicação da mentoria termina aqui). */
export const WHATSAPP_TIME = '34664301875';

/** Grupo de suporte no WhatsApp (formulário de suporte termina aqui). */
export const GRUPO_SUPORTE_URL = 'https://chat.whatsapp.com/JUUOZVbvbLh1vMvDTC4D7P?mode=gi_t';

export type LeadTipo = 'mentoria' | 'suporte';

export interface Lead {
  id?: string;
  user_id?: string | null;
  tipo: LeadTipo;
  origem: 'app' | 'link';
  email: string | null;
  nome: string;
  whatsapp: string;
  instagram: string | null;
  respostas: Record<string, string>;
  created_at?: string;
}

export const linkWhatsappTime = (nome: string, resumo?: string) => {
  const primeiro = nome.trim().split(' ')[0] || '';
  const msg = `Olá! Acabei de preencher a aplicação da mentoria. Meu nome é ${primeiro}${resumo ? ` — ${resumo}` : ''}. Quero acelerar meu negócio com o acompanhamento do time.`;
  return `https://wa.me/${WHATSAPP_TIME}?text=${encodeURIComponent(msg)}`;
};

/* ── Mentoria: perguntas diretas e estratégicas ─────────────────── */
export const MENTORIA = {
  profissao: ['Cabeleireira', 'Manicure', 'Esteticista', 'Sobrancelhas e cílios', 'Maquiadora', 'Barbeiro', 'Massoterapeuta', 'Dona de salão', 'Outra'],
  tempo: ['Ainda vou começar', 'Menos de 1 ano', '1 a 3 anos', '3 a 5 anos', 'Mais de 5 anos'],
  equipe: ['Só eu', '1 a 2 pessoas', '3 a 5 pessoas', 'Mais de 5'],
  faturamento: ['Ainda não faturo', 'Até R$ 2.000', 'R$ 2.000 a 5.000', 'R$ 5.000 a 10.000', 'R$ 10.000 a 20.000', 'R$ 20.000 a 50.000', 'Acima de R$ 50.000'],
  meta: ['R$ 5.000', 'R$ 10.000', 'R$ 20.000', 'R$ 50.000', 'R$ 100.000 ou mais'],
  divida: ['Não tenho', 'Sim, até R$ 5.000', 'Sim, R$ 5.000 a 20.000', 'Sim, acima de R$ 20.000'],
  investimento: ['Até R$ 500', 'R$ 500 a 1.500', 'R$ 1.500 a 3.000', 'R$ 3.000 a 6.000', 'Acima de R$ 6.000'],
  decisao: ['Não, decido sozinha', 'Sim, marido ou companheiro', 'Sim, sócio ou sócia', 'Sim, família'],
  urgencia: ['Quero começar agora', 'Nos próximos 30 dias', 'Nos próximos 3 meses', 'Ainda estou avaliando'],
  jaInvestiu: ['Nunca investi', 'Já fiz curso online', 'Já fiz mentoria', 'Já fiz os dois'],
  dificuldade: ['Poucos clientes', 'Não sei vender', 'Preço baixo demais', 'Agenda desorganizada', 'Sem constância nas redes', 'Sem tempo pra tudo', 'Medo de aparecer', 'Outra'],
} as const;

/** Rótulos das respostas da mentoria (admin e CSV). Ordem = ordem do formulário. */
export const MENTORIA_CAMPOS: { chave: string; rotulo: string }[] = [
  { chave: 'profissao', rotulo: 'Profissão' },
  { chave: 'tempo', rotulo: 'Tempo na área' },
  { chave: 'equipe', rotulo: 'Equipe' },
  { chave: 'cidade', rotulo: 'Cidade' },
  { chave: 'faturamento', rotulo: 'Faturamento mensal' },
  { chave: 'meta', rotulo: 'Meta em 12 meses' },
  { chave: 'divida', rotulo: 'Possui dívida' },
  { chave: 'investimento', rotulo: 'Pode investir por mês' },
  { chave: 'decisao', rotulo: 'Decide junto com alguém' },
  { chave: 'urgencia', rotulo: 'Urgência' },
  { chave: 'ja_investiu', rotulo: 'Já investiu antes' },
  { chave: 'dificuldade', rotulo: 'Maior dificuldade' },
  { chave: 'dificuldade_detalhe', rotulo: 'Detalhe da dificuldade' },
  { chave: 'desejo', rotulo: 'O que deseja alcançar' },
  { chave: 'por_que_agora', rotulo: 'Por que agora' },
];

/* ── Suporte ────────────────────────────────────────────────────── */
export const SUPORTE = {
  assunto: ['Acesso ao app', 'Aulas e conteúdo', 'Pagamento ou plano', 'Ferramentas de IA', 'Ao vivo', 'Outro'],
} as const;

export const SUPORTE_CAMPOS: { chave: string; rotulo: string }[] = [
  { chave: 'assunto', rotulo: 'Assunto' },
  { chave: 'mensagem', rotulo: 'Mensagem' },
];
