#!/usr/bin/env node
/**
 * Diagnostic: after a KV range erase, do stale cells leak into attention (bug) or only cell placement change
 * (numerics)? For each pass: keep the first k prompt tokens, append junk of a fixed length, erase the junk,
 * evaluate the rest. H1 and H2 use different junk of the same length (same cell layout, different stale
 * contents). H1 == H2 bitwise => no leakage. Also reports |H1 - fresh|.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PerPrimitiveScorer, answerStringsForPass } from './readout.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const ev = await import('@airp/evaluator-local');
const nlc = await import('node-llama-cpp');
const a = process.argv.slice(2);
const opt = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const s = new PerPrimitiveScorer({ ev, nlc, modelPath: opt('--gguf'), gpu: a.includes('--gpu') });
await s.load();
const items = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/evaluator-gate/held-out-suite.v2.json'), 'utf8')).items;
const N = Number(opt('--limit', 10));
const junkA = s.model.tokenize(items[400].content.repeat(4)).slice(0, 120);
const junkB = s.model.tokenize(items[401].content.repeat(4)).slice(0, 120);
const maxDiff = (p, q) => Math.max(...Object.keys(p.logProbs).map((k) => Math.abs(p.logProbs[k] - q.logProbs[k])));
async function withJunk(toks, ans, k, junk) {
  await s.resetSequence();
  await s.seq.evaluateWithoutGeneratingNewTokens([...toks.slice(0, k), ...junk]);
  await s.seq.eraseContextTokenRanges([{ start: k, end: s.seq.nextTokenIndex }]);
  return s.scorePass(toks, ans, { reuse: true });
}
const agg = { n: 0, h1h2Exact: 0, h1h2Max: 0, freshMax: 0 };
const rows = [];
for (const item of items.slice(0, N)) {
  const req = { providerId: 'held-out', content: item.content };
  for (const pass of s.passes.slice(1)) {
    const toks = s.passTokens(pass, req);
    const ans = answerStringsForPass(pass, s.catalogue);
    const k = 25;
    const A = await s.scorePass(toks, ans, { reuse: false });
    const H1 = await withJunk(toks, ans, k, junkA);
    const H2 = await withJunk(toks, ans, k, junkB);
    const d12 = maxDiff(H1, H2), dA = maxDiff(H1, A);
    agg.n++; agg.h1h2Exact += d12 === 0; agg.h1h2Max = Math.max(agg.h1h2Max, d12); agg.freshMax = Math.max(agg.freshMax, dA);
    rows.push({ id: item.id, primitive: pass.primitive, d12, dA });
  }
}
fs.writeFileSync(opt('--out', 'diag-contam.json'), JSON.stringify({ agg, rows }, null, 1));
console.log(JSON.stringify(agg));
process.exit(0);
