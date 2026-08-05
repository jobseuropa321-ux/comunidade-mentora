/* ═════════════════════════════════════════════
   AGENTE 12 · ANALISAR MEU PERFIL  (bônus de viralização)

   Não é chat: a aluna manda uma PRINT do topo do perfil dela no
   Instagram e a IA com VISÃO devolve um parecer de FOTO, NOME DE
   EXIBIÇÃO e BIO, com sugestões prontas pra copiar.

   Fluxo: print → base64 (sem o prefixo data:) → edge function
   `analisar-perfil` (auth + cota de 5/dia + OpenAI com visão) → JSON
   normalizado → os 3 cards.

   Detalhes que NÃO podem sumir daqui (quebram a tela se saírem):
   - manda só o MIOLO do base64; o prefixo `data:` é montado na function;
   - AbortController: timeout de 90s e resposta atrasada é descartada
     (senão uma análise antiga renderiza por cima da tela já limpa);
   - a UI nunca confia no shape cru da IA — quem normaliza é a function.
═════════════════════════════════════════════ */
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, Loader2, Check, Copy, Upload, UserRound, AtSign,
  X, Library as LibraryIcon, Sparkles,
} from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { supabase, SUPABASE_READY } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Robot, ACCENT, type RobotKind } from '@/components/estudio/AgentRobot';
import type { Agent } from '@/data/agents';

/* ── Textos da tela ────────────────────────────────────────────── */
const TXT = {
  subtitle: 'Deixa seu perfil irresistível',
  intro: 'Me mostra seu perfil que eu te ajudo a deixar ele irresistível pras suas futuras alunas 💛 É rapidinho:',
  step1: 'Abra seu perfil no Instagram',
  step2: 'Tire uma print do topo, mostrando sua FOTO, seu NOME e a BIO',
  step3: 'Envie a print aqui embaixo',
  step4: 'Eu analiso e te dou as dicas de ouro ✨',
  upload: 'Enviar print do perfil',
  upload_hint: 'Aceita PNG, JPG ou WEBP — até 10MB · 5 análises por dia',
  analyzing: 'Tô analisando seu perfil 👀',
  analyzing_hint: 'Isso leva uns segundinhos...',
  retry: 'Tentar de novo',
  not_profile: 'Hmm, não consegui enxergar direito seu perfil nessa print 🥺 Tira de novo mostrando sua foto, seu nome e a bio numa imagem só, beleza?',
  foto_label: 'Foto de perfil',
  nome_label: 'Nome de exibição',
  nome_suggestions: 'Sugestões prontas (toque pra copiar)',
  bio_label: 'Bio',
  bio_suggestion: 'Bio sugerida',
  copy_bio: 'Copiar bio',
  copied: 'Copiado!',
  analyze_another: 'Analisar outra print',
  save_library: 'Salvar na Biblioteca',
  saved_library: 'Salvo na Biblioteca',
  saving: 'Salvando...',
  nota_top: 'Tá ótimo!',
  nota_boa: 'Tá bom!',
  nota_dica: 'Dica 💡',
  limit_reached: (limit: number) => `Você já usou suas ${limit} análises de perfil de hoje 💛 Volta amanhã que tem mais!`,
  invalid_file: 'Envie uma imagem (print) do seu perfil.',
  too_large: 'Envie uma print de até 10MB.',
  read_image: 'Não consegui ler essa imagem. Tenta outra print.',
  session_expired: 'Sessão expirada. Faça login novamente.',
  empty_reply: 'A IA não retornou a análise. Tenta de novo.',
  timeout: 'Demorou demais. Tenta de novo.',
  unknown: 'Erro desconhecido',
  backend_pending: 'Análise de perfil disponível quando o backend for conectado 🛠️',
  copy_failed: 'Não consegui copiar. Selecione o texto e copie na mão.',
  toast_saved: 'Salvo na Biblioteca ✨',
  toast_save_error: 'Erro ao salvar',
};

