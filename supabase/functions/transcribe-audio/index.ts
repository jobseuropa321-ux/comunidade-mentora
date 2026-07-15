import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* ─────────────────────────────────────────────────────────────────
   transcribe-audio — transcreve a gravação de voz do usuário (o botão
   de microfone do chat) usando Whisper da OpenAI. Devolve { transcription }.
───────────────────────────────────────────────────────────────── */

const WHISPER_MODEL = 'gpt-4o-transcribe';   // ⚙️ modelo de transcrição
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;    // limite do Whisper (25MB)

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

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));
  const jsonError = (message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonError('Não autenticado', 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !anonKey) return jsonError('Erro de configuração', 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return jsonError('Sessão inválida', 401);

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) return jsonError('Erro de configuração', 500);

    const form = await req.formData();
    const whisperLang = 'pt'; // app só em português
    const audio = form.get('audio');

    if (!(audio instanceof File) && !(audio instanceof Blob)) {
      return jsonError('Áudio não enviado', 400);
    }

    if (audio.size === 0) {
      return jsonError('Áudio vazio', 400);
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return jsonError('Áudio muito grande (máx 25MB)', 413);
    }

    const filename = audio instanceof File && audio.name ? audio.name : 'audio.webm';

    const whisperForm = new FormData();
    whisperForm.append('file', audio, filename);
    whisperForm.append('model', WHISPER_MODEL);
    whisperForm.append('language', whisperLang);

    const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: whisperForm,
    });

    if (!whisperResp.ok) {
      console.error('Whisper error:', whisperResp.status, await whisperResp.text());
      return jsonError('Falha na transcrição', 502);
    }

    const whisperData = await whisperResp.json();

    return new Response(
      JSON.stringify({ transcription: whisperData.text ?? '' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('transcribe-audio error:', err);
    return jsonError('Erro interno', 500);
  }
});
