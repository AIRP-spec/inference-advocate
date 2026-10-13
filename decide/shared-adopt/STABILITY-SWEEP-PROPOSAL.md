# Stability-sweep proposal (do **not** run)

Triggered because neither weight average passed DECLARATION-AVG (CSE fail + v2 E+M 64 � neither weight average passed DECLARATION-AVG (CSE fail + v2 E+M 64 ≫ 31). Written 2026-10-13 after Justin accepted the round result. **Do not execute until Justin approves.**

## Goal

Reduce seed-to-seed CSE / v2 instability on labels v5 (`9480a89f…`) so a future per-seed / worst-seed rule can recommend a shippable checkpoint.

## Recipe changes (vs Task 3 / 3b run A)

| knob | current (Task 3) | proposal |
|---|---|---|
| encoder LR / head LR | 2e-5 / 1e-4 | **lower**: try {1e-5, 5e-6} × heads {5e-5, 2.5e-5} |
| warmup | (recipe default cosine) | **longer warmup**: 5% and 10% of steps |
| seeds per setting | 2 (round) | **3 seeds** per setting (e.g. 1, 2, 3) |
| epochs / ckpt cadence | 3 ep / every 0.5 | keep (converged = epoch ≥ 2.0) |
| selection | max val composed macro-F1 **per run** | keep on validation; **also** record cross-seed consistency (same epoch family) |
| decision rule | (retired means) | **per seed or vs worst seed** — never mean |

## Grid (proposed)

2 encoder LRs × 2 warmup fractions × 3 seeds = **12 runs** (optionally fix head LR = 5× encoder LR to cut to 2×2×3=12 already). If Justin wants a smaller first cut: one lower LR (1e-5/5e-5) × two warmups × 3 seeds = **6 runs**.

## Selection and rule (declared before any pod)

- Select each run's checkpoint by **validation** composed-class macro-F1 (unchanged).
- Prefer settings where the **worst** of the 3 seeds still: CSE pass on all converged, self_harm FN=0 on all converged, and v2 E+M of the selected ckpt ≤ best baseline single-seed (state the number in that future declaration).
- Cross-seed consistency: report pairwise agreement on held-out composed verdicts among the 3 selected ckpts; use as a tie-break only if written into that declaration **before** gating.

## Cost estimate (SECURE 4090 @ ~$0.89/hr)

Task 3 three full trains + infer ≈ ~50–60 GPU-min wall inside an ~88 min pod (~$1.31 including idle/archive). Per-run train+infer ≈ **15–20 min**.

| cut | runs | GPU-hours (approx) | $ @ 0.89/hr | notes |
|---|---:|---:|---:|---|
| small (6) | 6 | 1.5–2.0 | **~$1.4–1.8** | + archive idle buffer → budget **~$2.5** |
| full (12) | 12 | 3.0–4.0 | **~$2.7–3.6** | + buffer → budget **~$5** |

Remaining brief budget: ~$26.9 of $30. Either cut fits; prefer small cut first.

## Out of scope until approved

No CSE rows, no reflexive-pair rows (still noted only), no suite/threshold edits, no publish/merge, no live tryairp edits.
