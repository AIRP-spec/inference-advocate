#!/usr/bin/env node
/**
 * Diagnostic: is the reuse vs no-reuse difference a KV-cache bug or batch-split numerics?
 * For each pass: A = fresh full-prompt eval, B = fresh again (determinism), C = prefix reuse (as scoreItem),
 * D = fresh but evaluated in two batches split exactly where C splits (prefix, then rest).
 * If C == D bitwise and A == B, the reuse path is correct and differences are batch-shape numerics.
 * Usage: node diag-reuse.mjs --gguf G [--gpu] [--limit N] --out diag.json
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
const gpu = a.includes('--gpu');
const limit = Number(opt('--limit', 20));
const suite = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/evaluator-gate/held-out-suite.v2.json'), 'utf8'));
const s = new PerPrimitiveScorer({ ev, nlc, modelPath: opt('--gguf'), gpu });
await s.load();
const commonPrefix = (x, y) => { let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++; return i; };
async function splitFresh(toks, answers, k) {
  await s.resetSequence();
  const head = toks.slice(0, -1);
  const kk = Math.min(k, head.length);
  if (kk > 0) await s.seq.evaluateWithoutGeneratingNewTokens(head.slice(0, kk));
  return s.scorePass(toks, answers, { reuse: true }); // adapt keeps [0,kk), evaluates the rest
}
const rows = [];
const maxDiff = (p, q) => Math.max(...Object.keys(p.logProbs).map((k) => Math.abs(p.logProbs[k] - q.logProbs[k])));
const agg = { AB: 0, CD: 0, AC: 0, n: 0, AB_exact: 0, CD_exact: 0, AC_exact: 0 };
for (const item of suite.items.slice(0, limit)) {
  const req = { providerId: 'held-out', content: item.content, prompt: item.prompt };
  // C: reuse chain over all passes, recording the split point each pass actually used
  await s.resetSequence();
  const C = []; let prev = [];
  for (const pass of s.passes) {
    const toks = s.passTokens(pass, req);
    const k = commonPrefix(prev, toks.slice(0, -1));
    C.push({ pass, toks, k, r: await s.scorePass(toks, answerStringsForPass(pass, s.catalogue), { reuse: true }) });
    prev = toks;
  }
  for (const c of C) {
    const ans = answerStringsForPass(c.pass, s.catalogue);
    const A = await s.scorePass(c.toks, ans, { reuse: false });
    const B = await s.scorePass(c.toks, ans, { reuse: false });
    const D = await splitFresh(c.toks, ans, c.k);
    const ab = maxDiff(A, B), cd = maxDiff(c.r, D), ac = maxDiff(A, c.r);
    agg.n++; agg.AB = Math.max(agg.AB, ab); agg.CD = Math.max(agg.CD, cd); agg.AC = Math.max(agg.AC, ac);
    agg.AB_exact += ab === 0; agg.CD_exact += cd === 0; agg.AC_exact += ac === 0;
    rows.push({ id: item.id, primitive: c.pass.primitive, split: c.k, promptTokens: c.toks.length, ab, cd, ac });
  }
}
fs.writeFileSync(opt('--out', 'diag-reuse.json'), JSON.stringify({ gpu, systemInfo: s.systemInfo, agg, rows }, null, 1));
console.log(JSON.stringify(agg));
process.exit(0);
