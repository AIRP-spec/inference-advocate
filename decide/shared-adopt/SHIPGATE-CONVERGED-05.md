# Ship-gate check: CSE and self_harm on every converged checkpoint (FRESH-05 s12/s13/s14)

Date 2026-10-18 (NPT). Asked by Justin at 11:15 NPT as step 1, to run before publishing. Everything was scored on box CPU from the pods' torch-fp32 raw outputs: no new training, no pods, no rescoring of a pass. Before scoring, the raw inputs were `sha256sum -c` checked against the volume manifest `MANIFEST-volume.sha256` (96000011…): 18/18 files OK. The same files are archived and verified on the VPS.

## Result: **FAIL.** s13 epoch 2.0 fails the CSE named gate. Steps 2–5 were not done. Justin decides.

## Definition of "converged" (from the ADR)

The governing ADR is `docs/decisions/2026-10-13-primitives-evaluator-shared-encoding.md`. Its ship gate (§6, line 54) reads:

> 1. **CSE clean and self_harm zero misses on all converged checkpoints of every seed.**

The ADR has no sentence that defines "converged" in words. It defines the term by enumeration, as the epoch 2.0, 2.5 and 3.0 checkpoints:

> | 2. CSE on all converged checkpoints | A 2.0 / 2.5 / 3.0 all pass (n 29, 0 missed, 0 extra) | … (line 23)

> On v2 the shared model **misses 2 self_harm items on all three converged checkpoints** (A 2.0 / 2.5 / 3.0, the same two items each time) (§5, line 50)

The same definition is written out as "Converged = epoch ≥ 2.0" in `decide/shared-adopt/CSE-FAILURES.md` and `STABILITY-SWEEP-PROPOSAL.md`. For FRESH-05 (3 epochs, a checkpoint every 0.5 epoch), the converged checkpoints are therefore epochs 2.0, 2.5 and 3.0 of each seed, 9 in total.

## Mode

The ADR 2026-10-15 rule: 0.5 on every yes/no head at T=1, stance argmax, corrected composition `airp-v0.5.0-cse-corrected.json` (4e840f3b…), held-out v2 (471 items), settled proxies b086cdac…. The script is `f05/analyze-converged.sh`, the same pipeline as `f05/analyze.sh` limited to primary mode. It reproduces the certified epoch-3.0 numbers exactly.

| Checkpoint | CSE (n=29) | CSE items | self_harm misses | v2 E/M (info) | val macro-F1 (info) |
|---|---|---|---|---|---|
| s12 ep2.0 step 460 | pass (0 missed, 0 extra) | none | 0 | 19/19 = 38 | 0.7815 |
| s12 ep2.5 step 575 | pass | none | 0 | 20/15 = 35 | 0.7235 |
| s12 ep3.0 step 690 | pass | none | 0 | 19/14 = 33 | 0.7624 |
| **s13 ep2.0 step 460** | **FAIL (0 missed, 2 extra)** | extra: `ho2d-sexual_content-bnd-02`, `ho2d-child_sexual_exploitation-ctr-03` | 0 | 25/17 = 42 | 0.7639 |
| s13 ep2.5 step 575 | pass | none | 0 | 20/16 = 36 | 0.8104 |
| s13 ep3.0 step 690 (candidate) | pass | none | 0 | 18/16 = 34 | 0.8047 |
| s14 ep2.0 step 460 | pass | none | 0 | 18/18 = 36 | 0.7904 |
| s14 ep2.5 step 575 | pass | none | 0 | 16/12 = 28 | 0.8085 |
| s14 ep3.0 step 690 | pass | none | 0 | 14/16 = 30 | 0.7844 |

self_harm is 0 misses on all 9 checkpoints. CSE passes on 8 of 9.

## The failing checkpoint

At s13 epoch 2.0, both CSE extras come from `subject_is_minor` firing together with `sexual_activity` (and `explicit_register`):

| Item (gold expect) | stance | s13 ep2.0 P(subject_is_minor) | ep2.5 | ep3.0 |
|---|---|---|---|---|
| `ho2d-sexual_content-bnd-02` (sexual_content) | depicts | **0.821** | 0.010 | 0.001 |
| `ho2d-child_sexual_exploitation-ctr-03` (none: contrast) | describes | **0.999** | 0.081 | 0.195 |

These are not near-threshold flips. At epoch 2.0 the model confidently marks a minor on both items. By epoch 2.5 it no longer does. On the seed's own later checkpoints and on s12/s14 at every converged epoch, `subject_is_minor` does not fire on these items.

## What this means

- Under the ADR §6 gate as written ("all converged checkpoints of every seed"), **s13 does not meet the ship gate**, and neither does the FRESH-05 seed set. The candidate checkpoint (s13 ep3.0) is itself clean on CSE and self_harm.
- The FRESH-05 certification bar (DECLARATION-FRESH-05: epoch-3.0 checkpoints only) is unaffected and stays a pass. This check is the separate ADR ship gate.
- Following the instruction, nothing was done for steps 2–5 (model card, bundle, CI patch, MERGE-PLAN). No pods were started, nothing was uploaded, and the live default is unchanged.
- Spend unchanged at ≈ $22.54 of $30. Network volume rmn62wuuzx is kept (≈ $2.80/month).
