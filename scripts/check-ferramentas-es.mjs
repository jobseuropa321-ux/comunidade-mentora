#!/usr/bin/env node
/* Duas checagens sobre a versão espanhola das ferramentas estáticas:
 *
 * 1. FRESCOR — a ferramenta em português mudou e a cópia espanhola não foi
 *    regerada? Sem isto a aluna espanhola continuaria vendo a versão antiga
 *    sem ninguém perceber.
 *
 * 2. COBERTURA — a cópia espanhola ainda tem português dentro? Esta faltava, e
 *    foi por isso que o Caderno do Desafio passou meses com a aba inteira de
 *    aulas em PT enquanto o check dizia "ES em dia": o hash batia (ninguém
 *    mexeu no PT), mas o dicionário só cobria uma fatia do artefato.
 *    O sinal é grosseiro de propósito — conta marcas que não existem em
 *    espanhol (ç, ã, õ e um punhado de palavras só do PT) e ignora CSS e URL.
 *    Falso positivo aqui custa 1 minuto; falso negativo custa uma aluna
 *    lendo português.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/* Marcas de português que não existem em espanhol. Duas famílias:
 *   a) caracteres exclusivos do PT — ç, ã, õ;
 *   b) palavras funcionais que NÃO são palavras espanholas.
 *
 * Sobre (b): a lista é curada a dedo. Ficam de fora os falsos amigos que
 * existem igual nos dois idiomas ("para", "como", "una", "que", "cada",
 * "quando"/"cuando" não, mas "porque" sim) — incluir um deles faz o check
 * gritar em cima de espanhol perfeito e a pessoa aprende a ignorar o aviso.
 *
 * NÃO use dígrafos como "nh"/"lh": casam com inglês e CSS ("inherit",
 * "min-height", "glyphName") e afogam o sinal em falso positivo. */
/* Fronteira de palavra feita à mão, com lookaround Unicode.
   NÃO use \b: em JavaScript ele é ASCII-only, então "com" casa dentro de
   "común" (o "ú" conta como fronteira) e o check acusa espanhol perfeito. */
const B0 = '(?<![\\p{L}\\p{N}])';
const B1 = '(?![\\p{L}\\p{N}])';
const MARCA_PT = new RegExp(
  '[ãõç]|' + B0 + '(' + [
    'não', 'você', 'vocês', 'são', 'então', 'também', 'já', 'até', 'sem', 'com',
    'mais', 'das', 'pela', 'pelas', 'isso', 'muito', 'meu', 'minha',
    'seu', 'sua', 'seus', 'suas', 'dele', 'dela', 'nosso', 'nossa',
    'estão', 'foi', 'vai', 'pode', 'fazer', 'ter', 'conteúdo', 'conteúdos',
  ].join('|') + ')' + B1,
  'giu',
);

/* Ruído que dispara a marca sem ser texto de tela.
   Sem regra de comentário `//`: os bundles são minificados numa linha só, então
   `//[^\n]*` apagava o arquivo inteiro a partir da primeira barra dupla — e o
   check passava a dizer "sem português" sobre um arquivo que ele nem leu. */
const IGNORAR = [
  /<style[^>]*>[\s\S]*?<\/style>/gi,   // CSS
  /https?:\/\/[^\s"'`)]+/g,            // URLs
  /[\w-]+\.(webp|png|jpe?g|svg|css|js|woff2?)/gi,
  /#[a-z][a-z0-9-]*/g,                  // âncoras de rota (#meu-desafio)
  /\b(?:id|className|htmlFor|name|key)\s*:\s*`[^`]*`/g,  // atributos de código
];

const limpa = (txt) => IGNORAR.reduce((s, re) => s.replace(re, ' '), txt);

/** Arquivos da cópia ES que a aluna realmente lê. */
function arquivosDeTexto(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...arquivosDeTexto(p));
    else if (/\.(html|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

let falhou = false;

for (const pasta of fs.readdirSync('public/ferramentas', { withFileTypes: true })) {
  if (!pasta.isDirectory()) continue;
  const base = `public/ferramentas/${pasta.name}`;
  const es = `${base}/es`;
  const hashFile = `${es}/.origem-hash`;

  if (!fs.existsSync(hashFile)) {
    console.log(`  —  ${pasta.name}: sem versão ES`);
    continue;
  }

  // 1. frescor
  const atual = crypto.createHash('sha256')
    .update(fs.readFileSync(`${base}/index.html`)).digest('hex').slice(0, 16);
  const gravado = fs.readFileSync(hashFile, 'utf8').trim();
  if (atual !== gravado) {
    console.log(`  !! ${pasta.name}: PT mudou depois da tradução — rode de novo o traduz-ferramenta`);
    falhou = true;
    continue;
  }

  // 2. cobertura
  let marcas = 0;
  const exemplos = [];
  for (const arq of arquivosDeTexto(es)) {
    const conteudo = limpa(fs.readFileSync(arq, 'utf8'));
    for (const m of conteudo.matchAll(MARCA_PT)) {
      marcas++;
      if (exemplos.length < 3) {
        const ini = Math.max(0, m.index - 45);
        exemplos.push(conteudo.slice(ini, m.index + 45).replace(/\s+/g, ' ').trim());
      }
    }
  }

  if (marcas === 0) {
    console.log(`  ok ${pasta.name}: ES em dia e sem português`);
  } else {
    console.log(`  !! ${pasta.name}: ES em dia, mas sobrou português (${marcas} marcas)`);
    for (const ex of exemplos) console.log(`       …${ex}…`);
    console.log(`       estenda scripts/ferramentas-es/dic-${pasta.name}.json e rode o traduz-ferramenta`);
    falhou = true;
  }
}

process.exit(falhou ? 1 : 0);
