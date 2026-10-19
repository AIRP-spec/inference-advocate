// Box-only latency bench for step-744 (GGUF, template v3) via LocalEvaluator.evaluate(): same pinned length set and held-out suite
// as the shared-model Node bench. Timing = per-item wall time around evaluate(). Read-only; no gate, no scoring.
import { createHash } from 'node:crypto'; import { readFileSync, writeFileSync } from 'node:fs'; import { join } from 'node:path';
import { performance } from 'node:perf_hooks'; import os from 'node:os';
const repo = process.argv[2], gguf = process.argv[3], pinned = process.argv[4], suitePath = process.argv[5], out = process.argv[6];
const { LocalEvaluator } = await import(join(repo, 'packages/evaluator-local/dist/index.js'));
const { Taxonomy } = await import(join(repo, 'packages/core/dist/index.js'));
const taxonomy = Taxonomy.loadFromFile(join(repo, 'data/taxonomy/flags.v0.json'));
const ev = new LocalEvaluator({ taxonomy, modelPath: gguf, modelSha256: '3e5d2fd83b37fa620431c80e203374fe3fa8045acad7876db0049a290e267f3e', promptTemplateVersion: 'v3', gpu: false });
await ev.load();
const q = (s, p) => s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
const stats = (ms) => { const s = [...ms].sort((a, b) => a - b); const med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return { n: s.length, median_ms: med, p95_ms: q(s, 0.95), mean_ms: ms.reduce((a, b) => a + b, 0) / ms.length }; };
const suite = JSON.parse(readFileSync(suitePath, 'utf8')).items;
async function t(content) { const s = performance.now(); await ev.evaluate({ providerId: 'bench', content, prompt: '' }); return performance.now() - s; }
for (const it of suite.slice(0, 20)) await t(it.content);
const res = { buckets: {}, host: os.hostname(), cpu: os.cpus()[0].model, nproc: os.cpus().length, node: process.version, evaluator: 'local-llm@3e5d2fd83b37+v3' };
const rows = readFileSync(pinned, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
for (const b of [...new Set(rows.map((r) => r.bucket))]) { const ms = []; for (const r of rows.filter((r) => r.bucket === b)) ms.push(await t(r.text)); res.buckets[b] = stats(ms); console.log('bucket', b, JSON.stringify(res.buckets[b])); }
const sm = []; for (const it of suite) sm.push(await t(it.content)); res.suite = stats(sm); console.log('suite', JSON.stringify(res.suite));
writeFileSync(out, JSON.stringify(res, null, 1)); console.log('DONE');
