#!/usr/bin/env node
/**
 * Cross-path test and latency, Node side, shared-encoding model: the path that ships.
 * LayaSharedLocalEvaluator from @airp/evaluator-local (built dist): @huggingface/tokenizers on the
 * bundle tokenizer, one onnxruntime-node session.run per response (batch 1, no padding,
 * allow_spinning 0), the pinned decode (layaPrimitivesFromLogits) and the shared compose. Every item
 * goes through evaluate(), the Evaluator entry a host calls, after load() verified every pin and ran
 * its warm-up. Per-item time = evaluate() wall time (tokenize + run + decode + compose), performance.now();
 * p95 = nearest rank. The feed SHA-256 is computed after the timer.
 *
 * Modes:
 *   --suite SUITE.json --ids IDS.json|all --out OUT.jsonl      held-out items (identity + short-suite latency)
 *   --pinned PINNED.jsonl --out OUT.jsonl [--buckets 50,...]    pinned length buckets (latency; SHA-checked)
 * Common: --bundle DIR --pins PINS.json --pins-sha HEX --composition C.json --composition-sha HEX
 *         [--threads 8] [--warmup 20] [--summary S.json]
 * Warm-up protocol (= decide 3b bench_shared.py): --warmup N untimed evaluate() calls on the first N suite
 * items (suite mode: that suite; pinned mode: --warmup-suite SUITE.json), and in pinned mode 2 untimed
 * items per bucket before the bucket is timed.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import os from 'node:os';

const PIN_SET_SHA = '6ad799d2d84f601833dc15c1b4d22aa48d9c38bf6edbfc494de4a2dc0d99cc4b';
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const { LayaSharedLocalEvaluator } = await import(join(repo, 'packages/evaluator-local/dist/index.js'));
const { Taxonomy } = await import(join(repo, 'packages/core/dist/index.js'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

const taxonomy = Taxonomy.loadFromFile(join(repo, 'data/taxonomy/flags.v0.json'));
const threads = arg('--threads') ? Number(arg('--threads')) : undefined;
const t0 = performance.now();
const ev = new LayaSharedLocalEvaluator({
  taxonomy,
  modelPath: join(arg('--bundle'), 'laya-shared.onnx'),
  modelSha256: JSON.parse(readFileSync(arg('--pins'), 'utf8')).onnx.sha256,
  pinsPath: arg('--pins'), pinsSha256: arg('--pins-sha'),
  compositionPath: arg('--composition'), compositionSha256: arg('--composition-sha'),
  ...(threads ? { intraOpNumThreads: threads } : {}),
});
const verifyMs = performance.now() - t0;
const t1 = performance.now();
await ev.load();
const loadMs = performance.now() - t1;

const warmup = Number(arg('--warmup', 0));
const q = (s, p) => s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
const stats = (ms) => {
  const s = [...ms].sort((a, b) => a - b);
  const med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return { n: s.length, median_ms: med, p95_ms: q(s, 0.95), mean_ms: ms.reduce((a, b) => a + b, 0) / ms.length, min_ms: s[0], max_ms: s[s.length - 1] };
};
const lines = [];
async function timed(id, content, extra = {}) {
  const s = performance.now();
  const flags = await ev.evaluate({ providerId: 'crosspath', prompt: '', content });
  const dt = performance.now() - s;
  const p = ev.lastPass;
  lines.push(JSON.stringify({ id, path: 'node', ...extra, logits: p.logits, prims: p.primitives, composed: p.composed, flags: flags.map((f) => f.type),
    inputTokens: p.inputTokens, responseTokens: p.responseTokens, truncatedTokens: p.truncatedTokens, ms: dt, layout: p.layout, feedSha256: p.feedSha256() }));
  return dt;
}
const warmSuitePath = arg('--suite') ?? arg('--warmup-suite');
const warmSuite = warmSuitePath ? JSON.parse(readFileSync(warmSuitePath, 'utf8')).items : [];
for (const it of warmSuite.slice(0, warmup)) await ev.evaluate({ providerId: 'crosspath', prompt: '', content: it.content });

const result = {};
if (arg('--pinned')) {
  if (sha(arg('--pinned')) !== PIN_SET_SHA) throw new Error('pinned set SHA mismatch');
  const rows = readFileSync(arg('--pinned'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  result.buckets = {};
  for (const b of arg('--buckets', '50,200,500,1000').split(',').map(Number)) {
    const sel = rows.filter((r) => r.bucket === b);
    if (sel.length !== 20) throw new Error(`bucket ${b} has ${sel.length} rows`);
    for (const r of sel.slice(0, 2)) await ev.evaluate({ providerId: 'crosspath', prompt: '', content: r.text });
    const ms = [];
    for (const r of sel) { ms.push(await timed(r.id, r.text, { bucket: b, laya_tokens: r.laya_tokens })); }
    result.buckets[b] = stats(ms);
    console.log(`bucket ${b}: ${JSON.stringify(result.buckets[b])}`);
  }
} else {
  const suite = JSON.parse(readFileSync(arg('--suite'), 'utf8')).items;
  const byId = new Map(suite.map((it) => [it.id, it]));
  const ids = arg('--ids') === 'all' ? suite.map((i) => i.id) : JSON.parse(readFileSync(arg('--ids'), 'utf8')).ids;
  const ms = [];
  for (const [n, id] of ids.entries()) {
    const it = byId.get(id);
    if (!it) throw new Error(`unknown id ${id}`);
    ms.push(await timed(id, it.content));
    if ((n + 1) % 100 === 0) console.log(`node path ${n + 1}/${ids.length}`);
  }
  result.suite = stats(ms);
}
writeFileSync(arg('--out'), lines.join('\n') + '\n');
const pkg = (p) => JSON.parse(readFileSync(join(repo, 'node_modules', p, 'package.json'), 'utf8')).version;
const summary = { ...result, verify_ms: verifyMs, load_ms: loadMs, warmup_ms: ev.warmupMs, evaluator: `${ev.id}@${ev.version}`, node: process.version,
  onnxruntime_node: pkg('onnxruntime-node'), hf_tokenizers: pkg('@huggingface/tokenizers'), allowSpinning: 0, layout: 'shared (batch 1, no padding)',
  warmupItems: warmup, intraOpNumThreads: threads ?? 'ORT default', host: os.hostname(), cpu: os.cpus()[0]?.model, nproc: os.cpus().length,
  loadavg: os.loadavg(), rss_mb: process.memoryUsage().rss / 1048576, finished: new Date().toISOString() };
if (arg('--summary')) writeFileSync(arg('--summary'), JSON.stringify(summary, null, 1) + '\n');
console.log(JSON.stringify(summary));
await ev.close();
console.log('NODE_PATH_DONE');
