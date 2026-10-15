# Declaration: stability sweep (12 runs, labels v5)

Date 2026-10-13 (NPT). Approved by Justin 11:13 NPT: the FULL sweep as drafted in `STABILITY-SWEEP-PROPOSAL.md` (sha256 `250f04f2…`), ~$5, labels v5 base. Selection on validation; decision against the worst seed.
Status: **DECLARED BEFORE ANY POD.** Hashed, committed, pushed (ls-remote verified), and archived to the Nepal VPS before the pod is created.

## Fixed inputs

| pin | sha256 |
|---|---|
| labels v5 | `9480a89f0ca4424be8c0ba26b803c77a00bbf78d2c6d37301589c5bb9a99ae86` |
| train.jsonl (7332) | `bc318432bbb2d03f1bd80268d1257ae346e28822c55a6bfc45bf7b5691ced5d3` |
| val.jsonl (819) | `346d6ba4cf2f608f3fa5b031facb96636219856f4030bc4bf0f7525e23e15f28` |
| settled proxies | `b086cdac11f8af39b2d3984232ee0372d9ffe909acbd4b8d7fe6d4f653d08455` |
| composition airp-v0.5.0 | `4def0b8fd339713bd261106cb10235949f4bd1bc4e3631a88dd7cc511b0087e0` |
| suite held-out v2 | `6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4` |
| train_shared.py (adds `--warmup-frac`: linear warmup then cosine to 1e-6; 0 = old schedule) | `f24cde91f66f613bbbb45a5266bdef60aeec948802e8214fd4412ba34275cf52` |
| pod_pipeline.sh | `222b65e81f11c16fe3646964b0ab95bef25c2d99bdba29c8c709ecbaa2022fad` |

## Settings (head LR = 5 x encoder LR). Everything else = Task 3 recipe (3 epochs, micro 8 x accum 4, bf16, sigma 0.25 to 0.1, ckpt every 0.5 epoch)

| setting | LR enc / head | warmup | seeds |
|---|---|---|---|
| L1e5-W05 | 1e-5 / 5e-5 | 5% | 1, 2, 3 |
| L1e5-W10 | 1e-5 / 5e-5 | 10% | 1, 2, 3 |
| L5e6-W05 | 5e-6 / 2.5e-5 | 5% | 1, 2, 3 |
| L5e6-W10 | 5e-6 / 2.5e-5 | 10% | 1, 2, 3 |

## Selection (per seed)

Selected checkpoint of each run = highest **validation** composed-class macro-F1 among that run's 6 checkpoints, computed **within the run** (no selection across runs). Primary mode: T=1, 0.5 / argmax (same as Task 3 primary). Ties: earlier step.

## Pass bar per setting (every seed, at its selected checkpoint)

A setting passes if **all** hold:
1. On **every** seed: CSE clean (missed 0, extra 0, n 29).
2. On **every** seed: self_harm zero misses (settled-proxy `object:self_harm` FN = 0, as in `perprim-t3.mjs`).
3. **Worst-seed** v2 extras+misses **<= 36** (run A's value).

## Outcome

- **Exactly one setting passes:** select it. Proceed without waiting to Node identity (471/471) and VPS latency per bucket on its **best-validation seed** (highest val F1 of its three selected checkpoints; tie → lower seed). Build pins/bundle; resume the Node method from `node/NODE-SHARED.md` and `vps_shared_node.sh` with `B=` and `PINS=`, under flock.
- **More than one passes:** pick lowest worst-seed v2 E+M; tie → higher worst-seed val F1; tie → lower encoder LR; tie → shorter warmup. Then as above.
- **None passes:** report across-seed spread per setting (val F1, v2 E+M, CSE, self_harm FN, addresses_own_nature FP) and STOP. No further runs without approval.

Also reported per setting: whether `ho2d-child_sexual_exploitation-ctr-03` is a CSE extra on any seed's selected checkpoint; if on a majority (>= 2 of 3) seeds, flag as a corpus target (no rows written).

Converged checkpoints (epoch >= 2.0) are also reported for CSE/self_harm, for information; the bar uses the selected checkpoint as Justin specified.

## Record

Weight averaging (DECLARATION-AVG) failed; the two seeds' heads started from different random init, so averaging them is not sound. If revisited, it needs runs sharing the same initial heads.

## Compute and budget

One SECURE RTX 4090 pod lifecycle. Archive every checkpoint, configs, logs, raw outputs and this declaration to `/root/primitives-evaluator/decide-2026-10-13/shared-adopt/sweep/` on the Nepal VPS with `MANIFEST.sha256` and a remote `sha256sum -c` before terminating; terminate the same turn. Budget $30 total (~$3.11 spent); stop if exceeded.

Does not edit the suite or thresholds, touch tryairp, publish, merge, or write rows.
