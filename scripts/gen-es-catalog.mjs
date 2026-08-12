#!/usr/bin/env node
/* Gera src/i18n/esCatalog.ts a partir dos arquivos em
 * public/covers/modulos/es/.
 *
 * A regra do catálogo espanhol é: entra o módulo que TEM capa em espanhol.
 * Preferi derivar da pasta em vez de manter lista escrita na mão porque lista
 * na mão desatualiza em silêncio — alguém sobe a capa, esquece do array, e o
 * módulo simplesmente não aparece sem ninguém entender por quê.
 *
 * Arquivos com "_" na frente são ignorados de propósito: são capas recebidas
 * que ainda não têm módulo correspondente.
 *
 * Rode depois de adicionar/remover capa:  npm run es:catalog
 */
import fs from 'fs';
import { fileURLToPath } from 'url';

const dir = fileURLToPath(new URL('../public/covers/modulos/es', import.meta.url));
const out = fileURLToPath(new URL('../src/i18n/esCatalog.ts', import.meta.url));

const slugs = fs.readdirSync(dir)
  .filter(f => f.endsWith('.webp') && !f.startsWith('_'))
  .map(f => f.replace(/\.webp$/, ''))
  .sort();

fs.writeFileSync(out, `/* GERADO por scripts/gen-es-catalog.mjs — não edite à mão.
 * Rode \`npm run es:catalog\` depois de mexer em public/covers/modulos/es/.
 *
 * Catálogo do espanhol: a versão ES mostra SÓ estes módulos. A regra é ter
 * capa em espanhol — módulo sem capa própria não entra, em vez de entrar com
 * a capa em português.
 *
 * Módulos criados pelo painel (que guardam URL do Supabase Storage) não
 * aparecem aqui: para eles vale a coluna cover_url_es, conferida em runtime.
 */
export const ES_MODULE_SLUGS: readonly string[] = [
${slugs.map(s => `  '${s}',`).join('\n')}
];

const ES_SET = new Set(ES_MODULE_SLUGS);

/** O módulo entra na versão espanhola? Vale para os dois caminhos de capa:
 *  o arquivo no repositório (lista acima) e o upload do painel (cover_url_es). */
export const isInEsCatalog = (m: { slug: string; cover_url_es?: string | null }): boolean =>
  ES_SET.has(m.slug) || !!m.cover_url_es;
`);

console.log(`esCatalog.ts gerado com ${slugs.length} módulos:`);
slugs.forEach(s => console.log('  ' + s));
