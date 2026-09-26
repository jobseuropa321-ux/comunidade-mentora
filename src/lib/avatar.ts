import { supabase } from '@/integrations/supabase/client';
import { prepareImageUpload } from '@/lib/imageCompression';

/* Avatar real (Supabase Storage): a foto comprimida sobe pro bucket público
 * `avatars` no caminho `${userId}/avatar.jpg` (a 1ª pasta = auth.uid(), que é
 * o que as policies de RLS validam — ver docs/backend/). Usado pelo Perfil e
 * pelo onboarding. */
export const AVATAR_PATH = (userId: string) => `${userId}/avatar.jpg`;
export const AVATAR_MAX_BYTES = 25 * 1024 * 1024;

/** Comprime, sobe e devolve a URL pública (com cache-buster pro <img>
 *  recarregar após re-upload). Quem chama persiste em profiles.avatar_url.
 *  Erros de decodificação saem como ImageProcessingError. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  // Avatar é exibido em ~112px max — 400px de largura é mais que suficiente.
  // prepareImageUpload SEMPRE devolve JPEG: o bucket só aceita jpeg/png/webp
  // e o HEIC do iPhone subindo cru era o que dava 400 aqui.
  const jpeg = await prepareImageUpload(file, {
    maxWidth: 400,
    quality: 0.88,
    maxBytes: 1.5 * 1024 * 1024, // bucket `avatars` = 5MB; folga de sobra
  });

  // upsert = sobrescreve a foto anterior. contentType aqui é decorativo: com
  // corpo File o storage-js manda FormData e o mime que vale é o do próprio
  // arquivo (garantido image/jpeg acima).
  const path = AVATAR_PATH(userId);
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, jpeg, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${publicUrl}?t=${Date.now()}`;
}
