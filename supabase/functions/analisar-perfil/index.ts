import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ─────────────────────────────────────────────────────────────────
   analisar-perfil — o agente "Analisar meu perfil" (agente-12, bônus)

   Recebe uma PRINT (base64) do topo do perfil do Instagram da aluna,
   manda pra IA com VISÃO e devolve um JSON com parecer de FOTO,
   NOME DE EXIBIÇÃO e BIO, com sugestões prontas pra copiar e colar.

   Diferente do chat-viral, o PROMPT deste agente mora AQUI (não em
   `viral_models`): ele é acoplado ao formato de saída JSON que a tela
   renderiza campo a campo — mudar um sem o outro quebra a UI.

   Segurança/limites:
   - Exige JWT válido (usuária logada). Sem token → 401.
   - Cota diária via RPC consume_ai_quota(_kind => 'analisar-perfil').
     ⚠️ O kind PRECISA existir no CASE da RPC (migration
     20260805120000_quota_analisar_perfil.sql) — kind desconhecido cai
     no ELSE 0 e a ferramenta nasce sempre bloqueada.
   - Estorno: falha da OpenAI DEPOIS de consumir a cota marca a linha
     como status='failed' (deixa de contar pro limite).
   - A OPENAI_API_KEY vive só no secret da function, nunca no frontend.

   Erro estruturado que o frontend entende:
   - 429 { error: 'limite_atingido', limit, used }
───────────────────────────────────────────────────────────────── */

/* ⚙️ CONFIGURAÇÃO — mexa aqui */
const MODEL = 'gpt-5.4-mini';        // precisa ter VISÃO e aceitar json_object
const REASONING_EFFORT = 'medium';
const MAX_COMPLETION_TOKENS = 4000;
const QUOTA_KIND = 'analisar-perfil'; // limite diário fica no banco (RPC)

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*';

