#!/usr/bin/env node
/* Gera a versão em espanhol de uma ferramenta estática.
 *
 * As ferramentas em public/ferramentas/ são artefatos BUILDADOS (a edicao-ia é
 * um HTML autocontido; a desafio-10k é espelho de um site Next). Não temos o
 * código-fonte delas, então a tradução é por substituição no artefato.
 *
 * Isso tem um custo conhecido: se alguém regerar a ferramenta em português, a
 * cópia espanhola fica velha SEM avisar. Por isso o script grava o hash do
 * arquivo de origem, e `npm run ferramentas:check` acusa quando os dois
 * saíram de sincronia.
 *
 * Uso: node scripts/traduz-ferramenta.mjs <pasta> <dicionario.json>
 */
import fs from 'fs';
import crypto from 'crypto';

const [pasta, dicPath] = process.argv.slice(2);
if (!pasta || !dicPath) { console.error('uso: <pasta> <dicionario.json>'); process.exit(1); }

const base = `public/ferramentas/${pasta}`;
const origem = `${base}/index.html`;
const destDir = `${base}/es`;
const dic = JSON.parse(fs.readFileSync(dicPath, 'utf8'));

let html = fs.readFileSync(origem, 'utf8');
const hashOrigem = crypto.createHash('sha256').update(html).digest('hex').slice(0, 16);

// Do mais longo para o mais curto: senão uma frase curta quebra uma longa pela
// metade e a longa nunca casa.
const pares = Object.entries(dic).sort((a, b) => b[0].length - a[0].length);

let trocas = 0, semUso = [];
for (const [pt, es] of pares) {
  if (!html.includes(pt)) { semUso.push(pt); continue; }
  const antes = html;
  html = html.split(pt).join(es);
  if (html !== antes) trocas++;
}

fs.mkdirSync(destDir, { recursive: true });
fs.writeFileSync(`${destDir}/index.html`, html);
fs.writeFileSync(`${destDir}/.origem-hash`, hashOrigem + '\n');

console.log(`${pasta}: ${trocas}/${pares.length} termos aplicados`);
if (semUso.length) {
  console.log(`  ${semUso.length} não encontrados no HTML (revise o dicionário):`);
  semUso.slice(0, 8).forEach(s => console.log('    · ' + s.slice(0, 70)));
}
const resto = [...html.matchAll(/>([^<>]{6,})</g)].map(m => m[1].trim())
  // ã/õ/ç não existem em espanhol; o resto são palavras que só aparecem em pt.
  .filter(x => /[ãõç]|\b(você|não|dias?|aula|aulas|conteúdo|seu|sua|meu|minha|em dia|atual)\b/i.test(x));
console.log(`  sobrou texto com cara de português: ${new Set(resto).size}`);
