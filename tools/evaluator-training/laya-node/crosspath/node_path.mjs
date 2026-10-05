#!/usr/bin/env node
/**
 * Cross-path test, Node side: the path that ships. LayaLocalEvaluator from @airp/evaluator-local
 * (built dist), i.e. @receptron/laya systemOne on onnxruntime-node, the pinned decode
 * (layaPrimitivesFromLogits), and the shared compose. Every item goes through evaluate(), the
 * Evaluator entry a host calls, after load() has verified every pin and run its warm-up.
 *
 * Also the Node latency measurement: per-item wall time of evaluate() (tokenize + build 17 rows
 * + one session.run + decode + compose), performance.now(). p95 = nearest rank.
 *
 * Usage: node node_path.mjs --bundle DIR --pins PINS.json --pins-sha HEX --composition C.json
 *          --composition-sha HEX --suite SUITE.json --ids IDS.json|all --out OUT.jsonl
 *          [--threads N] [--summary SUMMARY.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import os from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const { LayaLocalEvaluator } = await import(join(repo, 'packages/evaluator-local/dist/index.js'));
const { Taxonomy } = await import(join(repo, 'packages/core/dist/index.js'));

const taxonomy = Taxonomy.loadFromFile(join(repo, 'data/taxonomy/flags.v0.json'));
const suite = JSON.parse(readFileSync(arg('--suite'), 'utf8')).items;
const byId = new Map(suite.map((it) => [it.id, it]));
const idsArg = arg('--ids');
const ids = idsArg === 'all' ? suite.map((i) => i.id) : JSON.parse(readFileSync(idsArg, 'utf8')).ids;
const threads = arg('--threads') ? Number(arg('--threads')) : undefined;

const t0 = performance.now();
const ev = new LayaLocalEvaluator({
  taxonomy,
  modelPath: join(arg('--bundle'), 'laya.onnx'),
  modelSha256: JSON.parse(readFileSync(arg('--pins'), 'utf8')).onnx.sha256,
  pinsPath: arg('--pins'),
  pinsSha256: arg('--pins-sha'),
  compositionPath: arg('--composition'),
  compositionSha256: arg('--composition-sha'),
  ...(threads ? { intraOpNumThreads: threads } : {}),
});
const verifyMs = performance.now() - t0;
const t1 = performance.now();
await ev.load();
const loadMs = performance.now() - t1;

const lines = [];
const ms = [];
for (const [n, id] of ids.entries()) {
  const it = byId.get(id);
  if (!it) throw new Error(`unknown id ${id}`);
  const s = performance.now();
  const flags = await ev.evaluate({ providerId: 'crosspath', prompt: '', content: it.content });
  const dt = performance.now() - s;
  ms.push(dt);
  const p = ev.lastPass;
  lines.push(JSON.stringify({ id, path: 'node', logits: p.logits, prims: p.primitives, composed: p.composed,
    flags: flags.map((f) => f.type), inputTokens: p.inputTokens, paddedLength: p.paddedLength, ms: dt }));
  if ((n + 1) % 50 === 0) console.log(`node path ${n + 1}/${ids.length}`);
}
writeFileSync(arg('--out'), lines.join('\n') + '\n');
const sorted = [...ms].sort((a, b) => a - b);
const q = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
const ortPkg = JSON.parse(readFileSync(join(repo, 'node_modules/onnxruntime-node/package.json'), 'utf8')).version;
const layaPkg = JSON.parse(readFileSync(join(repo, 'node_modules/@receptron/laya/package.json'), 'utf8')).version;
const summary = {
  n: ms.length, median_ms: median, p95_ms: q(0.95), mean_ms: ms.reduce((a, b) => a + b, 0) / ms.length,
  min_ms: sorted[0], max_ms: sorted[sorted.length - 1], verify_ms: verifyMs, load_ms: loadMs, warmup_ms: ev.warmupMs,
  evaluator: `${ev.id}@${ev.version}`, node: process.version, onnxruntime_node: ortPkg, receptron_laya: layaPkg,
  intraOpNumThreads: threads ?? 'ORT default', host: os.hostname(), cpu: os.cpus()[0]?.model, nproc: os.cpus().length,
  loadavg: os.loadavg(), finished: new Date().toISOString(),
};
if (arg('--summary')) writeFileSync(arg('--summary'), JSON.stringify(summary, null, 1) + '\n');
console.log(JSON.stringify(summary));
await ev.close();
console.log('NODE_PATH_DONE');
