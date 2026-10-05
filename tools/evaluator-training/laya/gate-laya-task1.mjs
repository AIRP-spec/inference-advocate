#!/usr/bin/env node
/**
 * Task 1 (1a/1c): gate Laya primitive probabilities on held-out v2 and the v1-207 subset.
 *
 * Replaces the cloud-agent placeholder (which ran no inference, composed nothing, and had a
 * syntax error: `await import` inside a non-async function). Model inference happens in Python
 * (trainpack Agent.predict); this script takes per-item probabilities, applies a threshold set,
 * composes ONLY via the shared `compose` from @airp/evaluator-local, and scores with the shared
 * `scoreHeldOutGateDual`. No second compose implementation.
 *
 * Input JSONL rows: {"id", "stance_probs": {stance: p}, "p_true": {primitive: p}}
 * Thresholds JSON:  {"name": "...", "noul": {primitive: thr}}  (missing primitive -> 0.5)
 *                   or the literal string "default" (0.5 everywhere; stance argmax).
 *
 * Usage: node gate-laya-task1.mjs --probs P.jsonl --thresholds T.json|default --label L --out R.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const { compose, scoreHeldOutGateDual, loadHeldOutSuiteFromFile, loadGateConfigFromFile, sha256FileHex } =
  await import('@airp/evaluator-local');

export const OBJECTS = ['violence_person', 'self_harm', 'sexual_activity', 'financial_crime', 'intrusion', 'weapons', 'profanity'];
export const QUALIFIERS = ['is_mention_not_use', 'subject_is_minor', 'exceeds_common_knowledge', 'addresses_own_nature',
  'asserts_interior_state', 'directed_at_user', 'explicit_register', 'targets_protected_characteristic', 'untethered_to_content'];
export const STANCES = ['conveys_method', 'depicts', 'describes', 'encourages', 'endorses'];
const PATHS = {
  suite: join(repo, 'data/evaluator-gate/held-out-suite.v2.json'),
  gate: join(repo, 'data/evaluator-gate/gate.json'),
  composition: join(repo, 'tools/evaluator-training/primitives/compositions/airp-v0.5.0.json'),
  proxies: join(repo, 'tools/evaluator-training/primitives/gold-proxies.v0.5.0.json'),
  taxonomy: join(repo, 'data/taxonomy/flags.v0.json'),
};
const PINS = {
  suite: '6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4',
  composition: '4def0b8fd339713bd261106cb10235949f4bd1bc4e3631a88dd7cc511b0087e0',
  proxies: 'c601c183eeebe537cb6f80c5f33826803d892f0563e0b9d3cb645d1d0ede6c51',
};
// Qwen per-atom audit (per-atom-precision-converged.json) used different gold for two atoms.
// Reported alongside, never substituted (brief: report disagreement rather than choosing).
const QWEN_AUDIT_VARIANT = {
  'object:violence_person': { expectIncludes: ['violence'], note: 'Qwen audit: violence only (gold 24) vs proxy file CA|violence (gold 45)' },
  'object:financial_crime': { expectIncludes: ['criminal_assistance'], exclude: ['violence'], note: 'Qwen audit: CA without violence (gold 21) vs proxy file CA (gold 31)' },
};

/** Fails if any proxy names a class not in flags.v0.json (brief: shared fix, step 1). */
export function checkProxies(proxies, taxonomy) {
  const classes = new Set(taxonomy.flags.map((f) => f.type));
  const bad = [];
  for (const [prim, def] of Object.entries(proxies.primitives)) {
    for (const c of def.expectIncludes) if (!classes.has(c)) bad.push(`${prim} -> ${c}`);
  }
  if (bad.length) throw new Error(`gold proxy names classes not in flags.v0.json: ${bad.join(', ')}`);
  return [...classes].sort();
}

export function applyThresholds(row, thr) {
  const stance = STANCES.reduce((best, s) => ((row.stance_probs[s] ?? -1) > (row.stance_probs[best] ?? -1) ? s : best), STANCES[0]);
  const fired = (q) => row.p_true[q] >= (thr?.[q] ?? 0.5);
  return { stance, objects: OBJECTS.filter(fired), qualifiers: QUALIFIERS.filter(fired) };
}

function primFired(prims, key) {
  const [kind, name] = key.split(':');
  if (kind === 'stance') return prims.stance === name;
  return (kind === 'object' ? prims.objects : prims.qualifiers).includes(name);
}

