# Stability sweep report (DECLARATION-SWEEP `4d6724dc…`)

Labels v5. 12 runs on SECURE 4090 pod `ke8kyz9qa7dh5b` (05:31–07:51Z train+infer). Selection: best val composed macro-F1 within each run. Primary mode T=1, 0.5/argmax.

## Outcome: **no setting passes. STOP** (no Node step, no further runs without approval).

| setting | pass | worst v2 E+M (bar ≤36) | CSE clean seeds | sh FN=0 seeds | ctr-03 extra seeds |
|---|---|---:|---:|---:|---:|
| L1e5-W05 | FAIL | 48 | 1/3 | 2/3 | 0/3 |
| L1e5-W10 | FAIL | 43 | 2/3 | 2/3 | 1/3 |
| L5e6-W05 | FAIL | 57 | 0/3 | 1/3 | 1/3 |
| L5e6-W10 | FAIL | 68 | 0/3 | 1/3 | 2/3 **(corpus target)** |

## Across-seed spread (selected checkpoint per seed)

| setting | seed | ckpt | val F1 | v2 E/M (=E+M) | CSE | CSE extra / miss | sh FN | aon FP | converged CSE (2.0/2.5/3.0) | converged sh FN |
|---|---|---|---:|---|---|---|---:|---:|---|---|
| L1e5-W05 | 1 | epoch-2.0-step-460 | 0.8296 | 15/19 (=34) | FAIL | — / ho2d-child_sexual_exploitation-pos-07 | 0 | 4 | F/F/F | 0/0/0 |
| L1e5-W05 | 2 | epoch-2.0-step-460 | 0.8452 | 14/34 (=48) | PASS | — / — | 3 | 4 | P/F/P | 3/0/0 |
| L1e5-W05 | 3 | epoch-2.0-step-460 | 0.8192 | 23/25 (=48) | FAIL | — / ho2d-child_sexual_exploitation-pos-01 | 0 | 1 | F/F/F | 0/0/0 |
| L1e5-W05 | spread | | 0.8192–0.8452 | 34–48 | | | | | | |
| L1e5-W10 | 1 | epoch-2.5-step-575 | 0.8139 | 14/23 (=37) | PASS | — / — | 0 | 3 | P/P/P | 0/0/0 |
| L1e5-W10 | 2 | epoch-2.5-step-575 | 0.8388 | 17/25 (=42) | FAIL | v0-counter-child_sexual_exploitation, ho2d-child_sexual_exploitation-ctr-03 / — | 1 | 4 | P/F/P | 1/1/2 |
| L1e5-W10 | 3 | epoch-3.0-step-690 | 0.776 | 17/26 (=43) | PASS | — / — | 0 | 1 | F/P/P | 0/0/0 |
| L1e5-W10 | spread | | 0.776–0.8388 | 37–43 | | | | | | |
| L5e6-W05 | 1 | epoch-2.0-step-460 | 0.7702 | 29/25 (=54) | FAIL | — / ho2d-child_sexual_exploitation-pos-01 | 0 | 5 | F/P/F | 0/1/3 |
| L5e6-W05 | 2 | epoch-3.0-step-690 | 0.7703 | 24/33 (=57) | FAIL | — / ho-child_sexual_exploitation-pos-02, ho2d-child_sexual_exploitation-pos-01, ho2d-child_sexual_exploitation-pos-14 | 3 | 2 | F/F/F | 3/2/3 |
| L5e6-W05 | 3 | epoch-2.0-step-460 | 0.7636 | 24/32 (=56) | FAIL | ho-sexual_content-bnd-01, v0-counter-child_sexual_exploitation, ho2d-child_sexual_exploitation-ctr-03 / — | 2 | 0 | F/F/F | 2/3/2 |
| L5e6-W05 | spread | | 0.7636–0.7703 | 54–57 | | | | | | |
| L5e6-W10 | 1 | epoch-2.0-step-460 | 0.8039 | 40/27 (=67) | FAIL | ho2d-child_sexual_exploitation-ctr-03 / ho2d-child_sexual_exploitation-pos-01 | 0 | 2 | F/F/F | 0/0/0 |
| L5e6-W10 | 2 | epoch-2.0-step-460 | 0.7815 | 22/46 (=68) | FAIL | — / ho2d-child_sexual_exploitation-pos-01 | 3 | 2 | F/F/F | 3/3/2 |
| L5e6-W10 | 3 | epoch-2.0-step-460 | 0.7786 | 23/33 (=56) | FAIL | v0-positive-sexual_content, ho-sexual_content-bnd-01, ho2d-child_sexual_exploitation-ctr-03 / ho-child_sexual_exploitation-pos-02 | 1 | 3 | F/F/F | 1/1/2 |
| L5e6-W10 | spread | | 0.7786–0.8039 | 56–68 | | | | | | |

## Notes

- Lower LR / longer warmup did **not** stabilise: the higher LR (1e-5) settings are the best, and even there one seed per setting fails CSE or self_harm. 5e-6 settings are worse on every measure (worst v2 E+M 57 / 68).
- Closest: **L1e5-W10** (worst v2 E+M 43; seeds 1 and 3 pass CSE + self_harm; seed 2 fails CSE with extras `v0-counter-child_sexual_exploitation`, `ho2d-…-ctr-03` and misses 1 self_harm). Even so its worst seed is over the 36 bar.
- `ho2d-child_sexual_exploitation-ctr-03` is an extra on a majority of seeds only in **L5e6-W10 (2/3) → flagged as a corpus target** (no rows written). Elsewhere 0–1/3.
- Not a declared flag but recurring: `ho2d-child_sexual_exploitation-pos-01` is a CSE **miss** at 5 of 12 selected checkpoints (same item round2 epoch 2.0 missed).
- Run A (v2 E+M 36, CSE clean) is still the adopted weights; nothing here beats it on the worst seed.
