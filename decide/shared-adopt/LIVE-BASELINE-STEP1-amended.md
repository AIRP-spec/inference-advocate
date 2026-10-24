# Live baseline step 1 — after ho-violence-bnd-05 suite amendment

Date: 2026-10-18. Suite sha `82f8e720…` (was `6c7b30e1…`). Source: recompute of step-744 got[] from `live-baseline/gate-step744.log` against the amended gold (see `live-baseline/step744-limit-after-bnd05.json` sha `d7e7168e…`).

| evaluator | v2 E | v2 M | E+M | notes |
|---|---|---|---|---|
| step-744 (`3e5d2fd8…`) | 21 | 12 | **33** | CSE clean; 2 self_harm misses. Was 20/12=32 under old gold; +1 is CA on bnd-05 becoming an extra. |
| rule (`airp-rule-evaluator@0.1.0+tax.v0.5.0`) | 5 | 100 | **105** | Was 5/101=106; CA miss on bnd-05 removed. |

**Limit for attempt 4: v2 E+M ≤ 33.** Composition 2a does not change step-744 (direct class verdicts).
