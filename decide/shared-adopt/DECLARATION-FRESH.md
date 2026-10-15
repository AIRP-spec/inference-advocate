# Declaration: three fresh seeds, round recipe unchanged, fixed final checkpoint (Justin 17:30 NPT)

Date 2026-10-13 (NPT). Status: **DECLARED BEFORE ANY POD.** Hashed, committed, pushed (ls-remote verified), archived to the Nepal VPS before the pod is created.

## Fixed inputs

| pin | sha256 |
|---|---|
| labels v5 | `9480a89f0ca4424be8c0ba26b803c77a00bbf78d2c6d37301589c5bb9a99ae86` |
| train.jsonl (7332) | `bc318432bbb2d03f1bd80268d1257ae346e28822c55a6bfc45bf7b5691ced5d3` |
| val.jsonl (819) | `346d6ba4cf2f608f3fa5b031facb96636219856f4030bc4bf0f7525e23e15f28` |
| composition (corrected CSE; ADR 2026-10-13-cse-composition-correction) | `4e840f3b77c4a15fca46bc1bb537e5d4f3f6cbe37e4dde94d4e5d411f585be38` |
| settled proxies | `b086cdac11f8af39b2d3984232ee0372d9ffe909acbd4b8d7fe6d4f653d08455` |
| suite held-out v2 | `6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4` |
| train_shared.py (`--warmup-frac` default 0 = the original CosineAnnealingLR path, unchanged) | `f24cde91f66f613bbbb45a5266bdef60aeec948802e8214fd4412ba34275cf52` |
| pod_pipeline.sh | `5c334d989d73ad55169fd2707251057d85ee31801a68988af52683ebb0e55809` |

## Runs

Round recipe unchanged: run A's original LR (encoder 2e-5 / head 1e-4), no warmup (cosine to 1e-6), 3 epochs, micro 8 x accum 4, bf16, sigma 0.25 to 0.1, checkpoint every 0.5 epoch. **Fresh seeds 3, 4, 5** (`fresh-s3/s4/s5`). Round seeds 1 and 2 are not reused. (Seed 3 was used in the sweep, but with a different LR/warmup, so these are fresh runs of this recipe.)

## Selection: fixed in advance

**The final checkpoint, epoch 3.0, of each seed.** Validation does not select. Reason: in the sweep, under-training hurt the rare safety classes first, and validation selection kept picking earlier checkpoints.

**Honesty note:** epoch 2.5/3.0 results for the existing round seeds 1 and 2 (including under the corrected composition, `RESCORE-CSE-CORRECTED.md`) were seen **before** this rule was written. That is why only the fresh seeds count toward this decision.

## Pass bar (corrected composition, primary T=1 / 0.5 / argmax)

Pass only if all hold:
1. On **every** fresh seed at epoch 3.0: CSE clean (missed 0, extra 0, n 29).
2. On **every** fresh seed at epoch 3.0: self_harm misses 0 (settled-proxy `object:self_harm` FN).
3. **Worst-seed** v2 extras+misses at epoch 3.0 **<= 36**.

**Pass:** without waiting, run Node identity (471/471 primitives and composed verdicts) and VPS Node latency per bucket (median/p95, under `flock`) on the fresh seed with the **best validation composed macro-F1 at epoch 3.0** (tie → lower seed). Method: `node/NODE-SHARED.md`, `vps_shared_node.sh` with `B=` and `PINS=`, under the corrected composition.
**Fail:** report per-seed results and failing items, then STOP.

Also reported: whether `ho2d-child_sexual_exploitation-ctr-03` or `ho2d-child_sexual_exploitation-pos-01` fails on any fresh seed. If either fails on >= 2 seeds it is flagged as a next-round corpus target (no rows written).

## Archive (strict)

Every checkpoint, configs, logs, raw outputs and this declaration go to `/root/primitives-evaluator/decide-2026-10-13/shared-adopt/fresh/` on the Nepal VPS. Each finished run streams to the VPS while later runs train. `MANIFEST.sha256` gets a remote `sha256sum -c` **before** the pod terminates. No box-only shortcut. One SECURE RTX 4090 pod; terminate in the same turn once verified. Budget $30 total (~$7.96 spent); stop if exceeded. Arms A/B on hold. No suite/threshold/live edits, no publish, no merge, no rows.