/* ── Shape que a edge function devolve (já normalizado lá) ─────── */
export interface ProfileAnalysis {
  is_perfil: boolean;
  saudacao: string;
  foto: { nota: string; feedback: string };
  nome: { nota: string; feedback: string; sugestoes: string[] };
  bio: { feedback: string; sugestao: string };
  fechamento: string;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const TIMEOUT_MS = 90_000;          // visão + reasoning é lento; 90s é folgado
const DEFAULT_LIMIT = 5;

/* Selo de nota — não existe nota negativa (decisão de produto). */
const nota = (n: string): { bg: string; fg: string; label: string } => {
  if (n === 'otima' || n === 'otimo') return { bg: '#C8F000', fg: '#41520A', label: TXT.nota_top };
  if (n === 'dica') return { bg: '#F6B43A', fg: '#5B3A00', label: TXT.nota_dica };
  return { bg: '#FF2D7A', fg: '#FFFFFF', label: TXT.nota_boa };
};

/* clipboard exige HTTPS; no PWA aberto por IP na rede local cai no fallback */
const copyText = async (text: string): Promise<boolean> => {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
};

/* Vira o texto que fica guardado na Biblioteca. */
const analysisToText = (a: ProfileAnalysis): string => [
  a.saudacao,
  '',
  `**${TXT.foto_label}**`,
  a.foto.feedback,
  '',
  `**${TXT.nome_label}**`,
  a.nome.feedback,
  a.nome.sugestoes.length ? `Sugestões:\n${a.nome.sugestoes.map(s => `• ${s}`).join('\n')}` : '',
  '',
  `**${TXT.bio_label}**`,
  a.bio.feedback,
  a.bio.sugestao ? `Bio sugerida:\n${a.bio.sugestao}` : '',
  '',
  a.fechamento,
].filter(l => l !== undefined && l !== null && l !== '').join('\n');

const AnalisarPerfilAgent: React.FC<{ agent: Agent }> = ({ agent }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const reduce = !!useReducedMotion();
  const kind = agent.category as RobotKind;
  const acc = ACCENT[kind] ?? ACCENT.ganchos;

  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ProfileAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedBio, setCopiedBio] = useState(false);
  const [copiedNomeIdx, setCopiedNomeIdx] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Guarda o AbortController da análise "vigente": aborta a anterior e
  // identifica respostas atrasadas que devem ser ignoradas.
  const abortRef = useRef<AbortController | null>(null);

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAnalyzing(false);
    setPreview(null);
    setResult(null);
    setError(null);
    setSaveState('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* Lê a print, manda pra IA e guarda o parecer. Analisa direto ao escolher
     o arquivo (sem botão "enviar" — menos um passo pra aluna). */
  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError(TXT.invalid_file); return; }
    if (file.size > MAX_BYTES) { setError(TXT.too_large); return; }
    if (!SUPABASE_READY) { setError(TXT.backend_pending); return; }

