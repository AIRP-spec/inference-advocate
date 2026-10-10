#!/usr/bin/env node
/**
 * Task 5 (BRIEF-laya-adoption-2026-10-06): per-primitive P/R for the deciding-run Laya retrain (labels v4,
 * group-held-out split) with the SETTLED gold proxies, across converged checkpoints (7688/9610/10099) plus the
 * selected 5766. READ ONLY: reads the per-item primitive outputs already gated in step4/offline; no inference,
 * no corpus rows written.
 *
 * Classification rule (fixed in this header BEFORE any number was computed):
 *   For each scored primitive and checkpoint on held-out v2 (471 items):
 *     over-fires  <=> FP > FN   (model says yes more often than gold: net excess of false fires)
 *     under-fires <=> FN > FP   (model says yes less often than gold: net excess of misses)
 *     neither     <=> FP == FN  (includes 0/0)
 *   "Consistently failing" = over-fires on EVERY converged checkpoint, or under-fires on EVERY converged
 *   checkpoint. The selected checkpoint (5766, not converged) is reported but does not enter the rule.
 *   Primitives that err on all three but flip direction are reported separately, not listed.
 *   Primitives the settled proxies exclude (no gold) are reported as not assessable.
 *
 * Gold logic = verbatim copy of goldNew()/pr()/has() from
 *   tools/evaluator-training/primitives/settled-proxies/rescore-per-primitive.mjs (lines 59-88, commit 2d38803).
 * Self-check: the 11 settled per-primitive rows recomputed here must equal perPrimitive in each gate JSON
 * (the gate already scored with proxies b086cdac); otherwise throw.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const REPO = '/workspace/airp/decide/repo-step1';
const GATES = '/workspace/airp/decide/step4/offline/gates';
const OUT = '/workspace/airp/decide/adopt';
const shaFile = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const R = (rel) => path.join(REPO, rel);
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const PINS = {
  'data/evaluator-gate/held-out-suite.v2.json': '6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4',
  'data/evaluator-gate/held-out-suite.v1.json': 'f577129b649a36e1914c74772d023790429cf46a7acb4db58046b9c859ad8014',
  'tools/evaluator-training/primitives/gold-proxies.v0.5.0.settled.json': 'b086cdac11f8af39b2d3984232ee0372d9ffe909acbd4b8d7fe6d4f653d08455',
};
for (const [rel, want] of Object.entries(PINS)) { const got = shaFile(R(rel)); if (got !== want) throw new Error(`${rel}: ${got} != ${want}`); }
const settledBox = '/workspace/airp/decide/step1/gold-proxies.v0.5.0.settled.json';
if (shaFile(settledBox) !== PINS['tools/evaluator-training/primitives/gold-proxies.v0.5.0.settled.json']) throw new Error('box settled proxies sha');
const NEW = J(R('tools/evaluator-training/primitives/gold-proxies.v0.5.0.settled.json'));
const suite = J(R('data/evaluator-gate/held-out-suite.v2.json')).items;
const v1ids = new Set(J(R('data/evaluator-gate/held-out-suite.v1.json')).items.map((i) => i.id));
if (suite.length !== 471 || v1ids.size !== 207) throw new Error('suite shape');

// ---- verbatim from rescore-per-primitive.mjs (2d38803) lines 56-88 (OLD-proxy helpers omitted) ----
const STANCES = ['describes', 'depicts', 'endorses', 'encourages', 'conveys_method'];
const has = (v, key) => { const [k, n] = key.split(':'); return k === 'stance' ? v.stance === n : (k === 'object' ? v.objects : v.qualifiers).includes(n); };
const allowedStances = (item) => item.expect.reduce((a, c) => a.filter((s) => NEW.stance.allowedStancesByClass[c].includes(s)), STANCES);
function goldNew(key, item) {
  if (NEW.primitives[key]) return NEW.primitives[key].expectIncludes.some((c) => item.expect.includes(c));
  if (key.startsWith('stance:')) {
    const s = key.slice(7);
    if (!NEW.stance.reportedStances.includes(s)) return undefined;
    const a = allowedStances(item);
    return a.length === 1 ? a[0] === s : null;
  }
  const comp = NEW.composites[key];
  if (comp) {
    if (comp.goldUnknown.includesAll.every((c) => item.expect.includes(c))) return null;
    return comp.goldYes.includesAny.some((c) => item.expect.includes(c)) && !comp.goldYes.lacks.some((c) => item.expect.includes(c));
  }
  return undefined;
}
function pr(items, verdicts, goldFn, yesFn) {
  let tp = 0, fp = 0, fn = 0, tn = 0, unknown = 0;
  for (const it of items) {
    const g = goldFn(it); if (g === undefined) return null;
    if (g === null) { unknown++; continue; }
    const y = yesFn(verdicts.get(it.id));
    if (y && g) tp++; else if (y && !g) fp++; else if (!y && g) fn++; else tn++;
  }
  return { tp, fp, fn, tn, unknown, goldYes: tp + fn, modelYes: tp + fp, precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null };
}
// ---- end verbatim ----

const PRIM_KEYS = Object.keys(NEW.primitives).sort();
const STANCE_KEYS = NEW.stance.reportedStances.map((s) => `stance:${s}`);
const COMPOSITE = Object.keys(NEW.composites)[0];
const anyMember = (v) => NEW.composites[COMPOSITE].members.some((m) => has(v, m));
const KEYS = [...PRIM_KEYS, ...STANCE_KEYS, COMPOSITE];
const CKPTS = [
  { ckpt: 'ckpt-epoch-1.5-step-5766', step: 5766, converged: false, selected: true },
  { ckpt: 'ckpt-epoch-2.0-step-7688', step: 7688, converged: true, selected: false },
  { ckpt: 'ckpt-epoch-2.5-step-9610', step: 9610, converged: true, selected: false },
  { ckpt: 'ckpt-epoch-2.6-step-10099', step: 10099, converged: true, selected: false },
];
const dir = (r) => (r.fp > r.fn ? 'over' : r.fn > r.fp ? 'under' : 'neither');
const inputs = {}; const results = [];
for (const c of CKPTS) {
  const p = path.join(GATES, `.gate-laya-${c.ckpt}.json`); inputs[p] = shaFile(p);
  const g = J(p);
  if (g.pins.proxies !== PINS['tools/evaluator-training/primitives/gold-proxies.v0.5.0.settled.json']) throw new Error(`${p}: gate proxies pin`);
  const verdicts = new Map(g.perItem.map((r) => [r.id, r.prims]));
  if (verdicts.size !== 471) throw new Error(`${p}: ${verdicts.size}`);
  const scores = {};
  for (const [subset, items] of [['v2', suite], ['v1_207', suite.filter((i) => v1ids.has(i.id))]]) {
    scores[subset] = {};
    for (const k of KEYS) {
      const r = k === COMPOSITE ? pr(items, verdicts, (it) => goldNew(k, it), anyMember) : pr(items, verdicts, (it) => goldNew(k, it), (v) => has(v, k));
      scores[subset][k] = { ...r, direction: dir(r) };
    }
  }
  let checked = 0;
  for (const k of PRIM_KEYS) {
    const a = scores.v2[k], b = g.perPrimitive[k];
    if (!b || a.tp !== b.tp || a.fp !== b.fp || a.fn !== b.fn || a.tn !== b.tn) throw new Error(`${c.ckpt} ${k}: recomputed ${JSON.stringify(a)} != gate ${JSON.stringify(b)}`);
    checked++;
  }
  results.push({ ...c, gateFile: p, gateFileSha256: inputs[p], primitivesSha256: g.primitivesSha256, composedV2: g.v2, cse: g.cse, gateRowsReproduced: checked, scores });
}
const conv = results.filter((r) => r.converged);
const verdict = {};
for (const k of KEYS) {
  const ds = conv.map((r) => r.scores.v2[k].direction);
  verdict[k] = ds.every((d) => d === 'over') ? 'over-fires on every converged' : ds.every((d) => d === 'under') ? 'under-fires on every converged' : ds.every((d) => d !== 'neither') ? 'errs on every converged, direction flips' : 'not consistent';
}
const notAssessable = Object.keys(NEW.excluded).concat(NEW.stance.excludedStances.map((s) => `stance:${s.stance}`));
const failing = KEYS.filter((k) => verdict[k].startsWith('over') || verdict[k].startsWith('under'));
const out = {
  generatedBy: 'decide/adopt/per-primitive-laya.mjs', generatedBySha256: shaFile(new URL(import.meta.url).pathname),
  brief: { path: 'decide/adopt/BRIEF-laya-adoption-2026-10-06.md', sha256: '59e142801dac5b4312826162af2e28af092f8250e81a536f442812d5e7f1a6f1', task: 5 },
  rule: 'over-fires: FP>FN; under-fires: FN>FP; neither: FP==FN. Consistently failing = same direction on all converged checkpoints (7688, 9610, 10099), v2 n=471. Fixed before scoring.',
  pins: PINS, inputs, model: 'laya deciding-run retrain (labels v4 6399fd4a…, group-held-out split), primary thresholds',
  convergedSteps: [7688, 9610, 10099], selectedStep: 5766,
  consistentlyFailing: failing.map((k) => ({ key: k, verdict: verdict[k], isComposite: k === COMPOSITE, converged: Object.fromEntries(conv.map((r) => [r.step, (({ tp, fp, fn, precision, recall }) => ({ tp, fp, fn, precision, recall }))(r.scores.v2[k])])) })),
  verdictByKey: verdict, notAssessableUnderSettledProxies: notAssessable,
  checkpoints: results,
};
fs.writeFileSync(path.join(OUT, 'PER-PRIMITIVE.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ failing, verdict }, null, 1));
