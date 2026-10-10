#!/usr/bin/env node
/**
 * Task 5 (follow-up 2026-10-06): per-primitive error table for the SHARED-ENCODING model (3b, run A) and Laya side by side.
 * READ ONLY: reads per-item primitive outputs already gated (followup/shared/offline/gates, decide/step4/offline/gates).
 * No inference, no GPU, no corpus rows written. Methodology = decide/adopt/per-primitive-laya.mjs (same gold logic, same settled proxies).
 *
 * Rule (fixed in this header BEFORE any number was computed for the shared model):
 *   per primitive and checkpoint on held-out v2 (471 items): over-fires <=> FP > FN; under-fires <=> FN > FP; neither <=> FP == FN.
 *   Shared model: converged = A epoch 2.0 / 2.5 / 3.0 (steps 456 / 570 / 681), the same definition the 3b declaration used for CSE.
 *   "Fails on every converged checkpoint" = over-fires on all three, or under-fires on all three.
 *   Comparison column: Laya 5766 (selected) and Laya converged 7688 / 9610 / 10099, same rule.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const REPO = '/workspace/airp/decide/repo-step1';
const GATES_L = '/workspace/airp/decide/step4/offline/gates';
const GATES_S = '/workspace/airp/decide/followup/shared/offline/gates';
const OUT = '/workspace/airp/decide/followup/proposal';
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
  { model: 'shared', ckpt: 'A-ckpt-epoch-2.0-step-456', step: 456, converged: true, selected: false },
  { model: 'shared', ckpt: 'A-ckpt-epoch-2.5-step-570', step: 570, converged: true, selected: true },
  { model: 'shared', ckpt: 'A-ckpt-epoch-3.0-step-681', step: 681, converged: true, selected: false },
  { model: 'laya', ckpt: 'ckpt-epoch-1.5-step-5766', step: 5766, converged: false, selected: true },
  { model: 'laya', ckpt: 'ckpt-epoch-2.0-step-7688', step: 7688, converged: true, selected: false },
  { model: 'laya', ckpt: 'ckpt-epoch-2.5-step-9610', step: 9610, converged: true, selected: false },
  { model: 'laya', ckpt: 'ckpt-epoch-2.6-step-10099', step: 10099, converged: true, selected: false },
];
const dir = (r) => (r.fp > r.fn ? 'over' : r.fn > r.fp ? 'under' : 'neither');
const inputs = {}; const results = [];
for (const c of CKPTS) {
  const p = path.join(c.model === 'shared' ? GATES_S : GATES_L, `.gate-${c.model}-${c.ckpt}.json`); inputs[p] = shaFile(p);
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
  results.push({ ...c, perItem: g.perItem.map((r) => r.id), gateFile: p, gateFileSha256: inputs[p], primitivesSha256: g.primitivesSha256, composedV2: g.v2, cse: g.cse, gateRowsReproduced: checked, scores });
}
const verdictOf = (model) => { const conv = results.filter((r) => r.model === model && r.converged); const v = {};
  for (const k of KEYS) { const ds = conv.map((r) => r.scores.v2[k].direction);
    v[k] = ds.every((d) => d === 'over') ? 'over' : ds.every((d) => d === 'under') ? 'under' : ds.every((d) => d !== 'neither') ? 'flips' : 'not consistent'; }
  return v; };
const verdictShared = verdictOf('shared'), verdictLaya = verdictOf('laya');
// error item ids (v2) per primitive per checkpoint, for overlap analysis (ids only, no text)
const errIds = {};
for (const r of results) { const g = J(r.gateFile); const verdicts = new Map(g.perItem.map((x) => [x.id, x.prims])); errIds[`${r.model}:${r.step}`] = {};
  for (const k of KEYS) { const fp = [], fn = []; for (const it of suite) { const gd = goldNew(k, it); if (gd === null || gd === undefined) continue;
    const y = k === COMPOSITE ? anyMember(verdicts.get(it.id)) : has(verdicts.get(it.id), k); if (y && !gd) fp.push(it.id); else if (!y && gd) fn.push(it.id); }
    errIds[`${r.model}:${r.step}`][k] = { fp, fn }; } }
const notAssessable = Object.keys(NEW.excluded).concat(NEW.stance.excludedStances.map((s) => `stance:${s.stance}`));
const failing = KEYS.filter((k) => verdictShared[k] === 'over' || verdictShared[k] === 'under');
const out = { generatedBy: 'followup/proposal/per-primitive-shared.mjs', generatedBySha256: shaFile(new URL(import.meta.url).pathname), pins: PINS, inputs,
  rule: 'over: FP>FN; under: FN>FP; neither: FP==FN. Fails on every converged = same direction on all converged checkpoints. shared converged = A 2.0/2.5/3.0; laya converged = 7688/9610/10099. v2 n=471. Fixed before scoring.',
  failingShared: failing, verdictShared, verdictLaya, notAssessableUnderSettledProxies: notAssessable,
  checkpoints: results.map((r) => ({ ...r, perItem: undefined, gateFile: undefined })), errIds };
fs.writeFileSync(path.join(OUT, 'PER-PRIMITIVE-SHARED.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ failingShared: failing, verdictShared, verdictLaya }, null, 1));
