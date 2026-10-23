/* Exportação das notas da Biblioteca (copiar, PDF, Word, WhatsApp).
 *
 * O conteúdo salvo é o markdown que a IA devolve — e continua sendo, porque o
 * Chat reinjeta esse texto como contexto (esqueleto do curso, aulas). Por isso
 * tudo aqui parte do markdown: um parser pequeno que entende só o que a IA
 * realmente usa (títulos, listas, divisória, negrito/itálico/riscado) e gera
 * cada formato a partir dos mesmos blocos.
 *
 * jspdf e docx são pesados: entram por import() só quando a aluna exporta. */

export interface Run { text: string; bold?: boolean; italic?: boolean; strike?: boolean }

export type Block =
  | { kind: 'heading'; level: number; runs: Run[] }
  | { kind: 'para'; runs: Run[] }
  | { kind: 'bullet'; depth: number; runs: Run[] }
  | { kind: 'ordered'; depth: number; n: string; runs: Run[] }
  | { kind: 'hr' }
  | { kind: 'blank' };

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

// O editor escapa caracteres de markdown ao salvar ("1\." , "\*"); aqui volta.
const unescape = (s: string) => s.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1');

export const parseInline = (text: string): Run[] =>
  text.split(INLINE).filter(Boolean).map(p => {
    if (/^(\*\*|__).+\1$/.test(p)) return { text: unescape(p.slice(2, -2)), bold: true };
    if (/^~~.+~~$/.test(p)) return { text: unescape(p.slice(2, -2)), strike: true };
    if (/^([*_]).+\1$/.test(p)) return { text: unescape(p.slice(1, -1)), italic: true };
    return { text: unescape(p) };
  });

export const parseBlocks = (md: string): Block[] =>
  md.replace(/\r/g, '').split('\n').map((linha): Block => {
    if (!linha.trim()) return { kind: 'blank' };
    if (/^\s*([-*_])\1{2,}\s*$/.test(linha)) return { kind: 'hr' };
    const h = /^\s*(#{1,6})\s+(.*)$/.exec(linha);
    if (h) return { kind: 'heading', level: h[1].length, runs: parseInline(h[2]) };
    const indent = (s: string) => Math.min(3, Math.floor(s.replace(/\t/g, '  ').length / 2));
    const b = /^(\s*)[-*+•]\s+(?:\[[ xX]\]\s+)?(.*)$/.exec(linha);
    if (b) return { kind: 'bullet', depth: indent(b[1]), runs: parseInline(b[2]) };
    const o = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(linha);
    if (o) return { kind: 'ordered', depth: indent(o[1]), n: o[2], runs: parseInline(o[3]) };
    return { kind: 'para', runs: parseInline(linha.replace(/\\$/, '')) };
  });

const plain = (runs: Run[]) => runs.map(r => r.text).join('');

/* Texto pra colar no WhatsApp/Instagram: lá *negrito* é com um asterisco só e
   títulos não existem, então viram linha em negrito. */
export const toWhatsappText = (md: string) =>
  parseBlocks(md).map(b => {
    const fmt = (runs: Run[]) => runs.map(r =>
      r.bold ? `*${r.text.trim()}*` : r.italic ? `_${r.text.trim()}_` : r.strike ? `~${r.text.trim()}~` : r.text,
    ).join('');
    switch (b.kind) {
      case 'heading': return `*${plain(b.runs).trim()}*`;
      case 'bullet': return `${'   '.repeat(b.depth)}• ${fmt(b.runs)}`;
      case 'ordered': return `${'   '.repeat(b.depth)}${b.n}. ${fmt(b.runs)}`;
      case 'hr': return '────────';
      case 'blank': return '';
      default: return fmt(b.runs);
    }
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* HTML pro clipboard: colando no Google Docs, Word, Notas ou Pages a
   formatação vem junto. */
export const toHtml = (md: string) => {
  const inl = (runs: Run[]) => runs.map(r => {
    let t = esc(r.text);
    if (r.bold) t = `<strong>${t}</strong>`;
    if (r.italic) t = `<em>${t}</em>`;
    if (r.strike) t = `<s>${t}</s>`;
    return t;
  }).join('');
  const out: string[] = [];
  let lista: 'ul' | 'ol' | null = null;
  const fecha = () => { if (lista) { out.push(`</${lista}>`); lista = null; } };
  for (const b of parseBlocks(md)) {
    if (b.kind === 'bullet' || b.kind === 'ordered') {
      const tag = b.kind === 'bullet' ? 'ul' : 'ol';
      if (lista !== tag) { fecha(); out.push(`<${tag}>`); lista = tag; }
      out.push(`<li>${inl(b.runs)}</li>`);
      continue;
    }
    fecha();
    if (b.kind === 'heading') out.push(`<h${Math.min(b.level, 3)}>${inl(b.runs)}</h${Math.min(b.level, 3)}>`);
    else if (b.kind === 'para') out.push(`<p>${inl(b.runs)}</p>`);
    else if (b.kind === 'hr') out.push('<hr>');
  }
  fecha();
  return out.join('\n');
};

export async function copyNote(md: string) {
  const text = toWhatsappText(md);
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([toHtml(md)], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })]);
      return;
    }
  } catch { /* Firefox/HTTP antigo: cai no texto puro */ }
  await navigator.clipboard.writeText(text);
}

