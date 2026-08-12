#!/usr/bin/env node
/* Acusa quando a ferramenta em português mudou e a cópia espanhola não foi
 * regerada. Sem isto, a aluna espanhola continuaria vendo a versão antiga da
 * ferramenta sem ninguém perceber. */
import fs from 'fs';
import crypto from 'crypto';

let falhou = false;
for (const pasta of fs.readdirSync('public/ferramentas', { withFileTypes: true })) {
  if (!pasta.isDirectory()) continue;
  const base = `public/ferramentas/${pasta.name}`;
  const hashFile = `${base}/es/.origem-hash`;
  if (!fs.existsSync(hashFile)) { console.log(`  —  ${pasta.name}: sem versão ES`); continue; }
  const atual = crypto.createHash('sha256').update(fs.readFileSync(`${base}/index.html`)).digest('hex').slice(0, 16);
  const gravado = fs.readFileSync(hashFile, 'utf8').trim();
  if (atual === gravado) console.log(`  ok ${pasta.name}: ES em dia`);
  else { console.log(`  !! ${pasta.name}: PT mudou depois da tradução — rode de novo o traduz-ferramenta`); falhou = true; }
}
process.exit(falhou ? 1 : 0);
