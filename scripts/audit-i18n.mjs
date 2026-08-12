#!/usr/bin/env node
/* Estimativa grosseira de cobertura de tradução por arquivo.
 * Conta "candidatos": texto entre tags JSX e strings com acento/palavra PT
 * comum, ignorando classes, imports e código. Não é exato — serve para
 * priorizar e para medir progresso. */
import fs from 'fs';
import { execSync } from 'child_process';

const files = execSync("find src -name '*.tsx' -o -name '*.ts'", { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)
  .filter(f => !f.startsWith('src/i18n/') && !f.includes('/ui/'));

const PT = /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]|\b(você|voce|para|como|mais|seus?|suas?|não|nao|com|sem|aqui|agora|quando|todos?|todas?)\b/i;
const rows = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  let cand = 0;
  for (const raw of lines) {
    const l = raw.trim();
    if (!l || l.startsWith('//') || l.startsWith('*') || l.startsWith('/*')) continue;
    if (/^import\s|from ['"]/.test(l)) continue;
    if (/className=|style=|background:|color:|gradient|rgba?\(|#[0-9A-Fa-f]{3,8}/.test(l) && !/>[^<>{}]*[a-zà-ú]{4,}[^<>{}]*</.test(l)) continue;
    const jsxText = l.match(/>[^<>{}]{4,}</);
    const quoted = l.match(/(['"])[^'"]{4,}\1/);
    const hit = (jsxText && PT.test(jsxText[0])) || (quoted && PT.test(quoted[0]));
    if (hit) cand++;
  }
  const traduzido = src.includes('useTranslation');
  rows.push({ f, cand, traduzido });
}
rows.sort((a, b) => b.cand - a.cand);
const isAdmin = (f) => f.includes('/admin/') || f.endsWith('Admin.tsx');
const limpo   = rows.filter(r => r.cand === 0 && r.traduzido);
const parcial = rows.filter(r => r.cand > 0 && r.traduzido);
const zero    = rows.filter(r => r.cand > 0 && !r.traduzido && !isAdmin(r.f));
const admin   = rows.filter(r => r.cand > 0 && isAdmin(r.f));
const soma = (a) => a.reduce((s, r) => s + r.cand, 0);
const list = (a) => a.forEach(r => console.log(`  ${String(r.cand).padStart(4)}  ${r.f}`));

console.log('SEM CANDIDATO RESTANTE (' + limpo.length + ' arquivos):'); list(limpo);
console.log('\nPARCIAL — já usa t() mas sobrou texto (' + parcial.length + ' arquivos, ~' + soma(parcial) + '):'); list(parcial);
console.log('\nNÃO INICIADO (' + zero.length + ' arquivos, ~' + soma(zero) + '):'); list(zero);
console.log('\nADMIN — fora de escopo por decisão do kit (' + admin.length + ' arquivos, ~' + soma(admin) + '):'); list(admin);
console.log('\nTOTAL pendente fora do admin: ~' + (soma(parcial) + soma(zero)));
