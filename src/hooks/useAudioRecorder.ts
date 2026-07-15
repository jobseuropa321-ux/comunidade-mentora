import { useCallback, useEffect, useRef, useState } from 'react';

/* Textos de erro (PT) */
const TXT = {
  no_support: 'Seu navegador não suporta gravação de áudio',
  mic_denied: 'Acesso ao microfone negado. Habilita nas configurações do navegador.',
  mic_not_found: 'Nenhum microfone encontrado.',
  start_failed: 'Não foi possível iniciar a gravação.',
};

function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
  ];
  if (typeof MediaRecorder === 'undefined') return '';
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const stopResolverRef = useRef<((blob: Blob | null) => void) | null>(null);
  const cancelledRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const startRecording = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(TXT.no_support);
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      cancelledRef.current = false;

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const blob = cancelledRef.current
          ? null
          : new Blob(chunksRef.current, { type });
        const resolver = stopResolverRef.current;
        stopResolverRef.current = null;
        cleanup();
        if (resolver) resolver(blob);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
      return true;
    } catch (err) {
      cleanup();
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setError(TXT.mic_denied);
      } else if (name === 'NotFoundError') {
        setError(TXT.mic_not_found);
      } else {
        setError(TXT.start_failed);
      }
      return false;
    }
  }, [cleanup]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise(resolve => {
      const rec = recorderRef.current;
      if (!rec || rec.state === 'inactive') {
        resolve(null);
        return;
      }
      stopResolverRef.current = resolve;
      cancelledRef.current = false;
      rec.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') {
      cleanup();
      return;
    }
    cancelledRef.current = true;
    stopResolverRef.current = null;
    rec.stop();
  }, [cleanup]);

  return {
    isRecording,
    recordingTime,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