    setError(null);
    setResult(null);
    setSaveState('idle');
    setAnalyzing(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      // dataUrl pro preview; base64 puro (SEM o prefixo "data:") pra IA
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(TXT.read_image));
        reader.readAsDataURL(file);
      });
      setPreview(dataUrl);
      const comma = dataUrl.indexOf(',');
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error(TXT.session_expired);

      // fetch direto (em vez de supabase.functions.invoke) porque precisamos
      // do AbortController pro timeout/cancelamento.
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

      const response = await fetch(`${supabaseUrl}/functions/v1/analisar-perfil`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: base64,
          image_mime: file.type,
          assistant_name: agent.name,
        }),
        signal: controller.signal,
      });

      let data: {
        analise?: ProfileAnalysis; error?: string; limit?: number; used?: number;
      } | null = null;
      try { data = await response.json(); } catch { data = null; }

      if (abortRef.current !== controller) return; // análise superada

      if (response.status === 429 || data?.error === 'limite_atingido') {
        setError(TXT.limit_reached(data?.limit ?? DEFAULT_LIMIT));
        return;
      }
      if (!response.ok || data?.error) throw new Error(data?.error || `HTTP ${response.status}`);
      if (!data?.analise) throw new Error(TXT.empty_reply);

      setResult(data.analise);
      if (navigator.vibrate) navigator.vibrate(10);
    } catch (err) {
      if (abortRef.current !== controller) return; // abort por reset: não é erro
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const msg = err instanceof Error ? err.message : TXT.unknown;
      console.error('[analisar-perfil]', err);
      setError(isAbort ? TXT.timeout : msg);
    } finally {
      clearTimeout(timeoutId);
      if (abortRef.current === controller) {
        abortRef.current = null;
        setAnalyzing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const copy = async (text: string, cb: () => void) => {
    const ok = await copyText(text);
    if (ok) cb();
    else toast({ title: TXT.copy_failed });
  };

  const saveToLibrary = async () => {
    if (!result || !user || saveState !== 'idle') return;
    if (!SUPABASE_READY) { toast({ title: TXT.backend_pending }); return; }
    setSaveState('saving');
    const title = `Análise do meu perfil — ${new Date().toLocaleDateString('pt-BR')}`;
    const { error: saveError } = await supabase.from('saved_viral_outputs').insert({
      user_id: user.id,
      model_slug: agent.slug,
      model_name: agent.name,
      title,
      user_input: 'Print do topo do meu perfil do Instagram',
      ai_response: analysisToText(result),
    });
    if (saveError) {
      setSaveState('idle');
      toast({ title: TXT.toast_save_error, description: saveError.message, variant: 'destructive' });
      return;
    }
    setSaveState('saved');
    toast({ title: TXT.toast_saved });
  };

  const steps = [TXT.step1, TXT.step2, TXT.step3, TXT.step4];
  const cardBase = 'bg-white border border-[#FF2D7A]/15 rounded-2xl p-4 shadow-[0_10px_26px_-18px_rgba(138,0,64,0.45)]';

  return (
    <div className="fixed inset-0 bg-[#FFF7E6] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Palco do robô */}
      <div className="shrink-0 relative overflow-hidden" style={{ background: agent.gradient }}>
        <button
          onClick={() => navigate('/chat')}
          className="absolute top-3 left-3 z-10 w-8 h-8 flex items-center justify-center text-white/90"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          aria-label="Voltar pro Estúdio"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="absolute top-3.5 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-white backdrop-blur-sm">
          <Sparkles size={9} className="fill-[#C8F000] text-[#C8F000]" /> Bônus
        </span>
        <div className="relative px-4 pt-3 pb-4 flex flex-col items-center">
          <Robot kind={kind} reduce={reduce} />
          <p className="text-white text-[15px] font-black mt-1">{agent.name}</p>
          <p className="text-white/80 text-[11px]">{TXT.subtitle}</p>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />

        {/* Estado 1: instruções + upload */}
        {!analyzing && !result && !error && (
          <>
            <p className="text-[13px] text-[#1E1B11] leading-relaxed mb-4">{TXT.intro}</p>
            <div className="space-y-2.5 mb-5">
              {steps.map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-black"
                    style={{
                      background: i === 3 ? '#C8F000' : '#FF2D7A',
                      color: i === 3 ? '#41520A' : '#FFFFFF',
                    }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-[12.5px] text-[#5B4041] leading-snug pt-0.5">{text}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-[12px] font-black uppercase tracking-widest text-white shadow-[0_8px_20px_-8px_rgba(255,45,122,0.65)] active:scale-[0.98] transition-transform"
              style={{ background: agent.gradient, WebkitTapHighlightColor: 'transparent' }}
            >
              <Camera size={16} strokeWidth={2.5} /> {TXT.upload}
            </button>
            <p className="text-[10px] text-[#5B4041]/60 text-center mt-3 leading-snug">{TXT.upload_hint}</p>
          </>
        )}

        {/* Estado 2: analisando */}
        {analyzing && (
          <div className="flex flex-col items-center text-center py-6">
            {preview && (
              <img
                src={preview}
                alt=""
                className="max-h-44 rounded-2xl border-2 border-[#FF2D7A]/25 mb-4 object-contain"
              />
            )}
            <Loader2 size={26} className="animate-spin mb-2" style={{ color: acc.cta }} />
            <p className="text-[13px] font-bold text-[#1E1B11]">{TXT.analyzing}</p>
            <p className="text-[11px] text-[#5B4041]/70 mt-1">{TXT.analyzing_hint}</p>
          </div>
        )}

        {/* Estado 3: erro / limite */}
        {!analyzing && error && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-[#FEE2E2] flex items-center justify-center mx-auto mb-3">
              <X size={22} className="text-[#DC2626]" strokeWidth={3} />
            </div>
            <p className="text-[13px] text-[#1E1B11] leading-relaxed mb-4">{error}</p>
            <button
              onClick={() => { setError(null); fileInputRef.current?.click(); }}
              className="w-full py-3.5 rounded-2xl text-[12px] font-black uppercase tracking-widest text-white shadow-[0_8px_20px_-8px_rgba(255,45,122,0.65)] active:scale-[0.98] transition-transform"
              style={{ background: agent.gradient, WebkitTapHighlightColor: 'transparent' }}
            >
              {TXT.retry}
            </button>
          </div>
        )}

        {/* Estado 4: resultado */}
        {!analyzing && result && (
          <div className="space-y-3">
            {result.saudacao && (
              <div className="rounded-2xl p-4 border border-[#FF2D7A]/20" style={{ background: 'linear-gradient(135deg, #FFE8F2 0%, #F6FFD9 100%)' }}>
                <p className="text-[13px] text-[#1E1B11] leading-relaxed">{result.saudacao}</p>
              </div>
            )}

            {!result.is_perfil && (
              <div className="bg-[#FFF2CF] border border-[#F6B43A]/45 rounded-2xl p-4">
                <p className="text-[12px] text-[#7A4C00] leading-relaxed">{TXT.not_profile}</p>
              </div>
            )}

            {result.is_perfil && (
              <>
                {/* FOTO */}
                {result.foto.feedback && (
                  <div className={cardBase}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Camera size={14} style={{ color: acc.cta }} />
                        <span className="text-[11px] font-black uppercase tracking-widest text-[#1E1B11]">{TXT.foto_label}</span>
                      </div>
                      <span
                        className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: nota(result.foto.nota).bg, color: nota(result.foto.nota).fg }}
                      >
                        {nota(result.foto.nota).label}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-[#5B4041] leading-relaxed">{result.foto.feedback}</p>
                  </div>
                )}

                {/* NOME DE EXIBIÇÃO */}
                {(result.nome.feedback || result.nome.sugestoes.length > 0) && (
                  <div className={cardBase}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <UserRound size={14} style={{ color: acc.cta }} />
                        <span className="text-[11px] font-black uppercase tracking-widest text-[#1E1B11]">{TXT.nome_label}</span>
                      </div>
                      <span
                        className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: nota(result.nome.nota).bg, color: nota(result.nome.nota).fg }}
                      >
                        {nota(result.nome.nota).label}
                      </span>
                    </div>
                    {result.nome.feedback && (
                      <p className="text-[12.5px] text-[#5B4041] leading-relaxed mb-2.5">{result.nome.feedback}</p>
                    )}
                    {result.nome.sugestoes.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#5B4041]/55">{TXT.nome_suggestions}</p>
                        {result.nome.sugestoes.map((sug, idx) => (
                          <button
                            key={idx}
                            onClick={() => copy(sug, () => {
                              setCopiedNomeIdx(idx);
                              setTimeout(() => setCopiedNomeIdx(null), 1500);
                            })}
                            className="w-full flex items-center justify-between gap-2 text-left bg-[#FFF7E6] border border-[#FF2D7A]/20 rounded-xl px-3 py-2.5 active:scale-[0.99] transition-transform"
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                          >
                            <span className="text-[12px] font-bold text-[#1E1B11] leading-snug">{sug}</span>
                            {copiedNomeIdx === idx
                              ? <Check size={14} className="text-[#6E8B00] shrink-0" strokeWidth={3} />
                              : <Copy size={13} className="shrink-0" style={{ color: acc.cta }} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* BIO */}
                {(result.bio.feedback || result.bio.sugestao) && (
                  <div className={cardBase}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <AtSign size={14} style={{ color: acc.cta }} />
                      <span className="text-[11px] font-black uppercase tracking-widest text-[#1E1B11]">{TXT.bio_label}</span>
                    </div>
                    {result.bio.feedback && (
                      <p className="text-[12.5px] text-[#5B4041] leading-relaxed mb-2.5">{result.bio.feedback}</p>
                    )}
                    {result.bio.sugestao && (
                      <div className="bg-[#FFF7E6] border border-[#FF2D7A]/20 rounded-xl p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#5B4041]/55 mb-1.5">{TXT.bio_suggestion}</p>
                        {/* whitespace-pre-line: a IA usa \n pra quebrar a bio */}
                        <p className="text-[12.5px] text-[#1E1B11] leading-relaxed whitespace-pre-line mb-2.5">{result.bio.sugestao}</p>
                        <button
                          onClick={() => copy(result.bio.sugestao, () => {
                            setCopiedBio(true);
                            setTimeout(() => setCopiedBio(false), 1500);
                          })}
                          className="w-full py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-white active:scale-[0.98] transition-transform"
                          style={{ background: '#FF2D7A', WebkitTapHighlightColor: 'transparent' }}
                        >
                          {copiedBio
                            ? <><Check size={13} strokeWidth={3} /> {TXT.copied}</>
                            : <><Copy size={13} /> {TXT.copy_bio}</>}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {result.fechamento && (
              <p className="text-[12.5px] font-bold text-center leading-relaxed px-2" style={{ color: acc.cta }}>
                {result.fechamento}
              </p>
            )}

            {result.is_perfil && (
              <button
                onClick={saveToLibrary}
                disabled={saveState !== 'idle'}
                className={`w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest transition-all ${
                  saveState === 'saved'
                    ? 'bg-[#EEFFC0] border border-[#C8F000] text-[#41520A]'
                    : 'bg-white border border-[#FF2D7A]/30 text-[#B0004E] active:scale-[0.98]'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {saveState === 'saved'
                  ? <><Check size={14} strokeWidth={3} /> {TXT.saved_library}</>
                  : saveState === 'saving'
                  ? <><Loader2 size={14} className="animate-spin" /> {TXT.saving}</>
                  : <><LibraryIcon size={14} /> {TXT.save_library}</>}
              </button>
            )}

            <button
              onClick={() => { reset(); fileInputRef.current?.click(); }}
              className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest text-white shadow-[0_8px_20px_-8px_rgba(255,45,122,0.65)] active:scale-[0.98] transition-transform"
              style={{ background: agent.gradient, WebkitTapHighlightColor: 'transparent' }}
            >
              <Upload size={14} /> {TXT.analyze_another}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalisarPerfilAgent;
