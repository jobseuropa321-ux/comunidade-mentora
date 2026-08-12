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

const ferrDir = fileURLToPath(new URL('../public/ferramentas', import.meta.url));
const tools = fs.readdirSync(ferrDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(ferrDir + '/' + d.name + '/es/index.html'))
  .map(d => d.name).sort();

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

fs.appendFileSync(out, "\n/* Ferramentas estáticas (public/ferramentas/) que já têm versão em espanhol.\n * Elas vivem FORA do React, então não passam pelo i18n: a versão ES é uma\n * cópia traduzida do artefato, gerada por scripts/traduz-ferramenta.mjs.\n * Rode `npm run ferramentas:check` para saber se a cópia ficou velha. */\nexport const ES_TOOL_DIRS: readonly string[] = [\n__TOOLS__\n];\n\n/** Aponta para a versão espanhola da ferramenta quando ela existe.\n *  URL externa (Drive) e ferramenta ainda sem versão ES passam direto,\n *  em vez de virar link quebrado. */\nexport const esToolUrl = (url: string | null | undefined, lang: string): string | null => {\n  if (!url) return null;\n  if (lang !== 'es' || !url.startsWith('/ferramentas/')) return url;\n  const dir = url.split('/')[2];\n  return ES_TOOL_DIRS.includes(dir) ? url.replace('/ferramentas/' + dir, '/ferramentas/' + dir + '/es') : url;\n};\n".replace('__TOOLS__', tools.map(t => "  '" + t + "',").join('\n')));

console.log(`esCatalog.ts gerado com ${slugs.length} módulos e ${tools.length} ferramentas ES:`);
slugs.forEach(s => console.log('  ' + s));
