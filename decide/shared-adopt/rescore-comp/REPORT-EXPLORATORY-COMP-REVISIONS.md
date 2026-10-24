# EXPLORATORY rescore under composition revisions 2a / 2a2b (amended suite)
Suite: `82f8e720…` (bnd-05 violence only). Base composition `4e840f3b…`. 2a `59ddf1f6…`. 2a2b `d5e19ed4…`.
Archived runs rescored: **201** (all with val). Converged (epoch≥2.0) + averages: **105**.
## Verdict on 2b
**2b is NOT adopted.** Persona_claims false fires on validation rose under 2b vs 2a:
- All 201 runs: val PC FP sum 1306 → 1402 (**+96**); rises on 38 runs, drops on 0.
- Converged subset: val PC FP sum 414 → 422 (**+8**); rises on 7 runs.
Per the ADR condition: stop, leave 2b un-adopted, report to Justin.
## 2a effect (base → 2a) on converged/avg
- v2 E+M delta distribution: {-1: 84, -2: 10, 0: 10, -3: 1}
- SC (extra_delta, miss_delta) distribution: {(-2, 1): 84, (-2, 0): 7, (-2, 2): 10, (-5, 2): 1, (-3, 1): 3}
- PC unchanged. CSE unchanged. CA unchanged by composition (suite amendment alone changes bnd-05).
- Typical: **−2 SC extras** (bnd-05 and pos-09 no longer co-fire SC), **+1 SC miss** (bnd-02: encourages without explicit_register, gold CSE+SC).
- Net: usually **E+M −1**.
## Spotlight: FRESH-07 averages (amended suite)
| run | base E+M | 2a E+M | 2a2b E+M | val PC fp base/2a/2a2b |
|---|---|---|---|---|
| avg-f05-s12-ep2.0-2.5-3.0 | 20/15=35 | 18/16=34 | 18/15=33 | 2/2/2 |
| avg-f05-s13-ep2.0-2.5-3.0 | 20/15=35 | 18/16=34 | 18/16=34 | 7/7/7 |
| avg-f05-s14-ep2.0-2.5-3.0 | 16/13=29 | 14/13=27 | 14/13=27 | 3/3/3 |
| avg-f06-s15-ep2.0-2.5-3.0 | 18/18=36 | 16/19=35 | 16/19=35 | 6/6/6 |
| avg-f07-s18-ep2.0-2.5-3.0 | 16/14=30 | 14/15=29 | 14/15=29 | 3/3/3 |
| avg-f07-s19-ep2.0-2.5-3.0 | 17/13=30 | 15/14=29 | 15/13=28 | 1/1/1 |
| avg-f07-s20-ep2.0-2.5-3.0 | 16/19=35 | 14/20=34 | 14/20=34 | 3/3/3 |
