#!/usr/bin/env node
/**
 * Task 2 runner: scored readout vs greedy generation on the per-primitive-v1 Qwen GGUF.
 *
 *   node score-per-primitive.mjs run --gguf step-8560.gguf --out out/ck-8560.jsonl [--gpu] [--limit N] [--free]
 *   node score-per-primitive.mjs latency --gguf step-8560.gguf --out out/lat-8560-gpu.json [--gpu] [--limit N]
 *
 * run: per held-out item and per pass records
 *   greedyCapped   : gate decode (grammar, stance cap 16, yes/no cap 2), for identity with the existing gate
 *   greedyUncapped : same grammar, no cap (stops at EOG; safety bound 64 tokens, reported if hit)
 *   free           : (optional) no grammar, cap 32, diagnostic only
 *   scoredReuse    : probability readout keeping the KV prefix shared with the previous pass
 *   scoredNoReuse  : probability readout with the KV cache cleared before every pass
 * latency: per-item wall time for LocalEvaluator.evaluate (current greedy baseline), scored without
 *   reuse, scored with reuse; each including compose().
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PerPrimitiveScorer, answerStringsForPass, normalizeStanceLikeGate } from './readout.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const ev = await import('@airp/evaluator-local');
const nlc = await import('node-llama-cpp');
const { Taxonomy } = await import('@airp/core');

const EXPECTED_PROMPT_BUNDLE_SHA = 'f118809a613f6c1fd85b08b61c6810eb3910b30bf034de1146c949c38aa36eb8';
const SUITE = path.join(repoRoot, 'data/evaluator-gate/held-out-suite.v2.json');
const SUITE_SHA = '6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4';
const COMPOSITION = path.join(repoRoot, 'tools/evaluator-training/primitives/compositions/airp-v0.5.0.json');
const COMPOSITION_SHA = '4def0b8fd339713bd261106cb10235949f4bd1bc4e3631a88dd7cc511b0087e0';

function parseArgs(argv) {
  const o = { mode: argv[2], gpu: false, limit: 0, free: false, gguf: '', out: '', expectSha: '', skipNoReuse: false, modes: 'le,noreuse,reuse' };
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--gpu') o.gpu = true;
    else if (a === '--free') o.free = true;
    else if (a === '--skip-noreuse') o.skipNoReuse = true;
    else if (a === '--gguf') o.gguf = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--limit') o.limit = Number(argv[++i]);
    else if (a === '--expect-sha') o.expectSha = argv[++i];
    else if (a === '--modes') o.modes = argv[++i];
    else throw new Error(`unknown arg ${a}`);
  }
  return o;
}
const sha256 = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const args = parseArgs(process.argv);

// Latches: prompt bundle, suite, composition, GGUF.
const bundle = ev.perPrimitivePromptBundleSha256();
if (bundle !== EXPECTED_PROMPT_BUNDLE_SHA) throw new Error(`prompt bundle SHA ${bundle} != SFT ${EXPECTED_PROMPT_BUNDLE_SHA}`);
if (sha256(SUITE) !== SUITE_SHA) throw new Error('held-out v2 SHA mismatch');
if (sha256(COMPOSITION) !== COMPOSITION_SHA) throw new Error('composition SHA mismatch');
const ggufSha = sha256(args.gguf);
if (args.expectSha && ggufSha !== args.expectSha) throw new Error(`GGUF SHA ${ggufSha} != expected ${args.expectSha}`);

const suite = JSON.parse(fs.readFileSync(SUITE, 'utf8'));
let items = suite.items;
if (args.limit) items = items.slice(0, args.limit);
const composition = JSON.parse(fs.readFileSync(COMPOSITION, 'utf8'));

const scorer = new PerPrimitiveScorer({ ev, nlc, modelPath: args.gguf, gpu: args.gpu });
await scorer.load();
const header = {
  kind: 'header',
  mode: args.mode,
  gguf: path.basename(args.gguf),
  ggufSha256: ggufSha,
  promptBundleSha256: bundle,
  passes: scorer.passes.map((p) => p.primitive),
  answerTokens: scorer.answerTokens,
  systemInfo: scorer.systemInfo,
  gpu: args.gpu,
  nItems: items.length,
  startedAt: new Date().toISOString(),
  sampleContextText: scorer.passContextText(scorer.passes[0], { providerId: 'held-out', content: items[0].content }),
};
console.log(JSON.stringify({ ...header, sampleContextText: undefined }));
fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });

if (args.mode === 'run') {
  const out = fs.createWriteStream(args.out);
  out.write(JSON.stringify(header) + '\n');
  let n = 0;
  for (const item of items) {
    const req = { providerId: 'held-out', content: item.content, prompt: item.prompt };
    const rec = { kind: 'item', id: item.id, passes: {} };
    // greedy paths first (each pass: capped, uncapped, free), mirroring LocalEvaluator order
    for (const pass of scorer.passes) {
      const toks = scorer.passTokens(pass, req);
      const grammar = pass.passType === 'stance' ? scorer.stanceGrammar : scorer.yesNoGrammar;
      const capped = await scorer.greedy(toks, grammar, pass.passType === 'stance' ? 16 : 2);
      const uncapped = await scorer.greedy(toks, grammar, null);
      const r = {
        promptTokens: toks.length,
        greedyCapped: pass.passType === 'stance' ? normalizeStanceLikeGate(capped.text) : capped.text.trim().toLowerCase(),
        greedyCappedRaw: capped.text,
        greedyUncapped: uncapped.text,
        greedyUncappedTokens: uncapped.tokens,
        greedyUncappedStop: uncapped.stoppedBy,
      };
      if (args.free) {
        const free = await scorer.greedy(toks, null, 32);
        r.free = free.text;
        r.freeStop = free.stoppedBy;
      }
      rec.passes[pass.primitive] = r;
    }
    await scorer.resetSequence();
    const scoredReuse = await scorer.scoreItem(req, { reuse: true });
    let scoredNoReuse = null;
    if (!args.skipNoReuse) scoredNoReuse = await scorer.scoreItem(req, { reuse: false });
    for (const pass of scorer.passes) {
      const r = rec.passes[pass.primitive];
      r.answers = answerStringsForPass(pass, scorer.catalogue);
      r.scoredReuse = scoredReuse[pass.primitive];
      if (scoredNoReuse) r.scoredNoReuse = scoredNoReuse[pass.primitive];
    }
    const vScored = scorer.verdictFromScored(scoredReuse);
    rec.scoredVerdict = vScored;
    rec.scoredComposed = ev.compose(vScored, composition);
    if (scoredNoReuse) {
      const v2 = scorer.verdictFromScored(scoredNoReuse);
      rec.scoredNoReuseComposed = ev.compose(v2, composition);
    }
    out.write(JSON.stringify(rec) + '\n');
    n++;
    if (n % 25 === 0) console.log(`${new Date().toISOString()} ${n}/${items.length}`);
  }
  // wait for the flush: process.exit below would otherwise drop the footer (it did on the 2026-10-05 runs)
  await new Promise((resolve) => out.end(JSON.stringify({ kind: 'footer', finishedAt: new Date().toISOString(), n }) + '\n', resolve));
  console.log(`done ${n}`);
} else if (args.mode === 'latency') {
  const modes = args.modes.split(',');
  const result = { ...header, modes: {}, n: items.length };
  const reqs = items.map((item) => ({ providerId: 'held-out', content: item.content, prompt: item.prompt }));
  // Baseline: the real LocalEvaluator per-primitive path (capped greedy, as gated).
  if (modes.includes('le')) {
    const taxonomy = Taxonomy.loadFromFile(path.join(repoRoot, 'data/taxonomy/flags.v0.json'));
    const le = new ev.LocalEvaluator({
      taxonomy,
      modelPath: args.gguf,
      modelSha256: ggufSha,
      gpu: args.gpu,
      promptTemplateVersion: 'per-primitive-v1',
      compositionPath: COMPOSITION,
    });
    await le.load();
    const ms = [];
    for (const req of reqs) {
      const t0 = performance.now();
      await le.evaluate(req);
      ms.push(performance.now() - t0);
    }
    result.modes.greedyLocalEvaluator = ms;
    await le.dispose?.();
  }
  for (const [name, reuse] of [['scoredNoReuse', false], ['scoredReuse', true]]) {
    if (!modes.includes(reuse ? 'reuse' : 'noreuse')) continue;
    await scorer.resetSequence();
    await scorer.scoreItem({ providerId: 'warm', content: 'Hello.' }, { reuse }); // warm graph
    const ms = [];
    for (const req of reqs) {
      const t0 = performance.now();
      const s = await scorer.scoreItem(req, { reuse });
      ev.compose(scorer.verdictFromScored(s), composition);
      ms.push(performance.now() - t0);
    }
    result.modes[name] = ms;
  }
  const q = (arr, p) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)];
  };
  result.summary = Object.fromEntries(
    Object.entries(result.modes).map(([k, v]) => [k, { n: v.length, medianMs: q(v, 0.5), p95Ms: q(v, 0.95), meanMs: v.reduce((a, b) => a + b, 0) / v.length }]),
  );
  result.finishedAt = new Date().toISOString();
  fs.writeFileSync(args.out, JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result.summary, null, 1));
} else if (args.mode === 'dump-tokens') {
  // Exact prompt/answer token ids for the llama-cpp-python latency cross-check (same tokens, no re-tokenization).
  const dump = { ...header, items: [] };
  for (const item of items) {
    const req = { providerId: 'held-out', content: item.content, prompt: item.prompt };
    dump.items.push({ id: item.id, passes: scorer.passes.map((p) => ({ primitive: p.primitive, passType: p.passType, answers: answerStringsForPass(p, scorer.catalogue), tokens: scorer.passTokens(p, req) })) });
  }
  fs.writeFileSync(args.out, JSON.stringify(dump));
  console.log(`dumped ${dump.items.length}`);
} else {
  throw new Error('mode must be run, latency or dump-tokens');
}
process.exit(0);