export const fileSlug = (title: string) =>
  (title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s-]/g, '')
    .trim().replace(/\s+/g, '-').toLowerCase().slice(0, 60)) || 'nota';

/* ── PDF ──
 * As fontes padrão do jsPDF só têm Latin-1: acento português/espanhol passa,
 * aspas curvas e travessão viram lixo e emoji some. Troca o que dá e corta o
 * resto. */
const latin1 = (s: string) =>
  s.replace(/[“”«»]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/…/g, '...')
    .replace(/[•●▪]/g, '-').replace(/[→➜➡]/g, '->')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, '').replace(/ {2,}/g, ' ').replace(/ +([.,;:!?])/g, '$1');

export async function buildPdf(title: string, subtitle: string, md: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 56;
  const RED: [number, number, number] = [190, 13, 62];
  const INK: [number, number, number] = [30, 27, 17];
  let y = M;

  const ensure = (h: number) => { if (y + h > H - M) { doc.addPage(); y = M; } };
  const font = (r: Run, base: 'bold' | 'normal') => {
    const bold = r.bold || base === 'bold';
    doc.setFont('helvetica', bold && r.italic ? 'bolditalic' : bold ? 'bold' : r.italic ? 'italic' : 'normal');
  };

  /* Escreve runs com quebra de linha por palavra, trocando de fonte no meio
     da linha quando o trecho muda de negrito/itálico. */
  const writeRuns = (runs: Run[], x: number, size: number, color: [number, number, number], base: 'bold' | 'normal' = 'normal', boldColor = RED) => {
    const lh = size * 1.45;
    const maxX = W - M;
    doc.setFontSize(size);
    ensure(lh);
    let cx = x;
    for (const r of runs) {
      font(r, base);
      const tokens = latin1(r.text).split(/(\s+)/);
      for (const tk of tokens) {
        if (!tk) continue;
        const isSpace = /^\s+$/.test(tk);
        const w = doc.getTextWidth(isSpace ? ' ' : tk);
        if (!isSpace && cx + w > maxX && cx > x) { y += lh; ensure(lh); cx = x; }
        if (isSpace) { if (cx > x) cx += w; continue; }
        doc.setTextColor(...(r.bold && base !== 'bold' ? boldColor : color));
        doc.text(tk, cx, y + size);
        if (r.strike) doc.setDrawColor(...color).setLineWidth(0.6).line(cx, y + size * 0.68, cx + w, y + size * 0.68);
        cx += w;
      }
    }
    y += lh;
  };

  writeRuns([{ text: title }], M, 22, INK, 'bold');
  if (subtitle) writeRuns([{ text: subtitle }], M, 10, [91, 64, 65]);
  y += 6;
  doc.setDrawColor(...RED).setLineWidth(1.2).line(M, y, W - M, y);
  y += 18;

  let blankPend = false;
  for (const b of parseBlocks(md)) {
    if (b.kind === 'blank') { blankPend = true; continue; }
    if (blankPend) { y += 6; blankPend = false; }
    switch (b.kind) {
      case 'heading': {
        const size = b.level === 1 ? 18 : b.level === 2 ? 15 : 13;
        y += b.level <= 2 ? 10 : 6;
        ensure(size * 3);
        writeRuns(b.runs, M, size, b.level <= 2 ? INK : RED, 'bold');
        y += 2;
        break;
      }
      case 'hr':
        y += 6; ensure(12);
        doc.setDrawColor(230, 200, 205).setLineWidth(0.6).line(M, y, W - M, y);
        y += 12;
        break;
      case 'bullet': {
        const x = M + 14 + b.depth * 16;
        ensure(16);
        doc.setFillColor(...RED).circle(x - 8, y + 11 * 0.62, 1.8, 'F');
        writeRuns(b.runs, x, 11, INK);
        break;
      }
      case 'ordered': {
        const x = M + 18 + b.depth * 16;
        ensure(16);
        doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...RED);
        doc.text(`${b.n}.`, x - 4, y + 11, { align: 'right' });
        writeRuns(b.runs, x, 11, INK);
        break;
      }
      default:
        writeRuns(b.runs, M, 11, INK);
    }
  }
  return doc.output('blob');
}

