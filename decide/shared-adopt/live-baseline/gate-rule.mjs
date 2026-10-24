// Held-out v2 gate for the RULE evaluator (repo / unset-config default), scored exactly as tools/evaluator-training/gate.mjs (a47c4ef) scores step-744:
// same suite, gate.json, taxonomy, scoreHeldOutGateDual. Run from the a47c4ef worktree (live tryairp code). Read-only.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const repo = process.argv[2], out = process.argv[3];
const { Taxonomy, RuleEvaluator } = await import(join(repo, 'packages/core/dist/index.js'));
const { loadHeldOutSuiteFromFile, loadGateConfigFromFile, scoreHeldOutGateDual, sha256FileHex } = await import(join(repo, 'packages/evaluator-local/dist/index.js'));
const rec = JSON.parse(readFileSync(join(repo, 'tools/evaluator-training/recipe.json'), 'utf8'));
const taxonomy = Taxonomy.loadFromFile(join(repo, rec.taxonomyFile));
const suitePath = join(repo, rec.heldOutSuite), gate = loadGateConfigFromFile(join(repo, 'data/evaluator-gate/gate.json'));
const suite = loadHeldOutSuiteFromFile(suitePath);
if (sha256FileHex(suitePath) !== gate.suiteSha256) throw new Error('suite sha');
const ev = new RuleEvaluator(taxonomy);
const verdicts = [];
for (const item of suite.items) { const t0 = performance.now(); const flags = await ev.evaluate({ providerId: 'held-out', content: item.content, prompt: item.prompt }); verdicts.push({ id: item.id, got: flags.map((f) => f.type), ms: performance.now() - t0 }); }
const d = scoreHeldOutGateDual(suite, gate, verdicts, suitePath), s = d.full, h = d.historicalSubset;
const perClass = taxonomy.flags.map((f) => f.type).map((type) => ({ type, n: suite.items.filter((i) => i.expect.includes(type)).length,
  missed: s.rows.filter((r) => r.missing.includes(type)).length, extra: s.rows.filter((r) => r.extra.includes(type)).length }));
const rep = { evaluator: `${ev.id}@${ev.version}`, taxonomySha256: sha256FileHex(join(repo, rec.taxonomyFile)), suiteSha256: gate.suiteSha256, n: s.n,
  extraClassFires: s.extraClassFires, recallFailures: s.recallFailures.map((r) => ({ id: r.id, missing: r.missing, extra: r.extra })),
  extraRows: s.rows.filter((r) => r.extra.length > 0).map((r) => ({ id: r.id, extra: r.extra, missing: r.missing })), perClass, pass: s.pass,
  historicalSubset: { name: gate.historicalSubset.name, n: h.n, extraClassFires: h.extraClassFires, recallFailures: h.recallFailures.length, pass: h.pass }, verdicts };
writeFileSync(out, JSON.stringify(rep, null, 2) + '\n');
console.log(rep.evaluator, 'v2 E', s.extraClassFires, 'M', s.recallFailures.length, 'v1-207 E', h.extraClassFires, 'M', h.recallFailures.length);