export function perPrimitivePR(items, primsById, proxies) {
  const out = {};
  for (const [key, def] of Object.entries(proxies)) {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (const it of items) {
      const gold = def.expectIncludes.some((c) => it.expect.includes(c)) && !(def.exclude || []).some((c) => it.expect.includes(c));
      const yes = primFired(primsById.get(it.id), key);
      if (yes && gold) tp++; else if (yes) fp++; else if (gold) fn++; else tn++;
    }
    out[key] = { tp, fp, fn, tn, goldYes: tp + fn, modelYes: tp + fp,
      precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null };
  }
  return out;
}

function summarize(score, suiteItems) {
  const byId = new Map(score.rows.map((r) => [r.id, r]));
  const clean = suiteItems.filter((i) => i.expect.length === 0);
  return {
    n: score.n,
    extras: score.extraClassFires,
    recallMisses: score.recallFailures.length,
    recallMissedClassInstances: score.recallFailures.reduce((a, r) => a + r.missing.length, 0),
    cleanFires: clean.filter((i) => byId.get(i.id).extra.length > 0).length,
    cleanN: clean.length,
    pass: score.pass,
  };
}

export function gate(rows, thr, label) {
  for (const [k, p] of Object.entries(PINS)) {
    const got = sha256FileHex(PATHS[k]);
    if (got !== p) throw new Error(`${k} SHA mismatch: ${got}`);
  }
  const taxonomy = JSON.parse(readFileSync(PATHS.taxonomy, 'utf8'));
  const proxies = JSON.parse(readFileSync(PATHS.proxies, 'utf8'));
  const classes = checkProxies(proxies, taxonomy);
  const composition = JSON.parse(readFileSync(PATHS.composition, 'utf8'));
  const suite = loadHeldOutSuiteFromFile(PATHS.suite);
  const gateCfg = loadGateConfigFromFile(PATHS.gate);
  const byId = new Map(rows.map((r) => [r.id, r]));
  if (rows.length !== suite.items.length) throw new Error(`rows ${rows.length} != suite ${suite.items.length}`);
  const primsById = new Map();
  const verdicts = suite.items.map((it) => {
    const r = byId.get(it.id);
    if (!r) throw new Error(`missing ${it.id}`);
    const prims = applyThresholds(r, thr);
    primsById.set(it.id, prims);
    return { id: it.id, got: compose(prims, composition), ms: 0 };
  });
  const dual = scoreHeldOutGateDual(suite, gateCfg, verdicts, PATHS.suite);
  const v1ids = new Set(JSON.parse(readFileSync(join(repo, 'data/evaluator-gate/held-out-suite.v1.json'), 'utf8')).items.map((i) => i.id));
  const perClass = classes.map((type) => {
    const scoped = suite.items.filter((i) => i.expect.includes(type));
    const rowsById = new Map(dual.full.rows.map((r) => [r.id, r]));
    return { type, n: scoped.length,
      missed: scoped.filter((i) => rowsById.get(i.id).missing.includes(type)).length,
      extra: dual.full.rows.filter((r) => r.extra.includes(type)).length };
  });
  const cse = perClass.find((c) => c.type === 'child_sexual_exploitation');
  return {
    label,
    thresholds: thr ?? 'default 0.5 / stance argmax',
    pins: { ...PINS, gateJson: sha256FileHex(PATHS.gate) },
    composeSource: 'compose() from @airp/evaluator-local (packages/evaluator-local/src/compose-primitives.ts)',
    v2: summarize(dual.full, suite.items),
    v1_207: summarize(dual.historicalSubset, suite.items.filter((i) => v1ids.has(i.id))),
    cse: { ...cse, pass: cse.missed === 0 && cse.extra === 0 },
    perClass,
    perPrimitive: perPrimitivePR(suite.items, primsById, proxies.primitives),
    perPrimitiveQwenAuditVariant: perPrimitivePR(suite.items, primsById, QWEN_AUDIT_VARIANT),
    recallFailures: dual.full.recallFailures.map((r) => ({ id: r.id, missing: r.missing, extra: r.extra })),
    extraRows: dual.full.rows.filter((r) => r.extra.length).map((r) => ({ id: r.id, extra: r.extra })),
    perItem: suite.items.map((it) => ({ id: it.id, prims: primsById.get(it.id), got: verdicts.find((v) => v.id === it.id).got })),
  };
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const probs = arg('--probs');
  const thrArg = arg('--thresholds') ?? 'default';
  const rows = readFileSync(probs, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const thr = thrArg === 'default' ? null : JSON.parse(readFileSync(thrArg, 'utf8')).noul;
  const rep = gate(rows, thr, arg('--label') ?? probs);
  rep.probsSha256 = createHash('sha256').update(readFileSync(probs)).digest('hex');
  writeFileSync(arg('--out'), JSON.stringify(rep, null, 1) + '\n');
  console.log(JSON.stringify({ label: rep.label, v2: rep.v2, v1_207: rep.v1_207, cse: rep.cse }));
}
