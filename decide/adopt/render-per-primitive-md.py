#!/usr/bin/env python3
"""Render PER-PRIMITIVE.md from PER-PRIMITIVE.json (no new numbers; formatting only)."""
import json, hashlib
d = json.load(open('PER-PRIMITIVE.json'))
jsha = hashlib.sha256(open('PER-PRIMITIVE.json', 'rb').read()).hexdigest()
f = lambda x: '—' if x is None else f'{x:.2f}'
cks = d['checkpoints']; conv = [c for c in cks if c['converged']]
L = []; P = L.append
P('# Task 5: Laya per-primitive P/R with settled proxies (read only)')
P('')
P(f"Brief: `decide/adopt/BRIEF-laya-adoption-2026-10-06.md` (sha256 `{d['brief']['sha256']}`), Task 5. Generated 2026-10-06 (NPT) by `decide/adopt/per-primitive-laya.mjs` (sha256 `{d['generatedBySha256']}`); data: `PER-PRIMITIVE.json` (sha256 `{jsha}`).")
P('')
P('**No corpus rows were written. No inference, no GPU.** Inputs are the per-item primitive outputs the deciding run already gated (`decide/step4/offline/gates/.gate-laya-*.json`, committed in PR #28 at 80c604b).')
P('')
P('## Inputs and checks')
P('')
P('- Model: Laya deciding-run retrain (labels v4 `6399fd4a…`, group-held-out split), primary thresholds. Converged = 7688 / 9610 / 10099 (as in the deciding report §5). Selected 5766 shown for reference; it does not enter the rule.')
P('- Gold: held-out v2 class labels, 471 items (suite `6c7b30e1…`), mapped by the **settled proxies** `gold-proxies.v0.5.0.settled.json` sha256 `b086cdac11f8af39b2d3984232ee0372d9ffe909acbd4b8d7fe6d4f653d08455` (box copy and repo copy both verified).')
P('- Gold logic is a verbatim copy of `goldNew()` / `pr()` / `has()` from `rescore-per-primitive.mjs` (commit 2d38803, lines 59-88).')
P(f"- Self-check passed: for all 4 checkpoints, the 11 settled per-primitive rows recomputed here equal `perPrimitive` (tp/fp/fn/tn) in the gate JSON ({sum(c['gateRowsReproduced'] for c in cks)} rows). Each gate JSON pins proxies `b086cdac…`.")
P('- Stance rows are scored only on the 122 stance-determined items (349 unknown), as in Step 1. The composite `any(financial_crime, intrusion, weapons)` is the settled proxies\' stand-in for those three objects (10 items gold-unknown).')
P('')
P('## Rule (written into the script header before any number was computed)')
P('')
P('Per primitive and checkpoint on v2: **over-fires** if FP > FN, **under-fires** if FN > FP, neither if FP = FN (including 0/0). **Consistently failing** = the same direction on all three converged checkpoints.')
P('')
P('## Consistently failing primitives (the list the brief asks for)')
P('')
P('| # | primitive | direction | converged 7688 / 9610 / 10099: FP, FN | P/R range on converged | 5766 (sel.) FP, FN |')
P('|---|---|---|---|---|---|')
sel = [c for c in cks if c['selected']][0]
rows = []
for i, e in enumerate(d['consistentlyFailing'], 1):
    k = e['key']; v = 'over' if e['verdict'].startswith('over') else 'under'
    fpfn = ' / '.join(f"{c['scores']['v2'][k]['fp']}, {c['scores']['v2'][k]['fn']}" for c in conv)
    ps = [c['scores']['v2'][k]['precision'] for c in conv]; rs = [c['scores']['v2'][k]['recall'] for c in conv]
    rng = lambda a: f(min(a)) if f(min(a)) == f(max(a)) else f'{f(min(a))}–{f(max(a))}'
    s = sel['scores']['v2'][k]
    label = f"{k} *(composite, not a single primitive)*" if e['isComposite'] else k
    P(f"| {i} | {label} | **{v}-fires** | {fpfn} | P {rng(ps)} / R {rng(rs)} | {s['fp']}, {s['fn']} |")
    m = min(c['scores']['v2'][k]['fp' if v == 'over' else 'fn'] for c in conv)
    rows.append((m, k, v, [c['scores']['v2'][k]['fp' if v == 'over' else 'fn'] for c in conv]))
P('')
P('Not consistent (direction differs or is neutral on at least one converged checkpoint): ' + ', '.join(f'`{k}`' for k, v in d['verdictByKey'].items() if v == 'not consistent') + '.')
flip = [k for k, v in d['verdictByKey'].items() if 'flips' in v]
P('Errs on all three but flips direction: ' + (', '.join(flip) if flip else 'none') + '.')
P('')
P('Not assessable under the settled proxies (excluded from per-primitive P/R by PROXY-DECISIONS.md, no gold): ' + ', '.join(f'`{k}`' for k in d['notAssessableUnderSettledProxies']) + '. The three CA objects are covered only through the composite row.')
P('')
P('## Size of each failure (read before sizing the round)')
P('')
P('The rule above has no materiality floor, so several entries rest on one to three items out of about 24 gold positives. Below, the same list ordered by the **smallest** error count in the failing direction across the three converged checkpoints. This ordering is a post-hoc view to help size the round. It is **not** a second rule and removes nothing from the list above.')
P('')
P('| primitive | direction | errors in that direction (7688 / 9610 / 10099) | min |')
P('|---|---|---|---|')
for m, k, v, es in sorted(rows, key=lambda r: -r[0]):
    P(f"| {k} | {v} | {' / '.join(map(str, es))} | {m} |")
P('')
P('Reading: `addresses_own_nature` over-firing (20–29 false fires per converged checkpoint, P 0.43–0.52) and `directed_at_user` over-firing (5–8) are the large, stable failures. The CA composite under-fires (4–7 misses of 21 gold, R 0.67–0.81) and `exceeds_common_knowledge` over-fires (4–10). Everything else is at most 6 errors and mostly 1–3; `stance:describes` is one false fire on each checkpoint.')
P('')
P('## Full table (v2, n=471; cell = P/R, tp/fp/fn; dir o=over, u=under, n=neither)')
P('')
P('| primitive | ' + ' | '.join(c['ckpt'].replace('ckpt-epoch-', 'ep').replace('-step-', ' s') + (' (sel.)' if c['selected'] else ' (conv.)') for c in cks) + ' | verdict |')
P('|---|' + '---|' * len(cks) + '---|')
for k, v in d['verdictByKey'].items():
    cells = []
    for c in cks:
        s = c['scores']['v2'][k]
        cells.append(f"{f(s['precision'])}/{f(s['recall'])} ({s['tp']}/{s['fp']}/{s['fn']}) {s['direction'][0]}")
    P(f"| {k} | " + ' | '.join(cells) + f" | {v} |")
P('')
P('v1-207 subset numbers are in the JSON (`checkpoints[].scores.v1_207`).')
P('')
P('## Input checksums')
P('')
P('| file | sha256 |'); P('|---|---|')
for p, s in {**d['pins'], **d['inputs']}.items(): P(f'| `{p}` | `{s}` |')
open('PER-PRIMITIVE.md', 'w').write('\n'.join(L) + '\n')
