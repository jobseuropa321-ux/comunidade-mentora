interface CompressOptions {
  maxWidth?: number;
  quality?: number;
}

/**
 * Comprime imagem via canvas API nativa: redimensiona + reencoda como JPEG.
 * - Pula GIFs (animação seria perdida) e arquivos não-imagem.
 * - Pula imagens pequenas que já cabem em maxWidth e estão abaixo de 1.2MB.
 * - Se a "compressão" gerar arquivo maior que o original (raro), retorna o original.
 * - Em caso de erro, retorna o original (fail-open).
 */
export async function compressImage(
  file: File,
  { maxWidth = 1080, quality = 0.85 }: CompressOptions = {},
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  try {
    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);
    const ratio = Math.min(1, maxWidth / img.naturalWidth);

    if (ratio === 1 && file.size < 1.2 * 1024 * 1024) return file;

    const w = Math.round(img.naturalWidth * ratio);
    const h = Math.round(img.naturalHeight * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
    if (!blob) return file;
    if (blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch (err) {
    console.error('compressImage failed, using original', err);
    return file;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}
