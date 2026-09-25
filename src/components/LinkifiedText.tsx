import React from 'react';

/** Transforma URLs soltas num texto (http(s):// ou www.) em links clicáveis.
 *  Pontuação no fim (".", ",", ")" etc.) fica fora do link. */
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
const TRAILING_RE = /[.,;:!?)\]}*'"]+$/;

export default function LinkifiedText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const raw = m[0];
    const url = raw.replace(TRAILING_RE, '');
    if (start > last) parts.push(text.slice(last, start));
    const href = url.startsWith('www.') ? `https://${url}` : url;
    parts.push(
      <a key={start} href={href} target="_blank" rel="noopener noreferrer"
        className="text-[#BE0D3E] underline underline-offset-2 break-all">
        {url}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
