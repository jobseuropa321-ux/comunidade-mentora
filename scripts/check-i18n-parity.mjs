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
