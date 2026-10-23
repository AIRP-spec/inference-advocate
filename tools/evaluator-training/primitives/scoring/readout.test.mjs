/**
 * Task 2 readout tests.
 * Model-free tests always run. Model tests run when AIRP_TASK2_GGUF points at a per-primitive-v1 GGUF:
 *   - prompt-path identity (two code paths, must be identical): the scorer's capped greedy decode equals
 *     LocalEvaluator's raw answers on every pass;
 *   - the gated readout (scored, no prefix reuse) is bitwise reproducible;
 *   - prefix reuse is NOT identical to no-reuse on llama.cpp (KV-cache state after a range erase;
 *     measured 2026-10-05, see REPORT-task2). It is a latency measurement only, never gated.
 *     This test pins the measured divergence band; it does not claim identity.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeLogProbs, argmaxAnswer, answerStringsForPass, PerPrimitiveScorer, normalizeStanceLikeGate } from './readout.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const ev = await import('@airp/evaluator-local');

test('stance normalization uses summed log-probs with no length normalization', () => {
  // two-token answer with higher total probability than a one-token answer whose per-token mean is higher
  const lp = { describes: Math.log(0.30), conveys_method: Math.log(0.6) + Math.log(0.9) }; // 0.30 vs 0.54
  const p = normalizeLogProbs(lp);
  assert.ok(Math.abs(p.describes + p.conveys_method - 1) < 1e-12);
  assert.equal(argmaxAnswer(p, ['describes', 'conveys_method']), 'conveys_method');
  assert.ok(Math.abs(p.conveys_method - 0.54 / 0.84) < 1e-12);
});

test('yes/no normalization is over the two trained strings only', () => {
  const p = normalizeLogProbs({ yes: Math.log(0.02), no: Math.log(0.06) });
  assert.ok(Math.abs(p.yes - 0.25) < 1e-12);
});

test('answer strings are exactly the SFT targets', () => {
  const passes = ev.buildAllPerPrimitivePrompts();
  assert.equal(passes.length, 17);
  assert.deepEqual(answerStringsForPass(passes[0], ev.PRIMITIVES_CATALOGUE_V1), ['describes', 'depicts', 'endorses', 'encourages', 'conveys_method']);
  for (const p of passes.slice(1)) assert.deepEqual(answerStringsForPass(p, ev.PRIMITIVES_CATALOGUE_V1), ['yes', 'no']);
});

test('prompt bundle matches the SFT latch and user turn matches the SFT builder', () => {
  assert.equal(ev.perPrimitivePromptBundleSha256(), 'f118809a613f6c1fd85b08b61c6810eb3910b30bf034de1146c949c38aa36eb8');
  const h = ev.perPrimitiveChatHistory('SYS', { providerId: 't', content: 'Hello there.' });
  assert.deepEqual(h, [
    { type: 'system', text: 'SYS' },
    { type: 'user', text: 'Assistant response under evaluation:\nHello there.' },
    { type: 'model', response: [] },
  ]);
});

test('gate stance normalization matches LocalEvaluator', () => {
  assert.equal(normalizeStanceLikeGate('conveys'), 'conveys_method');
  assert.equal(normalizeStanceLikeGate('encour'), 'encourages');
  assert.equal(normalizeStanceLikeGate('depicts'), 'depicts');
});

const GGUF = process.env.AIRP_TASK2_GGUF;
const N = Number(process.env.AIRP_TASK2_N || 40);
async function loadScorer() {
  const nlc = await import('node-llama-cpp');
  const s = new PerPrimitiveScorer({ ev, nlc, modelPath: GGUF, gpu: process.env.AIRP_TASK2_GPU === '1' });
  await s.load();
  console.log(`model tests: gpu=${s.llama.gpu} ${s.systemInfo.slice(-80)}`);
  return s;
}
const heldOut = () => JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/evaluator-gate/held-out-suite.v2.json'), 'utf8')).items.slice(0, N);

test('model: gated readout (scored, no prefix reuse) is bitwise reproducible', { skip: !GGUF }, async () => {
  const s = await loadScorer();
  for (const item of heldOut()) {
    const req = { providerId: 't', content: item.content };
    const a = await s.scoreItem(req, { reuse: false });
    await s.scoreItem({ providerId: 't', content: 'Unrelated warm-up text to disturb the cache.' }, { reuse: true });
    const b = await s.scoreItem(req, { reuse: false });
    for (const p of s.passes) assert.deepEqual(a[p.primitive].logProbs, b[p.primitive].logProbs, `${item.id} ${p.primitive}`);
  }
});

test('model: prefix reuse (latency path only) is NOT output-identical; pin the measured divergence', { skip: !GGUF }, async () => {
  // Measured 2026-10-05 on RTX 4090 (4 CKs x 471 items x 17 passes): reuse flips 0-4 of 8007 passes per CK,
  // some by >1 nat (P(yes) 0.76 -> 0.19), and C != D in diag-reuse.mjs with identical batch splits, so the
  // cause is KV-cache state after a range erase, not the readout. The gated readout never uses reuse.
  const s = await loadScorer();
  const comp = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tools/evaluator-training/primitives/compositions/airp-v0.5.0.json'), 'utf8'));
  let maxDp = 0, flips = 0, n = 0, composedDiff = 0;
  const items = heldOut();
  for (const item of items) {
    const req = { providerId: 't', content: item.content };
    await s.resetSequence();
    const a = await s.scoreItem(req, { reuse: true });
    const b = await s.scoreItem(req, { reuse: false });
    for (const p of s.passes) {
      n++;
      for (const k of Object.keys(a[p.primitive].probs)) maxDp = Math.max(maxDp, Math.abs(a[p.primitive].probs[k] - b[p.primitive].probs[k]));
      if (a[p.primitive].top !== b[p.primitive].top) flips++;
    }
    if (ev.compose(s.verdictFromScored(a), comp).join() !== ev.compose(s.verdictFromScored(b), comp).join()) composedDiff++;
  }
  console.log(`reuse vs no-reuse: ${n} passes, top flips ${flips}, composed diffs ${composedDiff}/${items.length}, max |dp| ${maxDp.toFixed(4)} (NOT identical)`);
  assert.ok(flips / n <= 0.01, `reuse flip rate ${flips}/${n} above 1% (measured 0.05% on 4x8007 passes)`);
});

test('model: scorer prompt path equals LocalEvaluator (capped greedy raw answers identical)', { skip: !GGUF }, async () => {
  const { Taxonomy } = await import('@airp/core');
  const gpu = process.env.AIRP_TASK2_GPU === '1';
  const s = await loadScorer();
  const le = new ev.LocalEvaluator({
    taxonomy: Taxonomy.loadFromFile(path.join(repoRoot, 'data/taxonomy/flags.v0.json')),
    modelPath: GGUF, modelSha256: process.env.AIRP_TASK2_GGUF_SHA || '', gpu, promptTemplateVersion: 'per-primitive-v1',
    compositionPath: path.join(repoRoot, 'tools/evaluator-training/primitives/compositions/airp-v0.5.0.json'),
  });
  await le.load();
  for (const item of heldOut()) {
    const req = { providerId: 't', content: item.content };
    await le.evaluate(req);
    const raw = le.lastRawByClass;
    for (const p of s.passes) {
      const toks = s.passTokens(p, req);
      const g = await s.greedy(toks, p.passType === 'stance' ? s.stanceGrammar : s.yesNoGrammar, p.passType === 'stance' ? 16 : 2);
      const mine = p.passType === 'stance' ? normalizeStanceLikeGate(g.text) : g.text.trim().toLowerCase();
      const theirs = p.passType === 'stance' ? raw.stance : raw[`${p.passType}_${p.primitive}`];
      assert.equal(mine, theirs, `${item.id} ${p.primitive}`);
    }
  }
});
