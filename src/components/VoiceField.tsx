import React, { useEffect, useRef, useState } from 'react';
import { Mic, Loader2, X, Square } from 'lucide-react';
import { supabase, SUPABASE_READY } from '@/integrations/supabase/client';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useToast } from '@/hooks/use-toast';
import { useCurrentLang } from '@/i18n/LanguageProvider';
import { useTranslation } from 'react-i18next';

/* ─────────────────────────────────────────────────────────────
   Campo de texto (input OU textarea) com MICROFONE embutido.
   Grava a voz → manda pra edge function `transcribe-audio` (Whisper
   via OpenAI) → o texto transcrito é ANEXADO ao que já está escrito.
   Reaproveita a mesma infra do chat (useAudioRecorder + transcribe-audio).
   Use em qualquer lugar que a pessoa escreve: formulários, admin, feed...
   ───────────────────────────────────────────────────────────── */

interface VoiceFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** true = <textarea> (padrão), false = <input> de uma linha */
  multiline?: boolean;
  rows?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  /** classes extras pro campo (cores/borda já vêm no padrão da marca) */
  className?: string;
  maxLength?: number;
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const VoiceField: React.FC<VoiceFieldProps> = ({
  value, onChange, placeholder, multiline = true, rows = 4, autoFocus, disabled, className = '', maxLength,
}) => {
  const { toast } = useToast();
  const lang = useCurrentLang();
  const { t } = useTranslation();
  const [transcribing, setTranscribing] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const {
    isRecording, recordingTime, error: recorderError,
    startRecording, stopRecording, cancelRecording,
  } = useAudioRecorder();

  // recorderError é uma CHAVE de tradução (ver useAudioRecorder).
  useEffect(() => { if (recorderError) toast({ title: t(recorderError) }); }, [recorderError, toast, t]);

  const handleMic = async () => {
    if (transcribing || disabled) return;
    if (isRecording) {
      const blob = await stopRecording();
      if (!blob) return;
      setTranscribing(true);
      try {
        const form = new FormData();
        const ext = (blob.type.split('/')[1] || 'webm').split(';')[0];
        form.append('audio', blob, `audio.${ext}`);
        // Sem isso o Whisper chuta o idioma e às vezes traduz o áudio.
        form.append('language', lang);
        const { data, error } = await supabase.functions.invoke('transcribe-audio', { body: form });
        if (error) throw error;
        const text = (data?.transcription ?? '').trim();
        if (!text) { toast({ title: t('audio.naoEntendi') }); return; }
        const next = value.trim() ? `${value.trim()} ${text}` : text;
        onChange(maxLength ? next.slice(0, maxLength) : next);
        requestAnimationFrame(() => fieldRef.current?.focus());
      } catch (err) {
        const msg = err instanceof Error ? err.message : t('audio.erroTranscrever');
        toast({ title: t('audio.falhaTranscricao'), description: msg });
      } finally {
        setTranscribing(false);
      }
    } else {
      if (!SUPABASE_READY) { toast({ title: t('audio.backendPendente') }); return; }
      await startRecording();
    }
  };

  const base =
    `w-full bg-white border-2 border-[#BE0D3E]/20 focus:border-[#BE0D3E] rounded-2xl outline-none ` +
    `transition-colors text-[14px] text-[#1E1B11] placeholder:text-[#5B4041]/40 disabled:opacity-70 ${className}`;

  // mic no canto: embaixo-direita no textarea, centralizado à direita no input
  const anchor = multiline ? 'bottom-2.5 right-2.5' : 'top-1/2 -translate-y-1/2 right-2';

  return (
    <div className="relative">
      {multiline ? (
        <textarea
          ref={fieldRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={transcribing ? t('chat.transcribing') : placeholder}
          autoFocus={autoFocus}
          rows={rows}
          disabled={disabled || transcribing}
          maxLength={maxLength}
          className={`${base} px-4 py-3 pr-12 resize-none leading-relaxed`}
        />
      ) : (
        <input
          ref={fieldRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={transcribing ? 'Transcrevendo...' : placeholder}
          autoFocus={autoFocus}
          disabled={disabled || transcribing}
          maxLength={maxLength}
          className={`${base} px-4 py-3 pr-12`}
        />
      )}

      {isRecording ? (
        <div className={`absolute ${anchor} flex items-center gap-1.5 bg-white rounded-full border border-[#BE0D3E]/20 pl-2 pr-1 py-1 shadow-sm`}>
          <button type="button" onClick={cancelRecording} aria-label={t('a11y.cancelarGravacao')}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-[#1E1B11]/5">
            <X size={12} className="text-[#1E1B11]" />
          </button>
          <span className="flex items-center gap-1 text-[11px] font-mono tabular-nums text-[#1E1B11]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#BE0D3E] animate-pulse" /> {fmtTime(recordingTime)}
          </span>
          <button type="button" onClick={handleMic} aria-label="Parar e transcrever"
            className="w-7 h-7 flex items-center justify-center rounded-full" style={{ background: '#BE0D3E' }}>
            <Square size={10} className="text-white" fill="white" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleMic}
          disabled={disabled || transcribing}
          aria-label={t('a11y.gravarTranscrever')}
          className={`absolute ${anchor} w-8 h-8 flex items-center justify-center rounded-xl bg-[#BE0D3E]/[0.08] hover:bg-[#BE0D3E]/15 disabled:opacity-40 transition-colors`}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {transcribing
            ? <Loader2 size={15} className="text-[#BE0D3E] animate-spin" />
            : <Mic size={15} className="text-[#BE0D3E]" />}
        </button>
      )}
    </div>
  );
};

export default VoiceField;
