#!/usr/bin/env node
/**
 * Re-score every existing per-item primitive output (Qwen per-primitive 8056 CKs, Laya original + group-split
 * retrain) with the SETTLED gold proxies, beside the old shared proxies. CPU only; no inference.
 * Brief: decide/BRIEF-deciding-run-2026-10-05.md, Step 1 item 4.
 *
 *   node tools/evaluator-training/primitives/settled-proxies/rescore-per-primitive.mjs \
 *     --qwen-runs /workspace/airp/task2/out --qwen-greedy /workspace/airp-primitives-overnight/gate-reports-8056 \
 *     --laya /workspace/airp/task1/out --out-json rescore-old-vs-new.json --out-md rescore-old-vs-new.md
 *
 * Self-checks (the script throws on failure, so a report is never written on a broken input):
 *   1. SHA pins: suite v2/v1, flags (v0.5.0), composition, old proxies, settled proxies.
 *   2. Class check (check-proxy-classes.mjs) on both proxy files.
 *   3. Old P/R recomputed here must equal every old P/R already on disk (task2 results.json perPrimitive,
 *      Laya gate-*.json perPrimitive), proving the per-item inputs are the ones the old tables came from.
 *   4. Primitives whose proxy did not change must give identical numbers under both files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { checkProxies } from './check-proxy-classes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const A = {
  qwenRuns: opt('--qwen-runs', '/workspace/airp/task2/out'),
  qwenGreedy: opt('--qwen-greedy', '/workspace/airp-primitives-overnight/gate-reports-8056'),
  laya: opt('--laya', '/workspace/airp/task1/out'),
  outJson: opt('--out-json', 'rescore-old-vs-new.json'),
  outMd: opt('--out-md', 'rescore-old-vs-new.md'),
  conclusions: opt('--conclusions', path.join(here, 'CONCLUSIONS.md')),
};
const shaFile = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const R = (rel) => path.join(repoRoot, rel);
const PINS = {
  'data/evaluator-gate/held-out-suite.v2.json': '6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4',
  'data/evaluator-gate/held-out-suite.v1.json': 'f577129b649a36e1914c74772d023790429cf46a7acb4db58046b9c859ad8014',
  'data/taxonomy/flags.v0.json': '0de1cacc74cbdf0452e3785b37ccf00bf6f65683e0b448983c2330fb9c1729b1',
  'tools/evaluator-training/primitives/compositions/airp-v0.5.0.json': '4def0b8fd339713bd261106cb10235949f4bd1bc4e3631a88dd7cc511b0087e0',
  'tools/evaluator-training/primitives/gold-proxies.v0.5.0.json': 'c601c183eeebe537cb6f80c5f33826803d892f0563e0b9d3cb645d1d0ede6c51',
  'tools/evaluator-training/primitives/gold-proxies.v0.5.0.settled.json': 'b086cdac11f8af39b2d3984232ee0372d9ffe909acbd4b8d7fe6d4f653d08455',
};
for (const [rel, want] of Object.entries(PINS)) { const got = shaFile(R(rel)); if (got !== want) throw new Error(`${rel}: sha ${got} != pin ${want}`); }
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const flags = J(R('data/taxonomy/flags.v0.json'));
const OLD = J(R('tools/evaluator-training/primitives/gold-proxies.v0.5.0.json'));
const NEW = J(R('tools/evaluator-training/primitives/gold-proxies.v0.5.0.settled.json'));
checkProxies(OLD, flags);
checkProxies(NEW, flags);
const suite = J(R('data/evaluator-gate/held-out-suite.v2.json')).items;
const v1ids = new Set(J(R('data/evaluator-gate/held-out-suite.v1.json')).items.map((i) => i.id));
if (suite.length !== 471 || v1ids.size !== 207 || ![...v1ids].every((id) => suite.some((i) => i.id === id))) throw new Error('suite shape');
const STANCES = ['describes', 'depicts', 'endorses', 'encourages', 'conveys_method'];
const OBJECTS = ['violence_person', 'self_harm', 'sexual_activity', 'financial_crime', 'intrusion', 'weapons', 'profanity'];
const QUALS = ['targets_protected_characteristic', 'subject_is_minor', 'asserts_interior_state', 'addresses_own_nature', 'explicit_register', 'exceeds_common_knowledge', 'is_mention_not_use', 'directed_at_user', 'untethered_to_content'];
const has = (v, key) => { const [k, n] = key.split(':'); return k === 'stance' ? v.stance === n : (k === 'object' ? v.objects : v.qualifiers).includes(n); };

// ---------- gold ----------
const allowedStances = (item) => item.expect.reduce((a, c) => a.filter((s) => NEW.stance.allowedStancesByClass[c].includes(s)), STANCES);
const goldOld = (key, item) => (OLD.primitives[key] ? OLD.primitives[key].expectIncludes.some((c) => item.expect.includes(c)) : undefined);
function goldNew(key, item) { // true / false / null(unknown) / undefined(excluded)
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
const OLD_KEYS = Object.keys(OLD.primitives).sort();
const NEW_KEYS = [...Object.keys(NEW.primitives), ...NEW.stance.reportedStances.map((s) => `stance:${s}`)].sort();
const COMPOSITE = Object.keys(NEW.composites)[0];
const anyMember = (v) => NEW.composites[COMPOSITE].members.some((m) => has(v, m));

function score(verdicts) {
  const out = {};
  for (const [subset, items] of [['v2', suite], ['v1_207', suite.filter((i) => v1ids.has(i.id))]]) {
    const old = {}, neu = {};
    for (const k of OLD_KEYS) old[k] = pr(items, verdicts, (it) => goldOld(k, it), (v) => has(v, k));
    for (const k of NEW_KEYS) neu[k] = pr(items, verdicts, (it) => goldNew(k, it), (v) => has(v, k));
    const determined = items.filter((it) => allowedStances(it).length === 1);
    const constrained = items.filter((it) => { const n = allowedStances(it).length; return n > 0 && n < 5; });
    const supp = {
      [COMPOSITE]: pr(items, verdicts, (it) => goldNew(COMPOSITE, it), anyMember),
      stanceAdmissibility: { n: constrained.length, inside: constrained.filter((it) => allowedStances(it).includes(verdicts.get(it.id).stance)).length },
      stanceExcludedPredictedOnDetermined: Object.fromEntries(NEW.stance.excludedStances.map(({ stance: s }) => [s, { n: determined.length, predicted: determined.filter((it) => verdicts.get(it.id).stance === s).length }])),
      stanceUnreachableItems: items.filter((it) => allowedStances(it).length === 0).map((it) => it.id),
      isMentionNotUseOnDescribesClassItems: (() => { const s = items.filter((it) => it.expect.some((c) => NEW.excluded['qualifier:is_mention_not_use'].certainNoWhen.includesAny.includes(c))); return { n: s.length, modelYes: s.filter((it) => has(verdicts.get(it.id), 'qualifier:is_mention_not_use')).length }; })(),
      excludedYesRate: Object.fromEntries(Object.keys(NEW.excluded).map((k) => [k, items.filter((it) => has(verdicts.get(it.id), k)).length / items.length])),
    };
    supp.stanceAdmissibility.rate = supp.stanceAdmissibility.inside / supp.stanceAdmissibility.n;
    out[subset] = { old, new: neu, supplementary: supp };
  }
  // self-check 4: unchanged proxies give identical numbers
  for (const k of Object.keys(NEW.primitives)) if (OLD.primitives[k] && OLD.primitives[k].expectIncludes.join() === NEW.primitives[k].expectIncludes.join()) {
    const a = out.v2.old[k], b = out.v2.new[k];
    if (a.tp !== b.tp || a.fp !== b.fp || a.fn !== b.fn) throw new Error(`unchanged proxy ${k} scored differently`);
  }
  return out;
}

// ---------- sources ----------
const sources = [];
const inputs = {};
inputs[A.conclusions] = shaFile(A.conclusions);
const close = (a, b) => (a === null || a === undefined) ? (b === null || b === undefined) : Math.abs(a - b) < 1e-9;
function checkOld(label, recomputed, reported, fields) { // self-check 3
  for (const [k, r] of Object.entries(reported)) {
    const m = recomputed[k];
    if (!m) throw new Error(`${label}: reported key ${k} missing`);
    for (const f of fields) if (!close(m[f.mine], r[f.theirs])) throw new Error(`${label} ${k}.${f.theirs}: recomputed ${m[f.mine]} != reported ${r[f.theirs]}`);
  }
  return Object.keys(reported).length;
}
const FIELDS = [{ mine: 'tp', theirs: 'tp' }, { mine: 'fp', theirs: 'fp' }, { mine: 'fn', theirs: 'fn' }, { mine: 'precision', theirs: 'precision' }, { mine: 'recall', theirs: 'recall' }];

// Qwen: task2 per-item runs (scored no-reuse = primary, scored reuse, greedy uncapped re-run) + archived 09-14 greedy gate.
const qwenResultsPath = path.join(A.qwenRuns, 'results.json');
const qwenResults = J(qwenResultsPath); inputs[qwenResultsPath] = shaFile(qwenResultsPath);
for (const ck of ['6420', '8560', '10700', '12840']) {
  const runPath = path.join(A.qwenRuns, `ck-${ck}.jsonl`);
  const grPath = path.join(A.qwenGreedy, `gate-report-step-${ck}.json`);
  inputs[runPath] = shaFile(runPath); inputs[grPath] = shaFile(grPath);
  const items = fs.readFileSync(runPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((l) => l.kind === 'item');
  if (items.length !== 471) throw new Error(`${runPath}: ${items.length} items`);
  const yn = (it, f) => ({ objects: OBJECTS.filter((o) => f(it.passes[o])), qualifiers: QUALS.filter((q) => f(it.passes[q])) });
  const readouts = {
    scoredNoReuse: new Map(items.map((it) => [it.id, { stance: it.passes.stance.scoredNoReuse.top, ...yn(it, (p) => p.scoredNoReuse.probs.yes >= 0.5) }])),
    scoredReuse: new Map(items.map((it) => [it.id, it.scoredVerdict])),
    greedyUncappedRerun: new Map(items.map((it) => [it.id, { stance: it.passes.stance.greedyUncapped.trim(), ...yn(it, (p) => p.greedyUncapped.trim() === 'yes') }])),
    greedyArchived0914: new Map(J(grPath).perItemPrimitives.map((r) => [r.id, r.primitives])),
  };
  for (const [readout, verdicts] of Object.entries(readouts)) {
    if (verdicts.size !== 471) throw new Error(`${ck} ${readout}: ${verdicts.size}`);
    const s = score(verdicts);
    const rep = qwenResults.steps[ck].perPrimitive;
    let checked = 0;
    const repKey = { scoredNoReuse: 'scored', greedyArchived0914: 'greedy' }[readout];
    if (repKey) checked = checkOld(`qwen ${ck} ${readout}`, s.v2.old, Object.fromEntries(Object.entries(rep).filter(([, v]) => v[repKey]).map(([k, v]) => [k, v[repKey]])), FIELDS);
    sources.push({ model: 'qwen-per-primitive-8056', ckpt: `CK-${ck}`, condition: readout, converged: ck !== '6420', inputFiles: readout.startsWith('greedyArchived') ? [grPath] : [runPath], oldReportedRowsReproduced: checked, scores: s });
  }
}
// Laya: every gate json in orig/ and retrain/ (perItem prims at that json's thresholds).
for (const run of ['orig', 'retrain']) {
  const dir = path.join(A.laya, run);
  for (const f of fs.readdirSync(dir).filter((f) => /^gate-.*\.json$/.test(f)).sort()) {
    const p = path.join(dir, f); inputs[p] = shaFile(p);
    const g = J(p);
    const verdicts = new Map(g.perItem.map((r) => [r.id, r.prims]));
    if (verdicts.size !== 471) throw new Error(`${p}: ${verdicts.size}`);
    const s = score(verdicts);
    const checked = checkOld(`laya ${f}`, s.v2.old, g.perPrimitive, [{ mine: 'tp', theirs: 'tp' }, { mine: 'fp', theirs: 'fp' }, { mine: 'fn', theirs: 'fn' }, { mine: 'precision', theirs: 'precision' }, { mine: 'recall', theirs: 'recall' }]);
    const m = f.match(/^gate-(ckpt-epoch-[\d.]+-step-(\d+))-(.+)\.json$/);
    const step = Number(m[2]);
    const converged = run === 'orig' ? [7704, 9630, 10160].includes(step) : [7688, 9610, 10099].includes(step);
    const selected = (run === 'orig' && step === 10160) || (run === 'retrain' && step === 9610);
    sources.push({ model: run === 'orig' ? 'laya-orig' : 'laya-retrain-groupsplit', ckpt: m[1], condition: m[3], converged, selected, inputFiles: [p], oldReportedRowsReproduced: checked, scores: s });
  }
}

// ---------- write JSON ----------
const out = {
  generatedBy: 'tools/evaluator-training/primitives/settled-proxies/rescore-per-primitive.mjs',
  brief: 'decide/BRIEF-deciding-run-2026-10-05.md Step 1 item 4',
  pins: PINS,
  inputs,
  oldProxyFile: { path: 'tools/evaluator-training/primitives/gold-proxies.v0.5.0.json', sha256: PINS['tools/evaluator-training/primitives/gold-proxies.v0.5.0.json'] },
  newProxyFile: { path: 'tools/evaluator-training/primitives/gold-proxies.v0.5.0.settled.json', sha256: PINS['tools/evaluator-training/primitives/gold-proxies.v0.5.0.settled.json'] },
  checks: { classCheck: 'passed (old and settled)', oldTablesReproduced: sources.reduce((a, s) => a + s.oldReportedRowsReproduced, 0), unchangedProxiesIdentical: 'passed' },
  newKeys: NEW_KEYS, oldKeys: OLD_KEYS, excluded: Object.keys(NEW.excluded), excludedStances: NEW.stance.excludedStances.map((s) => s.stance),
  sources,
};
fs.writeFileSync(A.outJson, JSON.stringify(out, null, 1) + '\n');

// ---------- write MD ----------
const f2 = (x) => (x === null || x === undefined ? '—' : (Math.round(x * 100) / 100).toFixed(2));
const cell = (r) => (r ? `${f2(r.precision)}/${f2(r.recall)}` : 'excl.');
const L = [];
const P = (s = '') => L.push(s);
const find = (model, ckpt, cond) => sources.find((s) => s.model === model && s.ckpt === ckpt && s.condition === cond);
const CHANGED = ['object:violence_person', 'object:financial_crime', 'object:intrusion', 'object:weapons', 'stance:describes', 'stance:depicts', 'stance:endorses', 'stance:encourages', 'stance:conveys_method'];
const ALLKEYS = [...new Set([...OLD_KEYS, ...NEW_KEYS])].sort((a, b) => (CHANGED.includes(b) - CHANGED.includes(a)) || a.localeCompare(b));
function table(title, cols) {
  P(`### ${title}`); P();
  P('Each cell: **old** P/R (shared proxies `c601c183`) → **settled** P/R (`b086cdac`). "excl." means excluded from per-primitive P/R by PROXY-DECISIONS.md. Settled stance rows are scored on the determined subset only (v2: 122 items, i.e. describes 68, conveys_method 31, encourages 23; `ho-multi-02` unreachable and excluded); all other items are unknown for stance.'); P();
  P(`| primitive | ${cols.map((c) => c.name).join(' | ')} |`);
  P(`|---|${cols.map(() => '---').join('|')}|`);
  for (const k of ALLKEYS) {
    const mark = CHANGED.includes(k) ? `**${k}**` : k;
    P(`| ${mark} | ${cols.map((c) => { const s = c.src.scores.v2; const o = s.old[k], n = s.new[k]; const same = o && n && o.tp === n.tp && o.fp === n.fp && o.fn === n.fn; return same ? `${cell(o)} (same)` : `${o ? cell(o) : 'no proxy'} → ${n ? cell(n) : 'excl.'}`; }).join(' | ')} |`);
  }
  P(`| _composite any(fc,intr,weap), suppl._ | ${cols.map((c) => cell(c.src.scores.v2.supplementary[COMPOSITE])).join(' | ')} |`);
  P(`| _stance admissibility (inside/n), suppl._ | ${cols.map((c) => { const a = c.src.scores.v2.supplementary.stanceAdmissibility; return `${a.inside}/${a.n}`; }).join(' | ')} |`);
  P(`| _depicts / endorses predicted on determined items (all wrong)_ | ${cols.map((c) => { const e = c.src.scores.v2.supplementary.stanceExcludedPredictedOnDetermined; return `${e.depicts.predicted} / ${e.endorses.predicted} of ${e.depicts.n}`; }).join(' | ')} |`);
  P(`| _is_mention_not_use on PC/SY/SO items (certain no; yes/n)_ | ${cols.map((c) => { const e = c.src.scores.v2.supplementary.isMentionNotUseOnDescribesClassItems; return `${e.modelYes}/${e.n}`; }).join(' | ')} |`);
  P();
}
const qcols = (cond) => ['6420', '8560', '10700', '12840'].map((ck) => ({ name: `Qwen CK-${ck}${ck === '6420' ? '' : ' (conv.)'}`, src: find('qwen-per-primitive-8056', `CK-${ck}`, cond) }));
const lcols = (model, cond) => sources.filter((s) => s.model === model && s.condition === cond).map((s) => ({ name: `${s.ckpt.replace('ckpt-epoch-', 'ep').replace('-step-', ' s')}${s.selected ? ' (sel.)' : s.converged ? ' (conv.)' : ''}`, src: s }));

// Headline numbers
const sel = { q: ['8560', '10700', '12840'].map((ck) => find('qwen-per-primitive-8056', `CK-${ck}`, 'scoredNoReuse')), lo: find('laya-orig', 'ckpt-epoch-2.6-step-10160', 'default'), lr: find('laya-retrain-groupsplit', 'ckpt-epoch-2.5-step-9610', 'default') };
const rng = (arr) => { const v = arr.filter((x) => x !== null && x !== undefined); if (!v.length) return '—'; const lo = Math.min(...v), hi = Math.max(...v); return f2(lo) === f2(hi) ? f2(lo) : `${f2(lo)}–${f2(hi)}`; };
const head = (k, side, which) => rng(sel.q.map((s) => s.scores.v2[side][k]?.[which]));
const hl = (src, k, side) => cell(src.scores.v2[side][k]);
P('# Step 1 item 4: per-primitive P/R re-scored with the settled proxies (old beside new)'); P();
P(`Generated by \`${out.generatedBy}\` from per-item primitive outputs already on disk (no inference, no GPU). Gold: held-out v2 class labels (471 items; v1-207 subset in the JSON). Old proxies \`c601c183…\`, settled proxies \`b086cdac…\`. Decisions: PROXY-DECISIONS.md.`); P();
P(`Self-checks passed: both proxy files pass the v0.5.0 class check. The old P/R recomputed here reproduces **${out.checks.oldTablesReproduced}** old per-primitive rows already on disk exactly (task2 \`results.json\` scored + greedy, and \`perPrimitive\` in all ${sources.filter((s) => s.model.startsWith('laya')).length} Laya gate JSONs). Primitives whose proxy did not change score identically. ${sources.length} model outputs re-scored: Qwen 4 CKs × 4 readouts (scored no-reuse = primary, scored reuse, greedy uncapped re-run, archived 09-14 greedy); Laya original 6 ckpts × default/fitted/2b (+ 10160 default-from-raw); Laya group-split retrain 6 ckpts × default/2b.`); P();
P('## Headline (v2, default thresholds; Qwen = scored no-reuse on converged CK-8560/10700/12840)'); P();
P('| primitive | Qwen old P/R | Qwen settled P/R | Laya orig 10160 old → settled | Laya retrain 9610 old → settled |');
P('|---|---|---|---|---|');
for (const k of ['stance:describes', 'stance:encourages', 'stance:conveys_method', 'stance:depicts', 'stance:endorses', 'object:violence_person', 'object:financial_crime', 'object:intrusion', 'object:weapons']) {
  P(`| ${k} | ${head(k, 'old', 'precision')}/${head(k, 'old', 'recall')} | ${sel.q[0].scores.v2.new[k] ? `${head(k, 'new', 'precision')}/${head(k, 'new', 'recall')}` : 'excl.'} | ${hl(sel.lo, k, 'old')} → ${sel.lo.scores.v2.new[k] ? hl(sel.lo, k, 'new') : 'excl.'} | ${hl(sel.lr, k, 'old')} → ${sel.lr.scores.v2.new[k] ? hl(sel.lr, k, 'new') : 'excl.'} |`);
}
P();
P('Same rows on the v1-207 subset (207 items, labels identical to v2):'); P();
P('| primitive | Qwen old P/R | Qwen settled P/R | Laya orig 10160 old → settled | Laya retrain 9610 old → settled |');
P('|---|---|---|---|---|');
const h1 = (k, side, which) => rng(sel.q.map((s) => s.scores.v1_207[side][k]?.[which]));
const c1 = (src, k, side) => cell(src.scores.v1_207[side][k]);
for (const k of ['stance:describes', 'stance:encourages', 'stance:conveys_method', 'object:violence_person']) P(`| ${k} | ${h1(k, 'old', 'precision')}/${h1(k, 'old', 'recall')} | ${h1(k, 'new', 'precision')}/${h1(k, 'new', 'recall')} | ${c1(sel.lo, k, 'old')} → ${c1(sel.lo, k, 'new')} | ${c1(sel.lr, k, 'old')} → ${c1(sel.lr, k, 'new')} |`);
P();
P(fs.readFileSync(A.conclusions, 'utf8').trim()); P();
P('## Qwen per-primitive 8056 (v2)'); P();
table('Qwen, scored no-reuse readout (primary; = old report table "scored")', qcols('scoredNoReuse'));
table('Qwen, archived 2026-09-14 greedy gate (= old report table "greedy" and the per-atom audit CKs)', qcols('greedyArchived0914'));
table('Qwen, scored with prefix reuse', qcols('scoredReuse'));
table('Qwen, greedy uncapped re-run (2026-10-05)', qcols('greedyUncappedRerun'));
P('## Laya original run (v2)'); P();
for (const c of ['default', 'fitted', '2b', 'default-from-raw']) table(`Laya original, ${c} thresholds`, lcols('laya-orig', c));
P('## Laya group-split retrain (v2)'); P();
for (const c of ['default', '2b']) table(`Laya retrain, ${c} thresholds`, lcols('laya-retrain-groupsplit', c));
P('## Input checksums'); P();
P('| file | sha256 |'); P('|---|---|');
for (const [p, s] of Object.entries({ ...Object.fromEntries(Object.entries(PINS).map(([k, v]) => [k, v])), ...inputs })) P(`| \`${p}\` | \`${s}\` |`);
fs.writeFileSync(A.outMd, L.join('\n') + '\n');
console.log(`ok: ${sources.length} sources; old rows reproduced ${out.checks.oldTablesReproduced}; wrote ${A.outJson}, ${A.outMd}`);
