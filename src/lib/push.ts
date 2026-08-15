import { supabase } from '@/integrations/supabase/client';
import type { SupportedLang } from '@/i18n/LanguageProvider';

/* ═══════════════════════════════════════════════════════════════════════
 *  Push — inscrição do aparelho para receber notificação.
 *
 *  O caminho é sempre o mesmo: pedir permissão → assinar no push service do
 *  navegador → guardar o endereço dessa assinatura no Supabase. Quem dispara
 *  é a edge function `send-push`, que assina com a chave VAPID privada.
 *
 *  No iPhone isto só existe com o app INSTALADO na tela inicial (iOS 16.4+):
 *  no Safari comum `window.PushManager` nem aparece. Por isso o convite é
 *  mostrado depois do tutorial de instalação, não antes.
 * ═══════════════════════════════════════════════════════════════════════ */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/** O navegador tem tudo que o push precisa? */
export const pushSuportado = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/** Configuração de fato pronta (chave pública publicada no build). */
export const pushConfigurado = (): boolean => !!VAPID_PUBLIC_KEY && pushSuportado();

export const permissaoAtual = (): NotificationPermission | null =>
  pushSuportado() ? Notification.permission : null;

/** A chave VAPID viaja em base64url e o navegador quer bytes crus.
 *  O ArrayBuffer é criado explicitamente porque `applicationServerKey` exige
 *  um BufferSource — Uint8Array genérico não satisfaz a tipagem. */
const urlBase64ToBytes = (base64: string): ArrayBuffer => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normal);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
};

const chaveEmBase64 = (sub: PushSubscription, nome: 'p256dh' | 'auth'): string | null => {
  const key = sub.getKey(nome);
  if (!key) return null;
  return window.btoa(String.fromCharCode(...new Uint8Array(key)));
};

export type ResultadoInscricao =
  | { ok: true }
  | { ok: false; motivo: 'sem-suporte' | 'negado' | 'erro' };

/**
 * Pede a permissão e registra o aparelho. Só chame a partir de um clique —
 * Safari e Chrome ignoram `Notification.requestPermission()` fora de um gesto
 * do usuário.
 */
export async function inscreverParaPush(lang: SupportedLang): Promise<ResultadoInscricao> {
  if (!pushConfigurado()) return { ok: false, motivo: 'sem-suporte' };

  try {
    const permissao = await Notification.requestPermission();
    if (permissao !== 'granted') return { ok: false, motivo: 'negado' };

    const registration = await navigator.serviceWorker.ready;

    // Se o aparelho já tem assinatura, reaproveita: assinar de novo geraria
    // outro endpoint e a aluna receberia a mesma notificação duas vezes.
    const existente = await registration.pushManager.getSubscription();
    const sub =
      existente ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(VAPID_PUBLIC_KEY as string),
      }));

    const p256dh = chaveEmBase64(sub, 'p256dh');
    const auth = chaveEmBase64(sub, 'auth');
    if (!p256dh || !auth) return { ok: false, motivo: 'erro' };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, motivo: 'erro' };

    // `endpoint` é único: o mesmo aparelho reinscrevendo atualiza a linha em
    // vez de duplicar (acontece quando o navegador rotaciona a assinatura).
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh,
        auth,
        lang,
        user_agent: navigator.userAgent.slice(0, 300),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );
    if (error) {
      console.warn('push: falha ao salvar inscrição', error);
      return { ok: false, motivo: 'erro' };
    }

    return { ok: true };
  } catch (err) {
    console.warn('push: falha ao inscrever', err);
    return { ok: false, motivo: 'erro' };
  }
}
