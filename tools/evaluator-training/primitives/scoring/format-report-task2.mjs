#!/usr/bin/env node
/** Render the tables of REPORT-task2 from report-task2.mjs results + latency JSONs. Prints markdown. */
import fs from 'node:fs';
const a = process.argv.slice(2);
const opt = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : null);
const R = JSON.parse(fs.readFileSync(opt('--results'), 'utf8'));
const lat = (opt('--latency') || '').split(';').filter(Boolean).map((p) => [p.split('=')[0], JSON.parse(fs.readFileSync(p.split('=')[1], 'utf8'))]);
const steps = Object.keys(R.steps);
const f = (x, d = 3) => (x == null ? '—' : typeof x === 'number' ? (Number.isInteger(x) ? String(x) : x.toFixed(d)) : String(x));
const out = [];
const P = (s = '') => out.push(s);

P('### Agreement: scored top answer vs uncapped greedy (per primitive, all 471 held-out v2 items)');
P();
const passes = Object.keys(R.steps[steps[0]].agreement);
P(`| primitive | ${steps.map((s) => `CK-${s}`).join(' | ')} |`);
P(`|---|${steps.map(() => '---').join('|')}|`);
for (const p of passes) P(`| ${p} | ${steps.map((s) => { const g = R.steps[s].agreement[p]; return `${g.agree}/${g.n}`; }).join(' | ')} |`);
const tot = (s, k) => passes.reduce((acc, p) => acc + R.steps[s].agreement[p][k], 0);
P(`| **all passes** | ${steps.map((s) => `${tot(s, 'agree')}/${tot(s, 'n')} (${(100 * tot(s, 'agree') / tot(s, 'n')).toFixed(2)}%)`).join(' | ')} |`);
P(`| prefix-reuse variant, all passes | ${steps.map((s) => `${tot(s, 'agreeReuse')}/${tot(s, 'n')}`).join(' | ')} |`);
P(`| uncapped greedy invalid (not a trained string) | ${steps.map((s) => tot(s, 'uncappedInvalid')).join(' | ')} |`);
P(`| capped (gate) ≠ uncapped greedy | ${steps.map((s) => tot(s, 'cappedDiffersFromUncapped')).join(' | ')} |`);
P();
P('### Identity checks');
P();
P(`| check | ${steps.map((s) => `CK-${s}`).join(' | ')} |`);
P(`|---|${steps.map(() => '---').join('|')}|`);
P(`| re-run capped greedy = archived 2026-09-14 gate primitives (items) | ${steps.map((s) => `${R.steps[s].identity.cappedGreedyVsArchivedGate.same}/${R.steps[s].identity.cappedGreedyVsArchivedGate.n}`).join(' | ')} |`);
P(`| scored reuse vs no-reuse: composed flags identical (items) | ${steps.map((s) => `${R.steps[s].identity.scoredReuseVsNoReuse.composedSame}/${R.steps[s].identity.scoredReuseVsNoReuse.n}`).join(' | ')} |`);
P(`| scored reuse vs no-reuse: top-answer flips (passes) | ${steps.map((s) => `${R.steps[s].identity.scoredReuseVsNoReuse.topFlips}/${R.steps[s].identity.scoredReuseVsNoReuse.passesCompared}`).join(' | ')} |`);
P();
P('### Gate (default thresholds 0.5 / argmax, shared compose) — scored vs existing greedy');
P();
P('| CK | readout | v2 extras | v2 recall misses | v2 clean fires | v2 classes passing | v1-207 extras | v1-207 recall misses | v1-207 clean fires | CSE (n, missed, extra, pass) |');
P('|---|---|---|---|---|---|---|---|---|---|');
for (const s of steps) {
  const G = R.steps[s].gate;
  for (const [name, g] of [['scored (no reuse)', G.scored], ['scored (prefix reuse)', G.scoredReuse], ['greedy archived 09-14 (recomposed)', G.greedyArchived], ['greedy uncapped re-run', G.greedyUncappedRerun]]) {
    P(`| ${s} | ${name} | ${g.v2.extra} | ${g.v2.recallMisses} | ${g.v2.cleanFires} | ${g.v2.perClassPass}/${g.perClass.length} | ${g.v1_207.extra} | ${g.v1_207.recallMisses} | ${g.v1_207.cleanFires} | ${g.cse.n}, ${g.cse.missed}, ${g.cse.extra}, ${g.cse.pass ? 'PASS' : 'FAIL'} |`);
  }
  const A = G.greedyArchivedReported;
  P(`| ${s} | greedy as reported in 09-14 gate JSON | ${A.v2.extra} | ${A.v2.recallMisses} | ${A.v2.cleanFires} | — | ${A.v1_207.extra} | ${A.v1_207.recallMisses} | — | — |`);
}
P();
P('### CSE named gate across converged checkpoints');
P();
P('| CK | scored | greedy |');
P('|---|---|---|');
for (const [s, v] of Object.entries(R.cseAcrossConverged)) if (v.scored) P(`| ${s} | ${v.scored.pass ? 'PASS' : 'FAIL'} (missed ${v.scored.missed}, extra ${v.scored.extra}) | ${v.greedy.pass ? 'PASS' : 'FAIL'} (missed ${v.greedy.missed}, extra ${v.greedy.extra}) |`);
P();
P('### Per-primitive precision / recall with the shared proxy file (scored no-reuse vs archived greedy)');
P();
P(`| primitive | proxy | ${steps.map((s) => `${s} scored P/R`).join(' | ')} | ${steps.map((s) => `${s} greedy P/R`).join(' | ')} |`);
P(`|---|---|${steps.map(() => '---').join('|')}|${steps.map(() => '---').join('|')}|`);
const pr = (x) => (x ? `${f(x.precision, 2)}/${f(x.recall, 2)}` : 'no proxy');
for (const key of Object.keys(R.steps[steps[0]].perPrimitive)) {
  const row = R.steps[steps[0]].perPrimitive[key];
  P(`| ${key} | ${row.proxy ? row.proxy.join('∪') : '—'} | ${steps.map((s) => pr(R.steps[s].perPrimitive[key].scored)).join(' | ')} | ${steps.map((s) => pr(R.steps[s].perPrimitive[key].greedy)).join(' | ')} |`);
}
P();
P('### Calibration (ECE, 10 equal-width bins, P(yes) or P(stance value) vs shared proxy as gold; diagnostic only)');
P();
P(`| primitive | ${steps.map((s) => `CK-${s}`).join(' | ')} |`);
P(`|---|${steps.map(() => '---').join('|')}|`);
for (const key of Object.keys(R.steps[steps[0]].ece)) P(`| ${key} | ${steps.map((s) => f(R.steps[s].ece[key])).join(' | ')} |`);
P();
if (lat.length) {
  P('### Latency per held-out item (all 17 passes), ms');
  P();
  P('| setup | mode | n | median | p95 | mean |');
  P('|---|---|---|---|---|---|');
  for (const [name, L] of lat) for (const [m, v] of Object.entries(L.summary)) P(`| ${name} | ${m} | ${v.n} | ${f(v.medianMs, 0)} | ${f(v.p95Ms, 0)} | ${f(v.meanMs, 0)} |`);
}
console.log(out.join('\n'));
