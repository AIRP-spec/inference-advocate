#!/usr/bin/env node
/**
 * Task 2 analysis: agreement, default-threshold gate, per-primitive P/R with the shared proxy file,
 * CSE across checkpoints, ECE. Fits nothing.
 *
 *   node report-task2.mjs --runs DIR --greedy DIR --out results.json
 * DIR(runs): ck-<step>.jsonl from score-per-primitive.mjs run
 * DIR(greedy): existing gate-report-step-<step>.json (greedy generation gate, 2026-09-14)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const ev = await import('@airp/evaluator-local');
const { verdictFromScoredPasses } = await import('./readout.mjs');
const PASSES = ev.buildAllPerPrimitivePrompts(ev.PRIMITIVES_CATALOGUE_V1);
// Primary readout = scored WITHOUT prefix reuse: bitwise deterministic on GPU and independent of pass
// order / KV-cache history. The prefix-reuse variant is reported against it (identity section).
const PRIMARY = 'scoredNoReuse';
const SECONDARY = 'scoredReuse';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []),
);
const STEPS = (args.steps || '6420,8560,10700,12840').split(',').map(Number);
const CONVERGED = [8560, 10700, 12840];
const sha256 = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const PROXY_PATH = path.join(repoRoot, 'tools/evaluator-training/primitives/gold-proxies.v0.5.0.json');
const PROXY_SHA = 'c601c183eeebe537cb6f80c5f33826803d892f0563e0b9d3cb645d1d0ede6c51';
if (sha256(PROXY_PATH) !== PROXY_SHA) throw new Error('shared proxy file SHA changed');
const proxies = JSON.parse(fs.readFileSync(PROXY_PATH, 'utf8')).primitives;
const flags = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/taxonomy/flags.v0.json'), 'utf8'));
const validClasses = new Set(flags.flags.map((f) => f.type));
// Check required by the brief: fail the report if a proxy names a class not in flags.v0.json.
for (const [k, v] of Object.entries(proxies)) {
  for (const c of v.expectIncludes) if (!validClasses.has(c)) throw new Error(`proxy ${k} names unknown class ${c}`);
}

const suitePath = path.join(repoRoot, 'data/evaluator-gate/held-out-suite.v2.json');
const suite = ev.loadHeldOutSuiteFromFile(suitePath);
const gate = ev.loadGateConfigFromFile(path.join(repoRoot, 'data/evaluator-gate/gate.json'));
const v1 = ev.loadHeldOutSuiteFromFile(path.join(repoRoot, 'data/evaluator-gate/held-out-suite.v1.json'));
const composition = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tools/evaluator-training/primitives/compositions/airp-v0.5.0.json'), 'utf8'));
const itemsById = new Map(suite.items.map((i) => [i.id, i]));
const STANCES = ev.PRIMITIVES_CATALOGUE_V1.stance.map((s) => s.primitive);
const OBJECTS = ev.PRIMITIVES_CATALOGUE_V1.objects.map((s) => s.primitive);
const QUALS = ev.PRIMITIVES_CATALOGUE_V1.qualifiers.map((s) => s.primitive);
const YN = [...OBJECTS, ...QUALS];
const kindOf = (p) => (OBJECTS.includes(p) ? 'object' : 'qualifier');

function readRun(p) {
  const lines = fs.readFileSync(p, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  return { header: lines[0], items: lines.filter((l) => l.kind === 'item'), footer: lines.find((l) => l.kind === 'footer') };
}

function gateScore(composedById) {
  const verdicts = suite.items.map((i) => ({ id: i.id, got: composedById.get(i.id), ms: 0 }));
  const dual = ev.scoreHeldOutGateDual(suite, gate, verdicts, suitePath);
  const f = dual.full;
  const h = dual.historicalSubset;
  const clean = f.rows.filter((r) => itemsById.get(r.id).expect.length === 0 && r.extra.length > 0).length;
  const v1Clean = new Set(v1.items.filter((i) => i.expect.length === 0).map((i) => i.id));
  const hClean = h.rows.filter((r) => v1Clean.has(r.id) && r.extra.length > 0).length;
  const perClass = flags.flags.map((d) => {
    const scoped = suite.items.filter((i) => i.expect.includes(d.type));
    const missed = scoped.filter((i) => f.rows.find((r) => r.id === i.id).missing.includes(d.type)).length;
    const extra = f.rows.filter((r) => r.extra.includes(d.type)).length;
    return { type: d.type, n: scoped.length, missed, extra, pass: missed === 0 && extra === 0 };
  });
  return {
    v2: { extra: f.extraClassFires, recallMisses: f.recallFailures.length, cleanFires: clean, perClassPass: perClass.filter((r) => r.pass).length },
    v1_207: { extra: h.extraClassFires, recallMisses: h.recallFailures.length, cleanFires: hClean },
    cse: perClass.find((r) => r.type === 'child_sexual_exploitation'),
    perClass,
    extraIds: f.rows.filter((r) => r.extra.length).map((r) => r.id),
    missIds: f.rows.filter((r) => r.missing.length).map((r) => r.id),
  };
}

function goldFor(key, item) {
  const p = proxies[key];
  if (!p) return null;
  return p.expectIncludes.some((c) => item.expect.includes(c));
}
function prRow(yesFn, key) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const item of suite.items) {
    const g = goldFor(key, item);
    if (g === null) return null;
    const y = yesFn(item.id);
    if (y && g) tp++; else if (y && !g) fp++; else if (!y && g) fn++; else tn++;
  }
  return { tp, fp, fn, tn, precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null, yesRate: (tp + fp) / suite.items.length };
}
function ece(pairs, bins = 10) {
  const B = Array.from({ length: bins }, () => ({ n: 0, p: 0, y: 0 }));
  for (const [p, y] of pairs) {
    const b = Math.min(bins - 1, Math.floor(p * bins));
    B[b].n++; B[b].p += p; B[b].y += y ? 1 : 0;
  }
  const n = pairs.length;
  return B.reduce((acc, b) => acc + (b.n ? (b.n / n) * Math.abs(b.p / b.n - b.y / b.n) : 0), 0);
}
const primitiveKeys = [...STANCES.map((s) => `stance:${s}`), ...OBJECTS.map((o) => `object:${o}`), ...QUALS.map((q) => `qualifier:${q}`)];
function verdictHas(v, key) {
  const [k, name] = key.split(':');
  if (k === 'stance') return v.stance === name;
  return (k === 'object' ? v.objects : v.qualifiers).includes(name);
}

const results = { proxyFileSha256: PROXY_SHA, primaryReadout: PRIMARY, steps: {}, notes: [] };
for (const step of STEPS) {
  const run = readRun(path.join(args.runs, `ck-${step}.jsonl`));
  if (run.items.length !== suite.items.length) throw new Error(`ck-${step}: ${run.items.length} items`);
  const greedyReport = JSON.parse(fs.readFileSync(path.join(args.greedy, `gate-report-step-${step}.json`), 'utf8'));
  const greedyById = new Map(greedyReport.perItemPrimitives.map((r) => [r.id, r]));
  const R = { ggufSha256: run.header.ggufSha256, systemInfo: run.header.systemInfo, agreement: {}, identity: {}, };

  // --- 2d agreement: scored top vs uncapped greedy, per primitive
  const passes = run.header.passes;
  for (const p of passes) {
    let agree = 0, agreeReuse = 0, n = 0, uncappedInvalid = 0, freeInvalid = 0, freeAgree = 0, nFree = 0, capVsUncapped = 0, reuseTopSame = 0, maxDp = 0, safety = 0;
    const disagreeIds = [];
    for (const it of run.items) {
      const r = it.passes[p];
      n++;
      const unc = r.greedyUncapped.trim();
      if (!r.answers.includes(unc)) uncappedInvalid++;
      if (r.greedyUncappedStop === 'safetyMax') safety++;
      if (unc === r[PRIMARY].top) agree++; else disagreeIds.push(it.id);
      if (unc === r[SECONDARY].top) agreeReuse++;
      if (r.greedyCapped !== unc) capVsUncapped++;
      if (r.free !== undefined) { nFree++; if (!r.answers.includes(r.free.trim())) freeInvalid++; if (r.free.trim() === r[PRIMARY].top) freeAgree++; }
      if (r.scoredNoReuse) {
        if (r.scoredNoReuse.top === r.scoredReuse.top) reuseTopSame++;
        for (const a of r.answers) maxDp = Math.max(maxDp, Math.abs(r.scoredNoReuse.probs[a] - r.scoredReuse.probs[a]));
      }
    }
    R.agreement[p] = { n, agree, rate: agree / n, agreeReuse, rateReuse: agreeReuse / n, disagreeIds, uncappedInvalid, safetyMaxHits: safety, cappedDiffersFromUncapped: capVsUncapped, free: nFree ? { n: nFree, invalid: freeInvalid, agreeWithScored: freeAgree } : null, reuseVsNoReuse: { topSame: reuseTopSame, maxAbsDeltaP: maxDp } };
  }
  // identity of this run's capped greedy (gate decode) with the archived gate's per-item primitives
  let idSame = 0;
  const idDiff = [];
  for (const it of run.items) {
    const g = greedyById.get(it.id).primitives;
    const v = { stance: it.passes.stance.greedyCapped, objects: OBJECTS.filter((o) => it.passes[o].greedyCapped === 'yes'), qualifiers: QUALS.filter((q) => it.passes[q].greedyCapped === 'yes') };
    const same = v.stance === g.stance && v.objects.join() === [...g.objects].join() && v.qualifiers.join() === [...g.qualifiers].join();
    if (same) idSame++; else idDiff.push({ id: it.id, archived: g, rerun: v });
  }
  R.identity.cappedGreedyVsArchivedGate = { same: idSame, n: run.items.length, diffs: idDiff };
  // scored reuse vs no-reuse: composed identity and every top-answer flip with its probabilities
  const primaryVerdict = new Map(run.items.map((it) => [it.id, verdictFromScoredPasses(PASSES, Object.fromEntries(passes.map((p) => [p, it.passes[p][PRIMARY]])))]));
  const reuseVerdict = new Map(run.items.map((it) => [it.id, it.scoredVerdict]));
  const composedSame = run.items.filter((it) => ev.compose(primaryVerdict.get(it.id), composition).join() === it.scoredComposed.join()).length;
  const flips = [];
  for (const it of run.items) for (const p of passes) {
    const a = it.passes[p][PRIMARY], b = it.passes[p][SECONDARY];
    if (a.top !== b.top) flips.push({ id: it.id, primitive: p, noReuse: a.probs, reuse: b.probs });
  }
  R.identity.scoredReuseVsNoReuse = { composedSame, n: run.items.length, topFlips: flips.length, passesCompared: run.items.length * passes.length, flips };
  for (const it of run.items) if (it.scoredNoReuseComposed && it.scoredNoReuseComposed.join() !== ev.compose(primaryVerdict.get(it.id), composition).join()) throw new Error('primary compose drift');

  // --- gates
  const scoredComposed = new Map(run.items.map((it) => [it.id, ev.compose(primaryVerdict.get(it.id), composition)]));
  const reuseComposed = new Map(run.items.map((it) => [it.id, ev.compose(reuseVerdict.get(it.id), composition)]));
  for (const it of run.items) if (reuseComposed.get(it.id).join() !== it.scoredComposed.join()) throw new Error('compose drift');
  const uncappedVerdicts = new Map(run.items.map((it) => [it.id, { stance: it.passes.stance.greedyUncapped.trim(), objects: OBJECTS.filter((o) => it.passes[o].greedyUncapped.trim() === 'yes'), qualifiers: QUALS.filter((q) => it.passes[q].greedyUncapped.trim() === 'yes') }]));
  const archivedComposed = new Map(greedyReport.perItemPrimitives.map((r) => [r.id, ev.compose(r.primitives, composition)]));
  R.gate = {
    scored: gateScore(scoredComposed),
    scoredReuse: gateScore(reuseComposed),
    greedyArchived: gateScore(archivedComposed),
    greedyUncappedRerun: gateScore(new Map([...uncappedVerdicts].map(([id, v]) => [id, ev.compose(v, composition)]))),
    greedyArchivedReported: { v2: { extra: greedyReport.extraClassFires, recallMisses: greedyReport.recallFailures.length, cleanFires: greedyReport.cleanFires.length }, v1_207: { extra: greedyReport.historicalSubset.extraClassFires, recallMisses: greedyReport.historicalSubset.recallFailures.length } },
  };
  // --- per-primitive P/R (shared proxies) + yes rate, scored vs archived greedy
  const scoredV = primaryVerdict;
  R.perPrimitive = {};
  for (const key of primitiveKeys) {
    R.perPrimitive[key] = {
      proxy: proxies[key]?.expectIncludes ?? null,
      scored: prRow((id) => verdictHas(scoredV.get(id), key), key),
      greedy: prRow((id) => verdictHas(greedyById.get(id).primitives, key), key),
      scoredYesRate: run.items.filter((it) => verdictHas(scoredV.get(it.id), key)).length / run.items.length,
      greedyYesRate: greedyReport.perItemPrimitives.filter((r) => verdictHas(r.primitives, key)).length / run.items.length,
    };
  }
  // --- ECE per primitive on held-out (diagnostic, against the shared proxy as gold)
  R.ece = {};
  for (const key of primitiveKeys) {
    if (!proxies[key]) { R.ece[key] = null; continue; }
    const [k, name] = key.split(':');
    const pairs = run.items.map((it) => {
      const item = itemsById.get(it.id);
      const p = k === 'stance' ? it.passes.stance[PRIMARY].probs[name] : it.passes[name][PRIMARY].probs.yes;
      return [p, goldFor(key, item)];
    });
    R.ece[key] = ece(pairs);
  }
  // stance top-label confidence ECE is not defined without stance gold; mean confidence reported instead
  R.meanTopConfidence = Object.fromEntries(passes.map((p) => [p, run.items.reduce((a, it) => a + it.passes[p][PRIMARY].probs[it.passes[p][PRIMARY].top], 0) / run.items.length]));
  R.ties = run.items.reduce((a, it) => a + YN.filter((p) => it.passes[p][PRIMARY].probs.yes === 0.5).length, 0);
  results.steps[step] = R;
}
// CSE named gate across converged checkpoints
results.cseAcrossConverged = Object.fromEntries(CONVERGED.map((s) => [s, { scored: results.steps[s]?.gate.scored.cse, greedy: results.steps[s]?.gate.greedyArchived.cse }]));
fs.writeFileSync(args.out, JSON.stringify(results, null, 1));
console.log(`wrote ${args.out}`);
