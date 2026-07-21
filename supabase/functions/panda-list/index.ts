import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PANDA_BASE = 'https://api-v2.pandavideo.com.br';

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // ── Auth: precisa estar logado E ser expert ──────────────
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

  const { data: roleRow } = await userClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'expert')
    .maybeSingle();
  if (!roleRow) return jsonError('Apenas expert', 403);

  // ── Chama Panda ──────────────────────────────────────────
  const pandaKey = Deno.env.get('PANDA_VIDEO_API_KEY');
  if (!pandaKey) return jsonError('PANDA_VIDEO_API_KEY não configurada', 500);

  // Aceita body JSON (POST do supabase.functions.invoke) OU query string (fetch direto)
  let folderId: string | null = null;
  let search: string | null = null;
  let page = '1';
  let limit = '50';
  try {
    const body = await req.json();
    folderId = body?.folder_id ?? null;
    search = body?.q ?? null;
    page = String(body?.page ?? '1');
    limit = String(body?.limit ?? '50');
  } catch {
    const u = new URL(req.url);
    folderId = u.searchParams.get('folder_id');
    search = u.searchParams.get('q');
    page = u.searchParams.get('page') || '1';
    limit = u.searchParams.get('limit') || '50';
  }

  // Sem folder_id → lista pastas. Com folder_id → lista vídeos da pasta.
  if (!folderId) {
    const r = await fetch(`${PANDA_BASE}/folders`, {
      headers: { Authorization: pandaKey },
    });
    if (!r.ok) {
      const txt = await r.text();
      return jsonError(`Panda /folders falhou (${r.status}): ${txt}`, 502);
    }
    const data = await r.json();
    // Reduz payload: só os campos que precisamos no frontend
    const folders = (data.folders || []).map((f: Record<string, unknown>) => ({
      id: f.id,
      name: f.name,
      parent_folder_id: f.parent_folder_id,
      videos_count: Number(f.videos_count) || 0,
    }));
    // Ordenar alfabético, pastas com vídeos primeiro
    folders.sort((a: { videos_count: number; name: string }, b: { videos_count: number; name: string }) => {
      const av = a.videos_count > 0 ? 0 : 1;
      const bv = b.videos_count > 0 ? 0 : 1;
      if (av !== bv) return av - bv;
      return a.name.localeCompare(b.name);
    });
    return new Response(JSON.stringify({ folders }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Lista vídeos da pasta
  const params = new URLSearchParams({ folder_id: folderId, page, limit });
  if (search) params.set('title', search);
  const r = await fetch(`${PANDA_BASE}/videos?${params.toString()}`, {
    headers: { Authorization: pandaKey },
  });
  if (!r.ok) {
    const txt = await r.text();
    return jsonError(`Panda /videos falhou (${r.status}): ${txt}`, 502);
  }
  const data = await r.json();
  // Reduz payload
  const videos = (data.videos || []).map((v: Record<string, unknown>) => ({
    id: v.id,
    title: v.title,
    length: v.length,
    status: v.status,
    playable: v.playable,
    thumbnail: v.thumbnail,
    video_player: v.video_player,
  }));
  return new Response(JSON.stringify({
    videos,
    page: Number(page),
    pages: data.pages,
    total: data.total,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
