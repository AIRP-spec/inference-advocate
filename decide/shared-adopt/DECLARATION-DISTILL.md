# Declaration: distillation of ens5 into one shared-encoder model (Justin 16:22 NPT, Oct 14)

Status: **DECLARED BEFORE ANY POD and before any student result.** Hashed, committed, pushed (ls-remote), archived to the VPS. The teacher-targets sha is appended as an addendum (this file is not edited); that addendum is committed and VPS-archived before the pod is created.

## Teacher (fixed; exactly as in DECLARATION-ENS)
`ens5` = round1, round2, fresh-s3, fresh-s4, fresh-s5, each at **epoch 3.0, step 690**. **No Arm B seeds** (Justin 16:22: no Arm B seed is selectable).

- **Integrity check:** before computing targets, each teacher checkpoint is re-run on held-out v2 on the VPS CPU. Its logits must match that checkpoint's archived raw logits (max |diff| < 1e-2, primitives identical 471/471). The held-out results are already known, so this is an integrity check only.
- **Teacher targets: TRAINING-split rows only** (train.jsonl, 7332 rows, `bc318432…`). Val and held-out are never used.
- Per row and head: the softmax of the logits at T=1, then the uniform mean over the 5 teachers. Script `teacher_probs.py` `c8528f9e…`, run on the VPS CPU under flock.

## Students
- Same architecture, labels v5 (`9480a89f…`), same split, round recipe: encoder 2e-5 / head 1e-4, no warmup, 3 epochs, micro 8 x accum 4, bf16, sigma 0.25 to 0.1.
- **No head weighting.**
- **Loss target = 0.5 x gold + 0.5 x teacher probabilities**, per head. The same mixed target feeds the CE term and the RL reward.
- Code: `train_shared.py` `aab483c2…` (adds `--soft-targets/--soft-mix`; otherwise equal to `f24cde91…`), `pod_pipeline.sh` `c40a7a73…`.
- **Fresh seeds 9, 10, 11.** The final checkpoint, **epoch 3.0**, is fixed in advance.

## Decision mode
Temperature (stance, yes/no) and per-primitive thresholds are **fitted on validation only** with `fit_secondary.py` (the same procedure as DECLARATION-AVG) and applied to held-out v2. Composition: corrected `4e840f3b77c4a15fca46bc1bb537e5d4f3f6cbe37e4dde94d4e5d411f585be38`. Gate: `gate-from-primitives-comp.mjs`, settled proxies `b086cdac…`, suite `6c7b30e1…`. Primary T=1 results are reported for reference only.

## Pass bar
Every seed at epoch 3.0, val-fitted mode:
1. CSE clean (0 miss, 0 extra)
2. self_harm misses 0
3. **Worst-seed** v2 E+M <= 36

**All three seeds pass:** select the seed with the highest val composed-class macro-F1 (val-fitted mode; tie → lower seed). Then run the ship gates:
- Python vs Node identity 471/471 (primitives + composed verdicts, Node pins carrying the fitted T/thresholds)
- Node median < 1000 ms at the 500-token bucket on the VPS (flock)

Then **STOP for Justin**; publishing is his.
**Any seed fails:** report, no fallback, STOP.

## Archive
Every checkpoint goes to the VPS with a remote sha -c before the pod terminates. Streaming follows `LINKTEST-2026-10-14.md`. One SECURE 4090 pod. Budget $30 (~$10.74 spent).
