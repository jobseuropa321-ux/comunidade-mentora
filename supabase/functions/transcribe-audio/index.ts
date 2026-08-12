import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* ─────────────────────────────────────────────────────────────────
   transcribe-audio — transcreve a gravação de voz do usuário (o botão
   de microfone do chat) usando Whisper da OpenAI. Devolve { transcription }.
───────────────────────────────────────────────────────────────── */

const WHISPER_MODEL = 'gpt-4o-transcribe';   // ⚙️ modelo de transcrição
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;    // limite do Whisper (25MB)

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*';

/* Idiomas aceitos. O valor vem do cliente, então NUNCA é repassado cru pro
   Whisper: entra nesta lista ou vira 'pt'. */
const SUPPORTED_LANGS = ['pt', 'es'] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];
const parseLang = (raw: unknown): Lang =>
  typeof raw === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(raw) ? (raw as Lang) : 'pt';

/* Mensagens de erro no idioma da aluna.
   O frontend imprime o texto que vem daqui sem tratar, então erro em
   português aparecia cru no meio de uma tela em espanhol. */
const MSG = {
  pt: {
    naoAutenticado: 'Não autenticado',
    configuracao: 'Erro de configuração',
    sessaoInvalida: 'Sessão inválida',
    audioNaoEnviado: 'Áudio não enviado',
    audioVazio: 'Áudio vazio',
    audioGrande: 'Áudio muito grande (máx 25MB)',
    falhaTranscricao: 'Falha na transcrição',
    erroInterno: 'Erro interno',
  },
  es: {
    naoAutenticado: 'No autenticado',
    configuracao: 'Error de configuración',
    sessaoInvalida: 'Sesión no válida',
    audioNaoEnviado: 'No se envió el audio',
    audioVazio: 'Audio vacío',
    audioGrande: 'Audio demasiado grande (máx. 25MB)',
    falhaTranscricao: 'Falló la transcripción',
    erroInterno: 'Error interno',
  },
} as const;

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
  // Começa em pt e é reajustado assim que o formData é lido; erros que
  // acontecem antes disso (auth, config) saem em português mesmo.
  let lang: Lang = 'pt';
  const jsonError = (key: keyof typeof MSG['pt'], status: number) =>
    new Response(JSON.stringify({ error: MSG[lang][key] }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonError('naoAutenticado', 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !anonKey) return jsonError('configuracao', 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return jsonError('sessaoInvalida', 401);

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) return jsonError('configuracao', 500);

    const form = await req.formData();
    // Sem passar o idioma, o Whisper não só chuta como às vezes TRADUZ o
    // áudio em vez de transcrever.
    lang = parseLang(form.get('language'));
    const audio = form.get('audio');

    if (!(audio instanceof File) && !(audio instanceof Blob)) {
      return jsonError('audioNaoEnviado', 400);
    }

    if (audio.size === 0) {
      return jsonError('audioVazio', 400);
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return jsonError('audioGrande', 413);
    }

    const filename = audio instanceof File && audio.name ? audio.name : 'audio.webm';

    const whisperForm = new FormData();
    whisperForm.append('file', audio, filename);
    whisperForm.append('model', WHISPER_MODEL);
    whisperForm.append('language', lang);

    const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: whisperForm,
    });

    if (!whisperResp.ok) {
      console.error('Whisper error:', whisperResp.status, await whisperResp.text());
      return jsonError('falhaTranscricao', 502);
    }

    const whisperData = await whisperResp.json();

    return new Response(
      JSON.stringify({ transcription: whisperData.text ?? '' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('transcribe-audio error:', err);
    return jsonError('erroInterno', 500);
  }
});
