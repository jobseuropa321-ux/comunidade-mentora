// Normaliza o que a usuária digitar (com @, sem @, ou URL colada) num handle limpo.
// Ex: "@maria", "maria", "https://instagram.com/maria/" -> "maria"
export function normalizeInstagramHandle(raw: string | null | undefined): string {
  if (!raw) return '';
  let v = raw.trim();
  // Remove URL completa do instagram, se colarem
  v = v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
  // Remove @, barras e espaços nas pontas
  v = v.replace(/[@/\s]/g, '');
  // Instagram permite letras, números, ponto e underscore
  v = v.replace(/[^A-Za-z0-9._]/g, '');
  return v;
}

export function instagramUrl(handle: string | null | undefined): string | null {
  const h = normalizeInstagramHandle(handle);
  return h ? `https://instagram.com/${h}` : null;
}
