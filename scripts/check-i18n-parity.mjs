#!/usr/bin/env node
/* Paridade entre pt.json e es.json.
 *
 * Por que isso existe: com `fallbackLng: 'pt'`, uma chave que falta no espanhol
 * renderiza o texto EM PORTUGUÊS, sem erro e sem aviso no console. No app
 * original foi exatamente assim que 322 strings escaparam da primeira auditoria.
 *
 * O script do kit compara só os nomes das chaves. Este compara TAMBÉM o
 * comprimento dos arrays: um array com 11 itens de um lado e 12 do outro
 * renderiza `undefined` na tela e passaria batido na comparação de chaves.
 */
import fs from 'fs';
import { fileURLToPath } from 'url';

const load = (l) => JSON.parse(fs.readFileSync(new URL(`../src/i18n/locales/${l}.json`, import.meta.url), 'utf8'));
const pt = load('pt'), es = load('es');

const flat = (o, pre = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${pre}${k}.`) : [[`${pre}${k}`, v]]);

const mp = new Map(flat(pt)), me = new Map(flat(es));

const faltaEs = [...mp.keys()].filter(k => !me.has(k));
const sobraEs = [...me.keys()].filter(k => !mp.has(k));
const arrays  = [...mp.keys()]
  .filter(k => Array.isArray(mp.get(k)) && Array.isArray(me.get(k)))
  .filter(k => mp.get(k).length !== me.get(k).length)
  .map(k => `${k}: pt=${mp.get(k).length} es=${me.get(k).length}`);
const vazias  = [...me.entries()].filter(([, v]) => v === '' ).map(([k]) => k);

console.log(`chaves: pt=${mp.size} es=${me.size}`);
console.log(`falta no es (${faltaEs.length}):`, faltaEs.length ? faltaEs : 'nenhuma');
console.log(`sobra no es (${sobraEs.length}):`, sobraEs.length ? sobraEs : 'nenhuma');
console.log(`arrays de tamanho diferente (${arrays.length}):`, arrays.length ? arrays : 'nenhum');
console.log(`valores vazios no es (${vazias.length}):`, vazias.length ? vazias : 'nenhum');

const falhou = faltaEs.length || sobraEs.length || arrays.length || vazias.length;
if (falhou) { console.error('\nPARIDADE QUEBRADA'); process.exit(1); }
console.log('\nparidade ok');

/* ── Chaves usadas no código que NÃO existem no dicionário ──
 * Uma chave errada não quebra nada: o i18next devolve a própria chave, e a
 * tela mostra "modulo.aulas" no lugar do texto. Só aparece se alguém olhar.
 * Cobre apenas t('literal') — as chaves montadas com template (t(`a.${x}`))
 * são conferidas pelo prefixo. */
const src = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) src.push(p);
  }
};
walk(fileURLToPath(new URL('../src', import.meta.url)));

const literais = new Set();
const prefixos = new Set();
for (const f of src) {
  const code = fs.readFileSync(f, 'utf8');
  for (const m of code.matchAll(/\bt\(\s*'([a-zA-Z0-9_.-]+)'/g)) literais.add(m[1]);
  for (const m of code.matchAll(/\bt\(\s*`([a-zA-Z0-9_.-]*)\$\{/g)) if (m[1]) prefixos.add(m[1].replace(/\.$/, ''));
}
// Plural do i18next vive como chave_one/chave_other — t('x.comentario', {count})
// resolve para uma delas, então a chave base não existe no JSON e não está errada.
const PLURAL = ['_zero','_one','_two','_few','_many','_other'];
const existe = (k) =>
  mp.has(k)
  || PLURAL.some(sfx => mp.has(k + sfx))
  || [...mp.keys()].some(x => x.startsWith(k + '.'));
const quebradas = [...literais].filter(k => !existe(k));
const prefOrfaos = [...prefixos].filter(k => !existe(k));

console.log(`\nchaves literais usadas no código: ${literais.size}`);
console.log(`sem correspondência no dicionário (${quebradas.length}):`, quebradas.length ? quebradas : 'nenhuma');
console.log(`prefixos dinâmicos sem correspondência (${prefOrfaos.length}):`, prefOrfaos.length ? prefOrfaos : 'nenhum');
if (quebradas.length || prefOrfaos.length) { console.error('\nCHAVE QUEBRADA'); process.exit(1); }
