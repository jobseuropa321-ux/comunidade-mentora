import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ─────────────────────────────────────────────────────────────────
   ⚙️ CONFIGURAÇÃO — mexa aqui
───────────────────────────────────────────────────────────────── */
const MODEL = 'gpt-5.4-mini';            // modelo OpenAI usado nas respostas
const REASONING_EFFORT = 'low';          // 'low' | 'medium' | 'high'
const MAX_COMPLETION_TOKENS = 6000;      // teto de tokens por resposta
const MAX_MESSAGES_PER_SESSION = 50;     // teto anti-abuso por conversa (esteira: apostila/roteirista usam várias mensagens; ninguém legítimo chega em 50)
/* O LIMITE DIÁRIO de conversas fica no banco (função consume_ai_quota —
   ver BACKEND_SETUP.md). Os PROMPTS dos agentes ficam na tabela viral_models. */

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
   chat-viral — edge function que gera as respostas dos agentes de IA

   Arquitetura:
   1. Recebe { formatSlug, messages, sessionId, segment } do frontend
   2. Busca o prompt do agente na tabela viral_models (via service_role,
      bypassando RLS — o frontend JAMAIS tem acesso ao prompt)
   3. Monta a payload com system: <prompt> + historico do chat
   4. Chama a OpenAI
   5. Devolve apenas o texto gerado

   Erros estruturados que o frontend entende (status 429):
   - { error: 'limite_atingido', limit, used }  → cota diária de conversas
   - { error: 'limite_mensagens', limit }       → máx de mensagens na sessão
───────────────────────────────────────────────────────────────── */

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── AUTH: exige JWT valido ──────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nao autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !anonKey) {
      return new Response(JSON.stringify({ error: 'Erro de configuracao' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sessao invalida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // ────────────────────────────────────────────────────────────

    const { formatSlug, messages, sessionId, segment } = await req.json();

    if (!formatSlug || typeof formatSlug !== 'string') {
      return new Response(JSON.stringify({ error: 'formatSlug obrigatorio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── LIMITE DE MENSAGENS POR SESSAO ──
    const userMessages = Array.isArray(messages)
      ? messages.filter((m: { role: string }) => m.role === 'user')
      : [];
    if (userMessages.length > MAX_MESSAGES_PER_SESSION) {
      return new Response(JSON.stringify({
        error: 'limite_mensagens',
        limit: MAX_MESSAGES_PER_SESSION,
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // ─────────────────────────────────────

    // ── QUOTA: consume_ai_quota via userClient (respeita auth.uid()) ──
    // Sessão inteira = 1 unidade de cota (mensagens seguintes da mesma
    // sessionId não consomem de novo — a RPC deduplica).
    const { data: quota, error: quotaError } = await userClient.rpc('consume_ai_quota', {
      _kind: 'chat-viral',
      _segment: segment ?? null,
      _session_id: sessionId ?? null,
    });
    if (quotaError || !quota?.allowed) {
      const reason = quota?.reason ?? quotaError?.message ?? 'quota_error';
      if (reason === 'daily_limit_reached') {
        return new Response(JSON.stringify({
          error: 'limite_atingido',
          limit: quota?.limit,
          used: quota?.used,
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: reason }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // ──────────────────────────────────────────────────────────────────

    // Supabase client com service_role — bypassa RLS pra ler o prompt
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Erro de configuracao' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: model, error: fetchError } = await supabase
      .from('viral_models')
      .select('prompt')
      .eq('slug', formatSlug)
      .single();

    if (fetchError || !model?.prompt) {
      return new Response(JSON.stringify({ error: 'Modelo nao encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'Erro de configuracao' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiMessages = [
      { role: 'system', content: model.prompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'ia' ? 'assistant' : 'user',
        content: m.content,
      })),
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: openaiMessages,
        reasoning_effort: REASONING_EFFORT,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI error:', data.error?.message);
      throw new Error('Erro ao gerar roteiro');
    }

    const reply = data.choices[0].message.content;

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('chat-viral error:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
