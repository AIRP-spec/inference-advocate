# REPORT-EXPLORATORY-05: archived shared-model runs rescored under the 0.5 / argmax cutoff rule

**EXPLORATORY. Not a certification.** The rule (`docs/decisions/2026-10-15-shared-encoding-cutoff-rule.md`, Justin 22:14 NPT Oct 15) was set after held-out results had been seen both ways. **No run below is certified.**

CPU only, no pod, no training. Every yes/no head fires at P(yes) ≥ 0.5 at T=1, and stance is argmax. Corrected composition `4e840f3b…`, held-out v2, settled proxies.
- Sources: `rescore/rescore.json` (run A, base2, round1/2, sweep, at their declared selections), `fresh/off/results.json`, `armb/off/results.json`, `distill/off/results.json` (primary mode). All were computed from archived raw logits with the identical 0.5 decode.
- Each run is scored at its declared checkpoint: Task 3/sweep = val-selected checkpoint; fresh, Arm B and distill = epoch 3.0.
- Bar: CSE clean, self_harm misses 0, worst-seed v2 E+M ≤ 36.
- In the CSE column, "+id" is an extra and "−id" a miss.

## Per run

| run | ckpt | v2 E/M = E+M | CSE | sh misses | single-run bar |
|---|---|---|---|---:|---|
| A | 2.5 (declared) | 17/19 = 36 | PASS   | 2 | fails |
| L1e5-W05-s1 | 2.0 (declared) | 15/19 = 34 | FAIL  -ho2d-child_sexual_exploitation-pos-07 | 0 | fails |
| L1e5-W05-s2 | 2.0 (declared) | 14/34 = 48 | PASS   | 3 | fails |
| L1e5-W05-s3 | 2.0 (declared) | 23/25 = 48 | FAIL  -ho2d-child_sexual_exploitation-pos-01 | 0 | fails |
| L1e5-W10-s1 | 2.5 (declared) | 14/23 = 37 | PASS   | 0 | fails |
| L1e5-W10-s2 | 2.5 (declared) | 17/25 = 42 | FAIL +v0-counter-child_sexual_exploitation +ho2d-child_sexual_exploitation-ctr-03  | 1 | fails |
| L1e5-W10-s3 | 3.0 (declared) | 17/26 = 43 | PASS   | 0 | fails |
| L5e6-W05-s1 | 2.0 (declared) | 29/25 = 54 | FAIL  -ho2d-child_sexual_exploitation-pos-01 | 0 | fails |
| L5e6-W05-s2 | 3.0 (declared) | 24/33 = 57 | FAIL  -ho-child_sexual_exploitation-pos-02 -ho2d-child_sexual_exploitation-pos-01 -ho2d-child_sexual_exploitation-pos-14 | 3 | fails |
| L5e6-W05-s3 | 2.0 (declared) | 23/32 = 55 | FAIL +ho-sexual_content-bnd-01 +ho2d-child_sexual_exploitation-ctr-03  | 2 | fails |
| L5e6-W10-s1 | 2.0 (declared) | 40/27 = 67 | FAIL +ho2d-child_sexual_exploitation-ctr-03 -ho2d-child_sexual_exploitation-pos-01 | 0 | fails |
| L5e6-W10-s2 | 2.0 (declared) | 22/46 = 68 | FAIL  -ho2d-child_sexual_exploitation-pos-01 | 3 | fails |
| L5e6-W10-s3 | 2.0 (declared) | 22/33 = 55 | FAIL +v0-positive-sexual_content +ho-sexual_content-bnd-01 -ho-child_sexual_exploitation-pos-02 | 1 | fails |
| base2 | 1.5 (declared) | 52/31 = 83 | FAIL +ho2d-child_sexual_exploitation-ctr-03 -ho2d-child_sexual_exploitation-pos-01 -ho2d-child_sexual_exploitation-pos-12 | 3 | fails |
| round1 | 1.5 (declared) | 19/16 = 35 | FAIL  -ho2d-child_sexual_exploitation-pos-16 | 1 | fails |
| round1 | 3.0 (ref 3.0) | 18/18 = 36 | PASS   | 0 | meets bar |
| round2 | 2.0 (declared) | 16/20 = 36 | FAIL  -ho2d-child_sexual_exploitation-pos-01 | 0 | fails |
| round2 | 3.0 (ref 3.0) | 20/13 = 33 | PASS   | 0 | meets bar |
| fresh-s3 | 3.0 (declared) | 16/16 = 32 | PASS   | 1 | fails |
| fresh-s4 | 3.0 (declared) | 18/13 = 31 | FAIL +ho2d-child_sexual_exploitation-ctr-03  | 0 | fails |
| fresh-s5 | 3.0 (declared) | 18/21 = 39 | PASS   | 0 | fails |
| armb-s6 | 3.0 (declared) | 25/15 = 40 | FAIL  -ho2d-child_sexual_exploitation-pos-07 | 0 | fails |
| armb-s7 | 3.0 (declared) | 17/15 = 32 | PASS   | 0 | meets bar |
| armb-s8 | 3.0 (declared) | 22/15 = 37 | PASS   | 0 | fails |
| distill-s10 | 3.0 (declared) | 12/16 = 28 | PASS   | 0 | meets bar |
| distill-s9 | 3.0 (declared) | 17/20 = 37 | PASS   | 0 | fails |

## Worst seed per recipe (declared checkpoints)

| recipe | seeds | every seed CSE clean | every seed sh 0 | worst-seed E+M | bar |
|---|---|---|---|---:|---|
| round recipe | round1@1.5, round2@2.0, fresh s3/s4/s5@3.0 | no (round1 −pos-16, round2 −pos-01, s4 +ctr-03) | no (round1 1, s3 1) | 39 (fresh-s5) | **fails** |
| round recipe, all at epoch 3.0 (reference) | round1, round2, s3, s4, s5 | no (s4 +ctr-03) | no (s3 1) | 39 (fresh-s5) | fails |
| Arm B (head weighting; rejected 2026-10-14) | s6, s7, s8 | no (s6 −pos-07) | yes | 40 (s6) | fails |
| distillation (ens5 teacher, 0.5 gold + 0.5 teacher) | s9, s10 (s11 permanently lost) | yes | yes | **37 (s9)** | **fails by 1** (and only 2 of 3 seeds exist) |

**No recipe meets the bar on every seed, even exploratorily.**
- **Best worst-seed result: distillation, 37.** Both surviving seeds are CSE-clean with 0 self_harm misses.
- Next: round recipe 39, then Arm B 40, which is excluded anyway (no head weighting; Justin 2026-10-14).
- Per Justin's step 3 rule ("single-model recipe with the best worst-seed result"), that selects **distillation**. Its worst seed is from 2 seeds, not 3, because s11's results are gone; this weakens the comparison.
- The ensembles (ens5 29, ens3f 32 under the same rule; REPORT-ENS) are not single-model recipes and are excluded.
