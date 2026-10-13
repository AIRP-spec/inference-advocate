# Task 3 declaration: two seeds + corpus-round model selection

Date: 2026-10-13 (NPT)
Brief: `decide/shared-adopt/BRIEF-2026-10-13.md` (sha256 `f3452b5093876d788d1089f5f3a5eaa1aa7c77b71c90b16747be7a88525366b8`)
Status: **DECLARED BEFORE ANY POD.** This file is hashed, committed, pushed (`ls-remote` verified), and archived to the Nepal VPS before any training pod starts.

## Justin's decision (verbatim, 2026-10-13 08:22 NPT)

> Justin chose option A (2026-10-13 08:22 NPT): 96 new rows PLUS the hate-vs-sh-sh relabel fix in relabel-from-slots.mjs.

Recorded in `PROGRESS.md` and here. Round labels include both.

## Fixed inputs

| pin | sha256 |
|---|---|
| labels v4 (base) | `6399fd4a9b0e33bfbf21d097fc689d50ee9d6dc219db3b16d7dcdef65eb28d36` |
| labels v5 (round = v4 + 20 hate-vs-sh-sh relabel + 96 new) | `9480a89f0ca4424be8c0ba26b803c77a00bbf78d2c6d37301589c5bb9a99ae86` |
| corpus (8152 = 8056 + 96) | `21e44393383c1de5893ddf2f2754e48c5bd5cb71506fb73bc7bec7e0c42130d0` |
| corpus v4 base | `712fd64d8829b4482858ef99666356de1e304c38f3a14ce85a3f6e5235aaab74` |
| train.jsonl (7332 = 7236 + 96) | `bc318432bbb2d03f1bd80268d1257ae346e28822c55a6bfc45bf7b5691ced5d3` |
| val.jsonl (819, **same ids as group-held-out**) | `346d6ba4cf2f608f3fa5b031facb96636219856f4030bc4bf0f7525e23e15f28` |
| settled proxies | `b086cdac11f8af39b2d3984232ee0372d9ffe909acbd4b8d7fe6d4f653d08455` |
| composition airp-v0.5.0 | `4def0b8fd339713bd261106cb10235949f4bd1bc4e3631a88dd7cc511b0087e0` |
| suite held-out v2 | `6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4` |
| flags v0.5.0 | `0de1cacc74cbdf0452e3785b37ccf00bf6f65683e0b448983c2330fb9c1729b1` |
| 3b declaration (architecture/recipe) | `588e2840f0d4235707b75bbbf5546ddd03b8175d00f6aec2375b93b33188684d` |

Diff vs v4 labels: **exactly 20 rows** (`hate-vs-sh-sh` → object `self_harm`, stance `encourages`) **plus 96 new rows**; 8036 unchanged. Leak check vs v2+v1-207: 0 hits on the 96. Dup-id: pass. Arithmetic: 8056+96=8152.

Split: same group-held-out val units (819 ids unchanged). All 11 new contrast units (`g:r13-*`) assigned **entirely to train** by the group rule (whole unit held out or not; none held out). Excluded id unchanged.

## Model and recipe

Same shared-encoding recipe as 3b **run A**: ModernBERT-large encoder, response encoded once, 17 heads (2-layer cross-attention), micro-batch 8 × accum 4 = 32 responses/step, 3 epochs, LR 2e-5/1e-4, cosine, sigma 0.25→0.1, bf16, grad checkpointing, checkpoint every 0.5 epoch. Seeds differ.

## Three runs

| run | labels | seed |
|---|---|---:|
| baseline seed 2 | v4 (`6399fd4a…`) | 2 |
| round seed 1 | v5 (`9480a89f…`) | 1 |
| round seed 2 | v5 (`9480a89f…`) | 2 |

Baseline seed 1 is the already-finished 3b run A (seed 42, selected A-ckpt-epoch-2.5-step-570). It is not re-run; its archived gates and per-primitive scores are reused.

## Checkpoint selection (per run, declared before gating)

**Selected checkpoint of each run = highest validation composed-class macro-F1** among that run's 6 checkpoints (epochs 0.5…3.0). Temperature and thresholds primary mode: T=1, 0.5 / argmax (same as 3b primary). Secondary (val-fitted) reported, decides nothing.

## Converged checkpoints

**Same definition as 3b / the Accepted ADR:** for a run, the checkpoints at **epoch ≥ 2.0** (i.e. epoch 2.0, 2.5, 3.0). CSE and self_harm ship-gate checks apply to all three.

## Decision rule (every bar applies to every option; written before any number)

Compare the **corpus-round option** (round seed 1 and round seed 2) against the **baseline option** (3b run A + baseline seed 2). Recommend the corpus-round model if **all four** hold:

1. **Mean v2 extras+misses** of the two round selected checkpoints is **no worse than** the mean of the two baseline selected checkpoints (run A + baseline seed 2).
2. **self_harm misses = 0** on all converged checkpoints of **both** round seeds.
3. **CSE passes** on all converged checkpoints of **both** round seeds.
4. **addresses_own_nature false fires** (FP) on the round selected checkpoints: mean **no higher than** the baseline mean (run A + baseline seed 2).

If the rule has a valid output, proceed to Task 4's final step (Node identity+latency on selected weights) and Task 5 without waiting.

**If no option meets bar 2** (the baseline does not: run A misses 2 self_harm items on every converged checkpoint): the round is reported as **not yet shippable** and the self_harm rows are revisited. **No silent fallback** to the incumbent or to a weaker bar.

## Ship gates (Accepted ADR §6; for the selected model)

- CSE clean and self_harm zero misses on all converged checkpoints of every seed of the selected option.
- Python/Node cross-path identity on all 471 (Task 4; Node port already reports 471/471 on the 3b A weights, median 642 ms at 500 tokens).
- CPU median < 1000 ms at the 500-token bucket on the Nepal VPS, measured in Node.

## What this declaration does not do

Does not edit the held-out suite or any gate threshold. Does not touch tryairp.com / dev.tryairp.com. Does not publish. Does not merge.

## Addendum (Justin 08:47 NPT, before any training pod that counts)

1. Self_harm miss firing report and kind-table rewrite: see `JUSTIN-0847-AUDIT.md` (sha256 `b0e35b8b…9d8a`). Hate-shaped primitives did **not** fire on either miss; relabel bug **not confirmed as cause**. Kind-table rewrite: exact lookup only; unknown kind throws. Diff vs v4 (no new rows): **exactly the 20 hate-vs-sh-sh rows**. Proceeding under Justin's instruction.
2. An earlier pod (`02nqe5hbxwt3p4`) had started base2 before the 08:47 message arrived; it was terminated without archive. No result from it is used. The runs below start on a fresh pod after this addendum is committed, pushed, and archived.
