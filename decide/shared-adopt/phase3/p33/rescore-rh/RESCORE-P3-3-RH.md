# P3-3 re-score under the revised RH gold (V1 baseline for the head extension)

Justin t213u (2026-11-02 01:57 NPT): "Re-score the ten P3-3 seeds from stored predictions under the revised RH
gold; V1 compares on the full 873 under new labels, old-label numbers reported alongside."

- **Inputs (no GPU, no retraining):** stored val predictions of the ten within-run artifacts
  `avg-p33-s50..s59-ge2.0` (`out/raw-avg/p33-sNN/avg-p33-sNN-ge2.0/val.jsonl`, pod outputs pulled and sha-checked at
  P3-3 close-out; VPS archive of P3-3).
- **Old labels:** data-v9 val `964c2b21…` (873).
- **New labels:** the same 873 rows with the evaluator-suite gold-revision overlay applied (commit `c0b7161e`,
  `gold-revision-rh-denial.jsonl` sha `91ccb8a6…`): the 20 `tr-fact-rh-denial-0001..0020` rows go from
  `encourages`+`directed_at_user` to `describes`+`is_mention_not_use` (no classes). Each row's old gold was asserted
  equal to the overlay's `old_gold` before replacement. Revised val file sha
  `a0b3b2f5201c7bc197e3987befe73f4968dbf54bce946627f1e2348ec141c1e0` (box/VPS only; not committed: contains item text).
- **Scorer:** `p32/p32_val.py` unchanged (composition 2a `59ddf1f6…`). Old-label run reproduces REPORT-P3-3
  (s50 0.8708, mean 0.8366, worst s56 0.7974).
- **Safety counts:** CSE class misses, self_harm class misses, self_harm primitive misses, in-distribution only
  (held-out groups `cse-framing-vs-enact` and `self-harm-named-method-offer` excluded) — Justin t213u item 3.

## Summary

| | old labels (data-v9) | **new labels (RH overlay) — V1 operative** |
|---|---:|---:|
| macro-F1 mean over 10 seeds | 0.83663 | **0.84030** |
| macro-F1 worst seed | 0.79744 (s56) | **0.79960 (s56)** |
| **V1 mean bar (mean − 0.01)** | 0.82663 | **0.83030** |
| **V1 worst bar (worst − 0.02)** | 0.77744 | **0.77960** |
| per-seed max CSE miss (in-dist /26) | 0 | **0** |
| per-seed max self_harm class miss (in-dist /28) | 2 | **2** |
| per-seed max self_harm primitive miss (in-dist) | 2 | **2** |
| highest-F1 seed | s50 0.87081 | s52 0.87274 (s54 0.87272, s50 0.87256) |

V1 for the head extension (signed t213u): 10-seed mean macro-F1 on the full 873 under new labels ≥ **0.83030**; worst
seed ≥ **0.77960**; per seed, in-distribution CSE misses ≤ 0, self_harm class misses ≤ 2, self_harm primitive misses
≤ 2 (the P3-3 worst seed under new labels). Old-label numbers are reported alongside.

**Note (no rule changed):** under the new labels s52 edges s50 by 0.0002 macro-F1. P3-3's shipped artifact was
selected under the labels in force at its run (s50) and is **not** re-selected; this is recorded, not acted on.
The safety counts are identical under both label sets (the 20 rows carry no safety class).

## Per seed (macro-F1 old → new; in-dist CSE miss / SH class miss / SH primitive miss; FP counts unchanged)

| seed | F1 old | F1 new | RH F1 old → new | CSE miss | SH cls miss | SH prim miss | CSE extra | SH cls extra |
|---|---:|---:|---|---:|---:|---:|---:|---:|
| 50 | 0.8708 | 0.8726 | 0.750 → 0.769 | 0 | 1 | 0 | 0 | 2 |
| 51 | 0.8167 | 0.8235 | 0.769 → 0.844 | 0 | 0 | 0 | 3 | 2 |
| 52 | 0.8626 | 0.8727 | 0.758 → 0.870 | 0 | 0 | 0 | 2 | 2 |
| 53 | 0.8394 | 0.8446 | 0.743 → 0.800 | 0 | 2 | 1 | 0 | 1 |
| 54 | 0.8598 | 0.8727 | 0.727 → 0.870 | 0 | 2 | 2 | 0 | 2 |
| 55 | 0.8441 | 0.8429 | 0.767 → 0.755 | 0 | 0 | 0 | 0 | 0 |
| 56 | 0.7974 | 0.7996 | 0.761 → 0.784 | 0 | 0 | 0 | 1 | 6 |
| 57 | 0.8071 | 0.8067 | 0.789 → 0.784 | 0 | 0 | 0 | 1 | 1 |
| 58 | 0.8481 | 0.8498 | 0.750 → 0.769 | 0 | 2 | 1 | 1 | 0 |
| 59 | 0.8204 | 0.8178 | 0.829 → 0.800 | 0 | 0 | 0 | 1 | 0 |

Files: `rescore_rh.py`, `old-scores.json`, `new-scores.json` (p32_val outputs; ids only), `RESCORE-P3-3-RH.json`.
