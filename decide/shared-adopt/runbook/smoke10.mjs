#!/usr/bin/env node
// Demo-switch smoke test (runbook A6/B6). NOT run yet. Builds the evaluator exactly as the daemon does (AIRP_EVALUATOR_CONFIG ->
// createOnDeviceEvaluator from the deployed checkout's dist) and checks ten mixed held-out items against the archived Python record.
// Usage: AIRP_EVALUATOR_CONFIG=<checkout>/.advocate/evaluator.json node smoke10.mjs <checkout> <avgs14-rr-id-python.jsonl>
import { readFileSync } from 'node:fs'; import { join, resolve, dirname } from 'node:path';
const [checkout, pyRef] = process.argv.slice(2);
const cfgPath = process.env.AIRP_EVALUATOR_CONFIG; if (!cfgPath) { console.error('AIRP_EVALUATOR_CONFIG not set'); process.exit(2); }
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
if (cfg.engine !== 'laya-shared-onnx') { console.error(`config engine is ${cfg.engine ?? 'gguf'}, expected laya-shared-onnx`); process.exit(2); }
const rel = (p) => resolve(checkout, p);
cfg.modelPath = rel(cfg.modelPath); cfg.laya.pinsPath = rel(cfg.laya.pinsPath); cfg.laya.compositionPath = rel(cfg.laya.compositionPath);
const { createOnDeviceEvaluator, compose } = await import(join(checkout, 'packages/evaluator-local/dist/index.js'));
const { Taxonomy } = await import(join(checkout, 'packages/core/dist/index.js'));
const taxonomy = Taxonomy.loadFromFile(join(checkout, 'data/taxonomy/flags.v0.json'));
const ev = await createOnDeviceEvaluator(cfg, taxonomy);
const comp = JSON.parse(readFileSync(cfg.laya.compositionPath, 'utf8'));
const suite = Object.fromEntries(JSON.parse(readFileSync(join(checkout, 'data/evaluator-gate/held-out-suite.v2.json'), 'utf8')).items.map((i) => [i.id, i]));
const py = Object.fromEntries(readFileSync(pyRef, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((r) => [r.id, r]));
// mixed: 2 clean, persona, relational, sycophancy, 2 self_harm (the two step-744 misses), violence, hate, CSE refusal counter (ctr-03)
const IDS = ['v0-counter-persona_claims', 'tax1-counter-persona_claims', 'ho-persona_claims-pos-02', 'ho-relational_hooks-pos-02',
  'ho-sycophancy-pos-02', 'ho2c-self_harm-pos-04', 'ho2c-self_harm-pos-12', 'ho-violence-bnd-05', 'ho-hate-pos-02', 'ho2d-child_sexual_exploitation-ctr-03'];
let ok = 0;
for (const id of IDS) {
  const item = suite[id]; if (!item || !py[id]) { console.log(`MISSING ${id}`); continue; }
  const flags = await ev.evaluate({ providerId: 'smoke', content: item.content, prompt: item.prompt ?? '' });
  const got = flags.map((f) => f.type).sort();
  const want = compose(py[id].prims, comp).sort();
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (pass) ok++;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${id.padEnd(40)} got=[${got}] python=[${want}] gold=[${item.expect}]`);
}
console.log(ok === IDS.length ? `SMOKE_PASS ${ok}/${IDS.length}` : `SMOKE_FAIL ${ok}/${IDS.length}`); process.exit(ok === IDS.length ? 0 : 1);
