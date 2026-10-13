# Declaration: weight averaging of round seeds (no training)

Date: 2026-10-13 (NPT)
Status: **DECLARED BEFORE ANY AVERAGING INFERENCE OR GATING.** Hashed, committed, pushed (`ls-remote` verified), archived to the Nepal VPS before raw logits for any average are produced or any held-out bar is read.

Justin accepted the Task 3 round result (10:50 NPT). Labels base going forward: v5 `9480a89f…` (see `DECISIONS-2026-10-13-round-accepted.md`). This declaration does not retrain; it only averages existing archived round checkpoints.

## Fixed inputs

| pin | value / sha256 |
|---|---|
| labels v5 (training base; not used for fitting here) | `9480a89f0ca4424be8c0ba26b803c77a00bbf78d2c6d37301589c5bb9a99ae86` |
| val.jsonl (819 ids; **fit T/thresholds here only**) | `346d6ba4cf2f608f3fa5b031facb96636219856f4030bc4bf0f7525e23e15f28` |
| settled proxies | `b086cdac11f8af39b2d3984232ee0372d9ffe909acbd4b8d7fe6d4f653d08455` |
| composition airp-v0.5.0 | `4def0b8fd339713bd261106cb10235949f4bd1bc4e3631a88dd7cc511b0087e0` |
| suite held-out v2 | `6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4` |
| round1 ckpt epoch 2.5 | `checkpoints-round1/ckpt-epoch-2.5-step-575` (from VPS `archive/checkpoints.tgz`) |
| round1 ckpt epoch 3.0 | `checkpoints-round1/ckpt-epoch-3.0-step-690` |
| round2 ckpt epoch 2.5 | `checkpoints-round2/ckpt-epoch-2.5-step-575` |
| round2 ckpt epoch 3.0 | `checkpoints-round2/ckpt-epoch-3.0-step-690` |

## What is averaged

Two uniform weight averages (encoder + all heads, every tensor in `model.safetensors`):

| average id | sources (equal weight 1/2) |
|---|---|
| `avg-r12-epoch-2.5` | round1 epoch 2.5 + round2 epoch 2.5 |
| `avg-r12-epoch-3.0` | round1 epoch 3.0 + round2 epoch 3.0 |

No other epochs. No training. No CSE rows.

## Temperature / thresholds (decision-bearing)

Same procedure as the shared-model **secondary** fit used beside Task 3b/Task 3 primary: on each average's **validation raw logits only**, fit `T_stance` and `T_noul` (LBFGS NLL) and per-primitive best-F1 thresholds (primitives with zero val positives keep 0.5). Apply those fits to held-out for the decision bars below. Held-out is never used to fit.

(Primary T=1 / 0.5·argmax may be reported for continuity; it does **not** decide.)

## Best single-round checkpoint v2 E+M (stated before gating)

From archived Task 3 primary gates on converged round checkpoints, the **best** v2 extras+misses is **31** (`round2` epoch 2.5: E=17 M=14). Bar 3 below uses this number.

## Decision rule (every bar applies to every average; no fallback)

For **each** average independently, recommend that average if **all three** hold on the val-fitted (secondary) path:

1. **CSE passes** (missed=0 and extra=0 on held-out v2 CSE class, n=29).
2. **self_harm misses = 0** on held-out v2 (same settled-proxy `object:self_harm` FN count as Task 3 `perprim-t3.mjs`).
3. **v2 extras+misses ≤ 31** (no worse than the best single round checkpoint, stated above).

If an average fails any bar, it is not recommended. If **neither** average passes all bars, neither is recommended; write a stability-sweep proposal (do not run it). **No silent fallback** to a single seed, to primary thresholds, or to a weaker bar.

## Reference only (not decision-bearing)

Also report a **two-pass probability ensemble** of the same checkpoint pairs: average the archived per-item `p_true` / stance probabilities of (round1, round2) at epoch 2.5 and at epoch 3.0, then apply the same val-fitted T/threshold procedure on the ensemble's implied scores (or, if T-fit needs logits, average softmax probabilities at T=1 and fit thresholds on val ensemble probs only). Reported beside the averages; **never** used to recommend.

## Compute

Prefer CPU on the box or Nepal VPS (`flock`, memory-capped). GPU only if required: one SECURE pod, archive+terminate same turn. Budget remains $30 total (~$3.11 spent before this step).

## What this declaration does not do

Does not edit the held-out suite or gate thresholds. Does not touch tryairp.com. Does not publish. Does not merge. Does not author CSE or reflexive rows.
