// Box CPU, read-only: run live step-744 (local-llm@3e5d2fd83b37+v3, taxonomy v0.5.0, live code a47c4ef) on the label-free
// val split (5be292a9…, 819). Writes per-row fired flag types only (no item text). Reference for the P3-3 FP bar.
import { createHash } from 'node:crypto'; import { readFileSync, writeFileSync } from 'node:fs'; import { join } from 'node:path';
const [repo, gguf, valPath, out] = process.argv.slice(2);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const valRaw = readFileSync(valPath);
if (sha(valRaw) !== '5be292a911f0082a74c6e24beb20a60455fab4a86baded561784d37f2b453009') throw new Error('val sha');
const GG = '3e5d2fd83b37fa620431c80e203374fe3fa8045acad7876db0049a290e267f3e';
if (sha(readFileSync(gguf)) !== GG) throw new Error('gguf sha');
const { LocalEvaluator } = await import(join(repo, 'packages/evaluator-local/dist/index.js'));
const { Taxonomy } = await import(join(repo, 'packages/core/dist/index.js'));
const taxonomy = Taxonomy.loadFromFile(join(repo, 'data/taxonomy/flags.v0.json'));
const ev = new LocalEvaluator({ taxonomy, modelPath: gguf, modelSha256: GG, promptTemplateVersion: 'v3', gpu: false });
await ev.load();
const rows = valRaw.toString('utf8').trim().split('\n').map((l) => JSON.parse(l));
const res = [];
for (const r of rows) {
  const flags = await ev.evaluate({ providerId: 'p33-val-ref', content: r.content, prompt: r.prompt ?? '' });
  res.push({ id: r.id, got: flags.map((f) => f.type).sort() });
  if (res.length % 100 === 0) console.log('done', res.length);
}
writeFileSync(out, res.map((x) => JSON.stringify(x)).join('\n') + '\n');
console.log('STEP744_VAL_DONE', res.length);