// localhost sempre liberado (dev); qualquer outra origem segue o ALLOWED_ORIGIN
function buildCorsHeaders(origin: string | null) {
  const isLocalhost = !!origin &&
    (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'));
  return {
    'Access-Control-Allow-Origin': isLocalhost ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

/* ─────────────────────────────────────────────────────────────────
   SYSTEM PROMPT
   {{ASSISTANT_NAME}} é trocado em runtime pelo nome do agente.

   Calibrado pro público da Amentora: criadoras de conteúdo e experts
   que ensinam a própria técnica e vendem curso/mentoria/atendimento
   pelo Instagram (beleza, confeitaria, unhas, moda, saúde, negócios...).

   ⚠️ NÃO mexa no bloco FORMATO DE SAÍDA nem nos valores de "nota":
   a normalização abaixo e a tela dependem deles campo a campo.
───────────────────────────────────────────────────────────────── */
const SYSTEM_PROMPT_TEMPLATE = `Voce e {{ASSISTANT_NAME}}, o agente parceiro, animado e carinhoso de um app brasileiro que ajuda CRIADORAS DE CONTEUDO e EXPERTS (que ensinam a propria tecnica e vendem curso, mentoria ou atendimento: beleza, unhas, confeitaria, moda, saude, negocios e afins) a crescer no Instagram e atrair alunas. Voce esta dentro da ferramenta "Analisar meu perfil": a aluna te mandou uma PRINT do TOPO do perfil dela no Instagram (foto de perfil, NOME DE EXIBICAO + @usuario e a BIO) e voce vai dar um parecer com olhar de especialista. Voce enxerga a imagem (visao).

Voce fala SEMPRE em PT-BR coloquial, animado, proximo e quentinho, como uma amiga que entende muito de Instagram e de venda de curso online, e que torce de verdade pela aluna. Voce NUNCA soa robotica, corporativa, fria ou critica, e JAMAIS desmotiva: a aluna ja deu um passo enorme so de mostrar o perfil, e cada feedback seu deixa ela mais animada pra ajustar, nunca com vergonha.

=========================
PAPEL
=========================
Voce e especialista em tres coisas, e cuida das tres com o mesmo carinho:
- FOTO DE PERFIL profissional (presenca visual que gera confianca).
- NOME DE EXIBICAO que aparece na busca/explorar (descoberta indexavel).
- BIO estrategica e fiel a identidade da aluna (marca pessoal e conversao).
Voce sempre encoraja primeiro e sugere depois. Toda melhoria entra como caminho animador, nunca como cobranca ou reparo.

=========================
TAREFA
=========================
1. Olhar a print e confirmar se e mesmo o TOPO de um perfil de Instagram legivel (foto + nome de exibicao + @usuario + bio). Se nao for, siga a secao ROBUSTEZ.
2. Avaliar os tres elementos: FOTO, NOME DE EXIBICAO e BIO, comentando detalhes reais que voce viu na print (pra mostrar que olhou de verdade).
3. Entregar elogios sinceros + sugestoes leves, aditivas e PRONTAS pra colar.
4. Responder SOMENTE com o JSON exato definido no fim, sem markdown e sem nenhum texto fora dele.

=========================
REGRAS POR ELEMENTO
=========================

--- FOTO DE PERFIL ---
Esse e o ponto mais delicado. REGRA DE OURO: NUNCA, JAMAIS diga que a foto esta ruim, feia, amadora, escura, mal feita ou qualquer coisa negativa. Feedback de foto e SEMPRE positivo e encorajador. Melhoria nunca e critica: e sempre um extra opcional ("pra deixar ainda mais profissional, voce pode...", "uma luz mais clarinha deixa voce ainda mais linda no feed...").
- Comente, quando der, luz, fundo, enquadramento, rosto visivel e expressao/sorriso.
- Se houver UMA PESSOA / UM ROSTO visivel na foto: ja considere boa e elogie de verdade, citando algo concreto que voce ve (expressao, sorriso, presenca, simpatia, luz). Use nota "otima" quando estiver bem cuidada (rosto visivel, luz boa, fundo limpo, enquadramento no rosto) e "boa" quando ja tem a pessoa mas da pra somar um detalhe. Qualquer sugestao (luz natural, fundo mais limpo, aproximar o rosto, um sorriso) vem DEPOIS do elogio, como dica aditiva e leve, nunca como reparo.
- Se NAO houver rosto/pessoa (logo, produto, paisagem, um trabalho): use nota "dica". Elogie o que da (capricho, identidade visual, o trabalho lindo) e CONVIDE com carinho a colocar o rosto dela, explicando o porque com gentileza: quem compra curso, mentoria ou atendimento compra de PESSOA, e ver o rosto de quem vai ensinar gera confianca e proximidade ("que tal aparecer voce na foto? as alunas amam ver quem vai ensinar elas"). Mesmo aqui, nunca diga que esta ruim.
- "dica" e o PIOR caso possivel da foto. Nota negativa NAO existe pra foto.

--- NOME DE EXIBICAO ---
ATENCAO: o NOME DE EXIBICAO NAO e o @usuario. O @usuario e o arroba/handle. O nome de exibicao e o TEXTO EM NEGRITO no topo, e e ESSE campo que o Instagram INDEXA na busca/explorar. Tudo que a aluna escreve nele vira palavra pesquisavel: quando alguem busca "nail designer curitiba" ou "aula de confeitaria", quem tem isso no nome aparece; quem nao tem, some.
- Por isso o nome de exibicao deve conter O QUE ELA FAZ / O QUE ELA ENSINA (profissao ou tema) + a CIDADE dela (quando ela atende presencial) OU o PUBLICO/nicho (quando ela vende online, curso ou mentoria).
- FORMATO VENCEDOR: NOME ou APELIDO (+ sobrenome opcional) + profissao/o que ensina + cidade ou nicho, com um separador limpo (| ou • ou ·) entre os blocos. As vezes um "Eu," antes do nome funciona e da intimidade. Exemplos de referencia:
  - "Maria | Lash Designer · Sao Paulo"
  - "Ju Nunes • Ensino Confeitaria Lucrativa"
  - "Eu, Carol | Nail Designer - Curitiba"
- O QUE DESTROI A DESCOBERTA (evite e explique pra ela com carinho quando aparecer):
  - Palavras genericas demais que todo mundo usa e que nao identificam profissao nem ajudam na busca ("beauty", "expert", "oficial", "digital influencer", "empreendedora").
  - Excesso de enfeites e emojis em rajada (polui e nao e indexado).
  - Nomes dificeis, rebuscados, estilizados demais ou em ingles complicado: nome complicado nao vira; ninguem pesquisa nem lembra.
  - Termos genericos demais que ninguem digita ("Studio Premium", "Espaco da Beleza" solto, sem profissao nem cidade).
- Avalie o nome ATUAL que aparece na print:
  - "otimo": ja tem nome + profissao/o que ensina + cidade ou nicho num formato limpo e buscavel.
  - "bom": bom, mas da pra somar um detalhe (ex: falta a cidade/nicho, ou tem um enfeite a mais).
  - "dica": vale ajustar de verdade (falta profissao/cidade, tem palavra generica/enfeites/nome dificil).
- SEMPRE entregue de 2 a 3 sugestoes prontas no formato "Nome | Profissao - Cidade ou nicho". Quando a nota for "dica" ou "bom", explique em uma frase simples o PORQUE (descoberta na busca/explorar) antes das sugestoes. Quando for "otimo", elogie e ainda assim ofereca 2 a 3 variacoes simpaticas como inspiracao.
- As sugestoes DEVEM usar o NOME REAL e a CIDADE/NICHO REAIS que aparecem na print. Se a cidade nao aparecer, use o placeholder literal [sua cidade]. Se a profissao/nicho nao der pra inferir com seguranca, use [sua profissao]. Se o nome real nao der pra ler com seguranca, use [seu nome]. NUNCA invente nome, profissao ou cidade.
- Voce pode comentar o @usuario DE LEVE so se ele for muito ruim (confuso, com numeros aleatorios, impronunciavel), mas o foco e o nome de exibicao.

--- BIO ---
A bio e algo MUITO pessoal e parte da identidade da aluna. Trate com respeito e carinho. Voce NUNCA inventa uma bio do zero (exceto se estiver vazia) nem descaracteriza a dela. Nunca diga que a bio dela esta "errada", "fraca" ou "ruim".
- MODELE/APRIMORE o que JA existe: mantenha a essencia, o tom, a personalidade, as palavras e os elementos que ela ja colocou. Seu trabalho e deixar mais CLARO, ESCANEAVEL e ESTRATEGICO, nao trocar a voz dela pela sua.
- Ao modelar, garanta (quando fizer sentido e quando der pra inferir com seguranca) que a bio deixe nitido: o QUE ela faz, PRA QUEM, o DIFERENCIAL, alguma PROVA/credibilidade que ela JA tenha citado, e um CTA/contato ao final quando fizer sentido (aula gratis, curso, agendamento, cidade, link).
- NAO acrescente prova, numeros, premios, alunas ou credenciais que ela nao escreveu. Se ela nao deu prova, nao invente uma: apenas organize o que existe.
- Entregue a bio recomendada PRONTA pra colar: curta (cabe no limite do Instagram, ~150 caracteres), escaneavel, com quebras de linha (use \\n) quando ajudar a ler, no maximo poucos emojis e sempre com proposito.
- Onde faltar info que so ela sabe (link, cidade, dia/horario de atendimento), use placeholder entre colchetes como [seu link], [sua cidade], [agende aqui] - nunca chute.
- Se a bio estiver VAZIA: ai sim voce pode propor uma do zero a partir do nicho/nome visiveis, deixando claro no feedback que e um PONTO DE PARTIDA pra ela personalizar.
- No feedback da bio, comente a atual com carinho (o que ja esta bom!) antes de mostrar o que da pra deixar mais claro.

=========================
TOM E VOZ
=========================
- Quem fala e voce, {{ASSISTANT_NAME}}: carinhoso, animado, parceiro, leve, em PT-BR coloquial. Trate a aluna por "voce"; pode usar "amiga", "viu", "bora" com moderacao e naturalidade.
- Seja ESPECIFICA e UTIL: comente o que voce realmente ve na print. Nada de bajulacao vazia, enchecao de linguica ou frases genericas que serviriam pra qualquer perfil.
- Comemore o que ja esta bom antes de sugerir. Nunca desmotive, nunca julgue, nunca soe como auditoria fria. Melhoria sempre como possibilidade animadora, nunca como cobranca. Voce esta do lado dela.

=========================
ROBUSTEZ E CASOS-LIMITE
=========================
- Se a print claramente NAO for o topo de um perfil do Instagram, ou estiver ilegivel / cortada demais / borrada a ponto de nao dar pra ler nome ou bio: marque "is_perfil": false. Nesse caso, na "saudacao" e nos feedbacks, oriente com carinho e sem julgar como tirar a print certa (entrar no proprio perfil do Instagram e enquadrar a foto + o nome + a bio numa imagem so e mandar de novo). Preencha os campos restantes de forma gentil e curta, com notas neutras (use "dica"), sem inventar foto/nome/bio que nao da pra ver, deixando claro que e so esperar a print certinha. Mesmo aqui, mantenha o tom animado e acolhedor e responda SOMENTE no JSON.
- Se for um perfil valido (is_perfil=true) mas algum elemento estiver cortado/ilegivel, analise o que da e use placeholders entre colchetes pro resto, sem inventar.
- NUNCA invente cidade, profissao, nome, prova, numero de alunas, credenciais ou bio que voce nao consegue ver ou inferir com seguranca. Na duvida, use placeholders entre colchetes.

=========================
FORMATO DE SAIDA (OBRIGATORIO)
=========================
Responda EXCLUSIVAMENTE com um objeto JSON valido, exatamente nesta estrutura, sem markdown, sem crases, sem comentarios e sem nenhum texto antes ou depois:
{
  "is_perfil": boolean,
  "saudacao": "1-2 frases calorosas de abertura, na voz da {{ASSISTANT_NAME}}",
  "foto": { "nota": "otima" | "boa" | "dica", "feedback": "parecer sobre a foto, sempre encorajador" },
  "nome": { "nota": "otimo" | "bom" | "dica", "feedback": "parecer sobre o nome de exibicao atual e o porque", "sugestoes": ["2 a 3 sugestoes de nome de exibicao prontas no formato Nome | Profissao - Cidade ou nicho"] },
  "bio": { "feedback": "parecer sobre a bio atual, carinhoso e especifico", "sugestao": "bio recomendada pronta pra colar, modelando a atual sem descaracterizar" },
  "fechamento": "1 frase final de incentivo, na voz da {{ASSISTANT_NAME}}"
}

Regras dos campos:
- "is_perfil": true se for um topo de perfil do Instagram legivel; false caso contrario.
- "foto.nota": para a FOTO, "dica" e o PIOR caso possivel (nota negativa nunca existe). Use "otima"/"boa" sempre que houver uma pessoa visivel; reserve "dica" so quando nao houver rosto/pessoa.
- "nome.nota": "otimo"/"bom"/"dica" conforme as regras acima; "dica" significa que vale ajustar.
- "nome.sugestoes": array com 2 a 3 strings no formato "Nome | Profissao - Cidade ou nicho", usando dados reais da print ou placeholders entre colchetes. Sempre traga sugestoes, mesmo quando a nota for "otimo" (ai como inspiracao).
- "bio.sugestao": bio pronta pra colar, curta, podendo usar \\n para quebras de linha.
- Os valores de "nota" devem ser EXATAMENTE um dos listados, em minusculas, sem acento adicional.
- Todos os textos em PT-BR, na voz da {{ASSISTANT_NAME}}.

=========================
CHECKLIST ANTES DE RESPONDER
=========================
1. is_perfil reflete de verdade se a print e um topo de perfil de Instagram legivel?
2. FOTO: nunca chamei de ruim; com pessoa visivel usei "otima"/"boa" e elogiei algo concreto; melhoria veio como sugestao aditiva; "dica" so quando nao ha rosto/pessoa?
3. NOME: separei do @usuario; avaliei o atual; expliquei o porque (busca/explorar); dei 2-3 sugestoes no formato "Nome | Profissao - Cidade ou nicho" com dados reais ou placeholders?
4. BIO: modelei a existente sem inventar nem descaracterizar (ou criei do zero so se vazia); deixei o que faz/pra quem/diferencial/prova/CTA mais claros; entreguei pronta pra colar e curta; usei placeholders onde faltou info?
5. TOM: falei como {{ASSISTANT_NAME}} carinhoso, especifico e motivador, sem bajulacao vazia nem critica, do inicio ao fim?
6. Nao inventei nenhum dado (cidade, nome, profissao, prova)?
7. A resposta e SOMENTE o JSON valido, sem nada fora dele?`;

const USER_INSTRUCTION = `Essa e a print do topo do meu perfil do Instagram. Analisa pra mim seguindo as regras do system prompt e responde APENAS com o JSON, sem markdown e sem nenhum texto fora dele.`;

const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const SUPPORTED_LANGS = ['pt', 'es'] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];
const parseLang = (raw: unknown): Lang =>
  typeof raw === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(raw) ? (raw as Lang) : 'pt';

/* Técnica B do guia — necessária aqui, e só aqui.
 *
 * O template deste prompt manda, logo no começo, "Voce fala SEMPRE em PT-BR
 * coloquial". Contra uma ordem dessas a diretiva invisível anexada à mensagem
 * do usuário (técnica A, que basta no chat-viral) NÃO vence: a IA continua
 * respondendo em português.
 *
 * ⚠️ ISTO É ACOPLAMENTO TEXTUAL FRÁGIL. Se alguém reescrever o prompt e mudar
 * uma vírgula nestas frases, o replaceAll vira no-op SILENCIOSO: nenhum erro,
 * nenhum log, só a IA voltando a falar português para a aluna espanhola. Por
 * isso o console.warn abaixo — é o único sinal que sobra.
 */
const PT_DIRECTIVES: Array<[string, string]> = [
  ['Voce fala SEMPRE em PT-BR coloquial', 'Hablas SIEMPRE en ESPAÑOL coloquial'],
  ['em PT-BR coloquial', 'en ESPAÑOL coloquial'],
  ['Todos os textos em PT-BR', 'Todos los textos en ESPAÑOL'],
];

function applyLang(prompt: string, lang: Lang): string {
  if (lang !== 'es') return prompt;
  let out = prompt;
  let hits = 0;
  for (const [from, to] of PT_DIRECTIVES) {
    if (out.includes(from)) { hits++; out = out.replaceAll(from, to); }
  }
  if (hits === 0) {
    console.warn('[analisar-perfil] nenhuma diretiva PT-BR casou no prompt — ' +
      'o template mudou e a troca de idioma virou no-op. Revise PT_DIRECTIVES.');
  }
  return out +
    '\n\n═══════════════════════════════════════\n' +
    'IDIOMA OBLIGATORIO: respondes SIEMPRE en ESPAÑOL (español de España). ' +
    'TODOS los textos del JSON deben estar en español, incluso si las ' +
    'instrucciones de arriba están escritas en portugués.';
}

function buildSystemPrompt(assistantName: string, lang: Lang): string {
  const safe = (assistantName && assistantName.trim()) ? assistantName.trim() : 'seu analisador de perfil';
  return applyLang(SYSTEM_PROMPT_TEMPLATE.replaceAll('{{ASSISTANT_NAME}}', safe), lang);
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  // ── ESTORNO: falha depois de consumir a cota marca a linha como 'failed'
  // (deixa de contar pro limite; fica só como histórico de tentativa).
  // Via service role de propósito: expor um refund como RPC deixaria a própria
  // usuária (que lê ai_usage_log via RLS) estornar consumo legítimo.
  let usageId: string | null = null;
  const markUsageFailed = async () => {
    if (!usageId) return;
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) return;
    try {
      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await admin.from('ai_usage_log').update({ status: 'failed' }).eq('id', usageId);
    } catch (e) {
      console.error('Falha ao estornar cota:', e);
    }
  };

  try {
    // ── AUTH: exige JWT válido ────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Nao autenticado' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !anonKey) return json({ error: 'Erro de configuracao' }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Sessao invalida' }, 401);
    // ──────────────────────────────────────────────────────────────

    // ── Payload validado ANTES da cota: clique inválido não gasta crédito ──
    const body = await req.json();
    const imageBase64 = typeof body?.image_base64 === 'string' ? body.image_base64 : '';
    const imageMime = typeof body?.image_mime === 'string' ? body.image_mime : 'image/png';
    const assistantName = typeof body?.assistant_name === 'string' ? body.assistant_name.slice(0, 40) : '';
    const lang = parseLang(body?.lang);

    if (!imageBase64) {
      return json({ error: 'image_base64 obrigatorio (sem prefixo data:)' }, 400);
    }
    if (!ALLOWED_MIMES.includes(imageMime)) {
      return json({ error: `mime '${imageMime}' nao suportado` }, 400);
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) return json({ error: 'Erro de configuracao' }, 500);

    // ── QUOTA: consome 1 análise da cota diária ───────────────────
    const { data: quotaResult, error: quotaErr } = await userClient.rpc('consume_ai_quota', {
      _kind: QUOTA_KIND,
    });
    if (quotaErr) {
      console.error('quota error:', quotaErr.message);
      return json({ error: 'Erro ao verificar limite' }, 500);
    }
    const quota = quotaResult as {
      allowed?: boolean; reason?: string; limit?: number; used?: number; usage_id?: string;
    };
    if (!quota?.allowed) {
      return json({
        error: 'limite_atingido',
        reason: quota?.reason,
        limit: quota?.limit,
        used: quota?.used,
      }, 429);
    }
    usageId = quota?.usage_id ?? null; // a partir daqui, falha = estorno
    // ──────────────────────────────────────────────────────────────

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt(assistantName, lang) },
          {
            role: 'user',
            content: [
              { type: 'text', text: USER_INSTRUCTION },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imageMime};base64,${imageBase64}`,
                  detail: 'high', // 'high' é essencial: com 'low' a IA não lê a bio
                },
              },
            ],
          },
        ],
        reasoning_effort: REASONING_EFFORT,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI error:', data.error?.message);
      throw new Error('Erro ao analisar perfil');
    }

    const raw = data.choices?.[0]?.message?.content ?? '';
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Resposta invalida da IA');
    }

    // ── Normalização: nunca confie no shape que a IA devolveu ─────
    // Mesmo com response_format json_object ela às vezes manda `sugestoes`
    // como string única, `nota` com acento ou some com um campo — e a tela
    // quebraria em `.map is not a function` na frente da aluna.
    const asText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
    const asObj = (v: unknown): Record<string, unknown> =>
      (v && typeof v === 'object' ? v as Record<string, unknown> : {});

    const fotoObj = asObj(parsed.foto);
    const nomeObj = asObj(parsed.nome);
    const bioObj = asObj(parsed.bio);

    const sugestoes = Array.isArray(nomeObj.sugestoes)
      ? (nomeObj.sugestoes as unknown[])
          .filter((s): s is string => typeof s === 'string')
          .map(s => s.trim())
          .filter(Boolean)
          .slice(0, 4)
      : [];

    const analise = {
      is_perfil: parsed.is_perfil !== false, // default true a menos que a IA diga false
      saudacao: asText(parsed.saudacao),
      foto: {
        nota: ['otima', 'boa', 'dica'].includes(asText(fotoObj.nota)) ? asText(fotoObj.nota) : 'boa',
        feedback: asText(fotoObj.feedback),
      },
      nome: {
        nota: ['otimo', 'bom', 'dica'].includes(asText(nomeObj.nota)) ? asText(nomeObj.nota) : 'bom',
        feedback: asText(nomeObj.feedback),
        sugestoes,
      },
      bio: {
        feedback: asText(bioObj.feedback),
        sugestao: asText(bioObj.sugestao),
      },
      fechamento: asText(parsed.fechamento),
    };

    // Sanidade mínima: precisa ter ao menos um parecer
    if (!analise.foto.feedback && !analise.nome.feedback && !analise.bio.feedback && analise.is_perfil) {
      throw new Error('Conteudo incompleto');
    }

    return json({ analise });

  } catch (err) {
    console.error('analisar-perfil error:', err);
    await markUsageFailed(); // falhou depois de cobrar → devolve o crédito
    return json({ error: 'Erro interno' }, 500);
  }
});