/* ── Word (.docx) ── abre no Word, Google Docs e Pages. */
export async function buildDocx(title: string, subtitle: string, md: string): Promise<Blob> {
  const d = await import('docx');
  const RED = 'BE0D3E';
  const runs = (rs: Run[], extra: { bold?: boolean; color?: string; size?: number } = {}) =>
    rs.map(r => new d.TextRun({
      text: r.text,
      bold: r.bold || extra.bold,
      italics: r.italic,
      strike: r.strike,
      color: r.bold && !extra.bold ? RED : extra.color,
      size: extra.size,
    }));

  const children: InstanceType<typeof d.Paragraph>[] = [
    new d.Paragraph({ heading: d.HeadingLevel.TITLE, children: [new d.TextRun({ text: title, bold: true })] }),
  ];
  if (subtitle) children.push(new d.Paragraph({ children: [new d.TextRun({ text: subtitle, color: '5B4041', size: 18 })], spacing: { after: 240 } }));

  for (const b of parseBlocks(md)) {
    switch (b.kind) {
      case 'heading': {
        const level = [d.HeadingLevel.HEADING_1, d.HeadingLevel.HEADING_2, d.HeadingLevel.HEADING_3][Math.min(b.level, 3) - 1];
        children.push(new d.Paragraph({ heading: level, children: runs(b.runs, { bold: true, color: b.level >= 3 ? RED : undefined }) }));
        break;
      }
      case 'bullet':
        children.push(new d.Paragraph({ bullet: { level: b.depth }, children: runs(b.runs) }));
        break;
      case 'ordered':
        children.push(new d.Paragraph({
          indent: { left: 360 + b.depth * 360, hanging: 360 },
          children: [new d.TextRun({ text: `${b.n}.\t`, bold: true, color: RED }), ...runs(b.runs)],
        }));
        break;
      case 'hr':
        children.push(new d.Paragraph({ border: { bottom: { style: d.BorderStyle.SINGLE, size: 6, color: 'E6C8CD', space: 1 } }, children: [] }));
        break;
      case 'blank':
        break;
      default:
        children.push(new d.Paragraph({ children: runs(b.runs), spacing: { after: 120 } }));
    }
  }

  const doc = new d.Document({
    creator: 'Comunidade',
    title,
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children }],
  });
  return d.Packer.toBlob(doc);
}

/* No iPhone, <a download> num PWA abre o arquivo numa tela sem saída; a folha
   de compartilhar ("Salvar em Arquivos", WhatsApp, AirDrop) é o caminho nativo.
   No computador, download normal. */
const isTouch = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export async function deliverFile(blob: Blob, filename: string, preferShare = isTouch()) {
  const file = new File([blob], filename, { type: blob.type });
  if (preferShare && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* WhatsApp: no celular manda o PDF pela folha de compartilhar (a aluna escolhe
   o WhatsApp lá); no computador não existe essa folha pra arquivo, então abre o
   WhatsApp com o texto já formatado. */
export async function sendToWhatsapp(title: string, subtitle: string, md: string) {
  if (isTouch()) {
    const blob = await buildPdf(title, subtitle, md);
    const file = new File([blob], `${fileSlug(title)}.pdf`, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
  }
  const LIMITE = 6000;
  let text = `*${title}*\n\n${toWhatsappText(md)}`;
  if (text.length > LIMITE) text = `${text.slice(0, LIMITE)}…`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
