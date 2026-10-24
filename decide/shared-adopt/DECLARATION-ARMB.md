# Declaration: Arm B, positive-class weighting on self_harm and subject_is_minor (3 fresh seeds)

Date 2026-10-14 (NPT), Justin 00:34 NPT. Arm A dropped. Status: **DECLARED BEFORE ANY POD.** Hashed, committed, pushed (ls-remote verified), archived to the VPS before the pod is created.

## Fixed inputs

| pin | sha256 |
|---|---|
| labels v5 | `9480a89f0ca4424be8c0ba26b803c77a00bbf78d2c6d37301589c5bb9a99ae86` |
| train.jsonl (7332) | `bc318432bbb2d03f1bd80268d1257ae346e28822c55a6bfc45bf7b5691ced5d3` |
| val.jsonl (819) | `346d6ba4cf2f608f3fa5b031facb96636219856f4030bc4bf0f7525e23e15f28` |
| composition (corrected CSE) | `4e840f3b77c4a15fca46bc1bb537e5d4f3f6cbe37e4dde94d4e5d411f585be38` |
| settled proxies | `b086cdac11f8af39b2d3984232ee0372d9ffe909acbd4b8d7fe6d4f653d08455` |
| suite held-out v2 | `6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4` |
| train_shared.py (adds `--pos-weight`; otherwise identical to `f24cde91…`) | `c203d83f8a3eeb8757eebe7182992a85daddb4aa66889ea24f3f89eecfb85d12` |
| pod_pipeline.sh | `365a272473eba14085087177001cd2a74fa2a78af0eb8d87781f8c1f8019b0c5` |

## Recipe

Round recipe unchanged except for the weighting: run A's LR (encoder 2e-5 / head 1e-4), no warmup (cosine), 3 epochs, micro 8 x accum 4, bf16, sigma 0.25 to 0.1, labels v5. **Fresh seeds 6, 7, 8** (`armb-s6/s7/s8`).

**Weights (inverse frequency on train v5, capped at 5):**

| head | positives / 7332 | neg/pos | weight |
|---|---:|---:|---:|
| self_harm | 218 | 32.63 | **5** (capped) |
| subject_is_minor | 640 | 10.46 | **5** (capped) |

Every other head and every negative row has weight 1. **Mechanism:** per (item, head) row, w = 1 + (5-1) x P_gold(yes). That is 5 on rows whose gold is yes for these two heads, else 1. The weight multiplies both the CE term and the RL (policy-gradient) term of that row; normalisation is the same `.mean()` as before.

## Selection: fixed in advance

The final checkpoint, **epoch 3.0**, of each seed. Validation does not select.

## Pass bar (corrected composition; primary T=1 / 0.5 / argmax)

1. Every seed at epoch 3.0: CSE clean (0 miss, 0 extra).
2. Every seed at epoch 3.0: self_harm misses 0.
3. Worst-seed v2 E+M <= 36.

**Pass:** without waiting, run Node identity (471/471) and VPS Node latency per bucket (median/p95, under flock) on the seed with the best validation composed macro-F1 at epoch 3.0 (tie → lower seed), under the corrected composition.
**Fail:** report per-seed results and failing items, then STOP.

Also reported: ctr-03 and pos-01 failure counts per seed, and the self_harm/subject_is_minor positive-rate shift on val.

## Archive

Each checkpoint streams to the VPS as it is written: pod → box → VPS, with a remote `sha256sum -c` per checkpoint. Then the full manifest gets a remote `sha256sum -c` **before** termination. One SECURE 4090 pod. Budget $30 total (~$9.53 spent). No suite/threshold/live edits, no rows, no merge, no publish.
