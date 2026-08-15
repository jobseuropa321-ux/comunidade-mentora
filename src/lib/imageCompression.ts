/* Preparo de imagem para upload no Supabase Storage.
 *
 * POR QUE ISSO É ESTRITO (não "fail-open"):
 * os buckets `avatars` e `community-images` têm allowed_mime_types =
 * jpeg/png/webp e limite de tamanho. Quem sobe um arquivo fora disso leva
 * 400 do storage. A versão antiga desta lib devolvia o arquivo ORIGINAL
 * sempre que a compressão falhasse ou fosse pulada — então um HEIC do
 * iPhone (ou um arquivo com file.type vazio, que o iOS também manda) subia
 * cru e o storage recusava. Era isso que quebrava "trocar foto de perfil"
 * só no iPhone.
 *
 * OUTRA ARMADILHA: `supabase.storage.upload(path, file, { contentType })`
 * IGNORA o contentType quando o corpo é File/Blob — o storage-js monta um
 * FormData e o mime que chega no servidor é o `file.type`. Ou seja: quem
 * garante o mime aceito é este módulo, não a opção do upload.
 *
 * Contrato: prepareImageUpload SEMPRE devolve um File image/jpeg dentro do
 * limite de bytes, ou lança ImageProcessingError. Nunca devolve o original
 * em formato duvidoso.
 */

export type ImageFailureReason =
  | 'not_image'  // não é imagem (ou é um formato que o navegador não decodifica)
  | 'decode'     // falhou ao decodificar o arquivo
  | 'encode'     // falhou ao gerar o JPEG
  | 'too_large'; // não coube no limite nem no menor tamanho aceitável

export class ImageProcessingError extends Error {
  constructor(readonly reason: ImageFailureReason) {
    super(`image processing failed: ${reason}`);
    this.name = 'ImageProcessingError';
  }
}

interface PrepareOptions {
  /** Largura máxima do resultado (a altura acompanha a proporção). */
  maxWidth?: number;
  /** Qualidade inicial do JPEG (cai sozinha se o arquivo não couber). */
  quality?: number;
  /** Teto de bytes — deve ficar ABAIXO do file_size_limit do bucket. */
  maxBytes?: number;
}

/** Extensões que valem tentar decodificar mesmo com file.type vazio.
 *  O iOS costuma mandar type '' para HEIC vindo do app Arquivos. */
const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|avif|gif|bmp|tiff?)$/i;

/**
 * Converte qualquer imagem que o navegador consiga decodificar (inclusive
 * HEIC no Safari) em um JPEG dentro do limite de bytes.
 */
export async function prepareImageUpload(
  file: File,
  { maxWidth = 1080, quality = 0.85, maxBytes = 4 * 1024 * 1024 }: PrepareOptions = {},
): Promise<File> {
  const looksLikeImage = file.type.startsWith('image/') || IMAGE_EXT.test(file.name);
  if (!looksLikeImage) throw new ImageProcessingError('not_image');

  const decoded = await decodeImage(file);
  try {
    const { width: srcW, height: srcH } = decoded;
    if (!srcW || !srcH) throw new ImageProcessingError('decode');

    // Atalho: já é exatamente o que a gente produziria (JPEG, no tamanho, no peso).
    if (file.type === 'image/jpeg' && srcW <= maxWidth && file.size <= maxBytes) return file;

    const ratio = Math.min(1, maxWidth / srcW);
    let w = Math.max(1, Math.round(srcW * ratio));
    let h = Math.max(1, Math.round(srcH * ratio));

    // Tenta na qualidade pedida; se estourar o limite, baixa a qualidade e,
    // em último caso, as dimensões. Um print de celular sempre cabe já na 1ª.
    for (let attempt = 0; attempt < 4; attempt++) {
      const canvas = drawToCanvas(decoded.source, w, h);
      if (!canvas) throw new ImageProcessingError('encode');

      let q = attempt === 0 ? quality : 0.75;
      for (let step = 0; step < 4; step++) {
        const blob = await canvasToJpeg(canvas, q);
        if (!blob) break;
        if (blob.size <= maxBytes) return asJpegFile(blob, file.name);
        q -= 0.15;
        if (q < 0.4) break;
      }
      // Ainda pesado: metade das dimensões e tenta de novo.
      w = Math.max(1, Math.round(w / 2));
      h = Math.max(1, Math.round(h / 2));
      if (w < 64) break;
    }
    throw new ImageProcessingError('too_large');
  } finally {
    decoded.release();
  }
}

/* ── decodificação ───────────────────────────────────────────────────── */

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

/** createImageBitmap primeiro (mais leve e respeita EXIF); <img> como plano B.
 *  Nenhum dos dois usa data URL — no iOS uma foto de 5MB viraria uma string
 *  de ~7MB e é justamente aí que o Safari desistia da conversão. */
async function decodeImage(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close?.(),
      };
    } catch {
      /* Safari antigo / HEIC não suportado aqui: cai pro <img>. */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new ImageProcessingError('decode'));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err instanceof ImageProcessingError ? err : new ImageProcessingError('decode');
  }
}

/* ── canvas → JPEG ───────────────────────────────────────────────────── */

function drawToCanvas(source: CanvasImageSource, w: number, h: number): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // JPEG não tem transparência: sem esse fundo branco, um PNG transparente
  // (avatar recortado, por exemplo) sairia com fundo preto.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

/** toBlob é o caminho normal; toDataURL é o plano B porque em algumas versões
 *  do Safari o toBlob devolve null sem erro nenhum. */
async function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  const viaBlob = await new Promise<Blob | null>(resolve => {
    try {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    } catch {
      resolve(null);
    }
  });
  if (viaBlob && viaBlob.size > 0) return viaBlob;

  try {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (!dataUrl.startsWith('data:image/jpeg')) return null;
    return dataUrlToBlob(dataUrl);
  } catch {
    return null;
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}

function asJpegFile(blob: Blob, originalName: string): File {
  const base = originalName.replace(/\.[^.]+$/, '') || 'foto';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}
