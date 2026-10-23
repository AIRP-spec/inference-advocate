# Task 3: Laya CPU speed toward the 1-second target

Brief: `decide/adopt/BRIEF-laya-adoption-2026-10-06.md` (sha256 `59e142801dac5b4312826162af2e28af092f8250e81a536f442812d5e7f1a6f1`), Task 3. Times are NPT (UTC+5:45). Host: Nepal VPS `himalogic`, Xeon Gold 5418Y, 8 vCPU (2 sockets × 4 cores, VMware, AVX-512 VNNI + BF16, no AMX), ORT 1.22.1 CPU EP, Python 3.12.

## Headline

- **Best accuracy-matched build of the selected checkpoint (5766, fp32): 1069 ms median, 1305 ms p95** on all 471 held-out v2 items, one `session.run` per response. Down from 2313 / 3431 ms. Three changes got there: ORT intra-op spinning off; a padding-free ("packed") export; a cost-minimising bin size for the packing.
- **Accuracy impact: none.** Every step: 0 composed-verdict disagreements and 0 thresholded primitive flips out of 471 items against the previous best and against the baseline. Largest |Δlogit| is 4.1e-4 and largest |Δp| is 2.4e-6. v2 E/M/C stays 16/20/13, v1-207 stays 5/10/4, and the CSE named gate passes.
- **The 1-second target is not met by the large model.** 1069 ms is the median, so about half of the items are under 1 s, but the median is not. Step 4 (ModernBERT-base retrain) was therefore run. See §5.
- **Step 4, ModernBERT-base retrain (new model): 433 ms median, 505 ms p95. 1 s is met, but the accuracy gate is not: CSE named gate FAIL, v2 E/M/C 25/19/15 against large 16/20/13, 45/471 composed disagreements against large S2c.** Not a drop-in replacement. Best accuracy-matched build stays large S2c, 1069 / 1305 ms. Phase GPU spend: $1.33.
- The suite's responses are short (state median 12 tokens). Real chat responses are longer and cost proportionally more (Step 3 CPU-LATENCY §3.2). These medians are lower bounds.

## Ladder (VPS, 5766 fp32, full 471 unless marked screen)

Each step adds exactly one change to the previous best. Gate = shared compose via `gate-laya-task1.mjs`, default thresholds. Disagreement is item by item against the build in the "vs" column.

| Step | Change | Median ms | p95 ms | Mean ms | vs | Composed disagree | Prim flips | max\|Δlogit\| | v2 E/M/C | CSE |
|---|---|---:|---:|---:|---|---:|---:|---:|---|---|
| s0 | baseline: padded 17 rows, intra 8, ORT defaults | 2313 | 3431* | 2442 | box fp32 (Task 2a) | 0 | 0 | 0 | 16/20/13 | PASS |
| S1 | `session.intra_op.allow_spinning=0` (intra 8) | **1890** | **2233** | 1924 | s0 | 0 | 0 | 0 | 16/20/13 | PASS |
| S2 | packed layout (padding-free, block-diagonal masks) | **1130** | 1875 | 1223 | S1 | 0 | 0 | 4.1e-4 | 16/20/13 | PASS |
| S2c | packed + cost-minimising bin cap | **1069** | **1305** | 1093 | S2 (and s0) | 0 (0) | 0 (0) | 4.1e-4 (2.5e-5) | 16/20/13 | PASS |
| S3 | max_len 1024 → 128 (on S2) | 1133 | 1883 | 1230 | S2 (and s0) | 0 (0) | 0 | 0 (4.1e-4) | 16/20/13 | PASS |

\* The s0 p95 is inflated. The Task 2a int8 archive rsync was writing to the VPS during that run. Its clean controls, from the S1 screen, are 2275 / 2711 and 2236 / 2621 ms on items 0–79.

Composition: S3 sits on S2 (max-cap packing) because it ran before S2c existed. max_len 128 changes no input on this suite, so S3 ∘ S2c = S2c on this suite. **Best build = S2c (+ max_len 128 optional, identical here).**

### Step 1: threads and ORT settings (screen: items 0–79, 10 warm-up)

| Setting | Median | p95 |
|---|---:|---:|
| intra 8 (control A, first) | 2275 | 2711 |
| intra 8 + allow_spinning 0 | **1906** | **2082** |
| intra 6 | 2234 | 2381 |
| intra 4 | 3190 | 3432 |
| intra 8 + affinities 1..7 | 2267 | 2603 |
| intra 8 (control B, last) | 2236 | 2621 |

All six screens are bit-identical to the baseline logits on those 80 items. The winner (spin off) was confirmed on all 471 items (S1 row above). Spinning worker threads hurt on this VMware guest, probably because they compete with the hypervisor and the production node processes. inter_op parallel mode was not tried. The graph is a single chain, so it has nothing to run in parallel.

### Step 2: graph optimisation, fused attention, optimised export

- **ORT transformer optimizer** (`onnxruntime.transformers.optimizer`, model_type bert, 16 heads, 1024 hidden) fused **0 Attention / MultiHeadAttention / RotaryEmbedding** nodes. ModernBERT's RoPE + SDPA pattern is not recognised. It fused only Gelu ×29 and LayerNorm ×62, which `ORT_ENABLE_ALL` already does at session load. Screen (packed, spin 0, n=80): 1209 / 1933 ms against the unoptimised packed screen at 1173 / 1874 ms. **No gain, not adopted.** 0 flips, max|Δlogit| 1.1e-5 against s0. Writing a fused RoPE-attention graph by hand (com.microsoft MHA + RotaryEmbedding) was not attempted. At sequence lengths around 100, attention is a small share of the compute.
- **Packed export (S2, adopted).** The padded batch is 17 rows × the longest row. The longest row is always `stance`, whose header is 90 tokens against 34–46 for the others, so 48% of the median batch is padding (1734 fed tokens for 903 real ones). The packed export (`scripts/export_packed.py`) uses the same weights and the same `DecisionModel` maths. Rows are bin-packed first-fit-decreasing into segments. Attention is masked block-diagonally: the encoder gets the additive finfo.min mask exactly as ModernBERT builds it, and the head gets a bool mask. RoPE position ids restart per segment. The sliding window applies on within-segment distance. Type embeddings are added per token, and markers and [CLS] are gathered from the flat sequence. It is still **one `session.run` per response**. Verified before the VPS run: torch packed vs torch padded max|Δlogit| 5.3e-5 (41 items), ORT packed vs torch padded 4.1e-5. Median fed tokens drop from 1734 to 1020.
- **S2c bin cap (adopted).** With cap = longest row, items whose ordinary rows exceed cap/2 pack one row per bin (up to 17 bins). This produced the long S2 tail: p95 1875 ms, and 2209 ms median at 17 bins. S2c picks, per item, the cap in [longest, 2 × longest] that minimises `A·bins·cap + B·bins·cap²`. A and B were fit by least squares on S2's per-item VPS timings (R² 0.95). This is a speed-only layout choice, and outputs do not depend on the layout (verified: 0 flips, |Δlogit| ≤ 4.1e-4). Disclosure: the cost coefficients came from held-out *timings*, not held-out *accuracy*. Predicted 1056 / 1253 ms, measured 1069 / 1305 ms. Median fed tokens: 936.

### Step 3: maximum input length

Token-length distribution under the 5766 tokenizer, measured **before any length gate** (`cpu-speed/results/token-lengths-5766.json`):

| | min | p25 | median | p75 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|---:|---:|
| state (response) tokens | 3 | 9 | 12 | 16 | 21 | 28 | 34 |
| row length (state + question), 8007 rows | 37 | 47 | 51 | 55 | 98 | 107 | 124 |
| padded seq per item (longest row) | 93 | 99 | 102 | 106 | 111 | 118 | 124 |

Question overhead (row − state) per primitive: stance 90, all others 34–46. Rows ≥ 128: 0. ≥ 112: 22 rows (15 items). ≥ 96: 457.

**Chosen from the distribution: max_len 128**, the smallest multiple of 32 at or above the longest observed row (124). It changes **0 rows** on the suite. 112 would truncate 15 items and 96 would truncate 435, nearly all of them in the stance row's state (`results/maxlen-identity.json`). Gate (S3): 0 disagreements and max|Δlogit| 0, as expected for byte-identical inputs. Latency effect on the suite: none (1133 vs 1130 ms), because ORT already runs at the actual length and the cap only bounds long inputs. The cap matters for long real responses: Step 3 measured 35 s at the 1024 cap. Lowering it there trades latency for truncating real content, and this suite cannot measure that trade-off because it contains no long items.

## 5. Step 4: smaller encoder (ModernBERT-base), a new model

**Result: the base model hits 1 s on CPU (433 ms median, 505 ms p95), but it fails the accuracy gate (CSE named gate FAIL, v2 E/M/C 25/19/15 against 16/20/13 for large). It is a different and weaker model, not a faster build of 5766. Not recommended as a drop-in replacement.**

**What ran.** One RunPod RTX 4090 pod, `0osdj9z2pumvx2` (`airp-adopt-base-laya`, SECURE, $0.74/hr), 05:58:25 → 07:46:04 NPT. The deciding run's Laya trainpack (labels v4 `6399fd4a`, same group split, train `4cdf51b6…`, val `46789984…`, same hyperparameters: 3 epochs, bs 8 × accum 4, lr 2e-5 / 1e-4, sigma 0.25 → 0.1, max_len 1024, seed 42), with one change. The encoder starts from `answerdotai/ModernBERT-base` @ `8949b909ec900327062f0ebf497f51aef5e6f0c8` (weights sha `340ac08b74eef0d7…`), and the decision head is fresh (seeded). The Laya tokenizer is kept because its vocab and merges are identical to ModernBERT-base's, so the preprocessed sequences are byte-identical to the deciding run. 164 M params in total; the large model uses ModernBERT-large (about 395 M). Pack sha `20f1d7c7718200ac35e6c76cf8ae49c19a919e8c12b8610957569dc8184071d8`. `FULL_TRAIN_EXIT:0`, wall 5253 s. Checkpoints at the deciding run's steps: 1922 / 3844 / 5766 / 7688 / 9610 / 10099. The nonfinite-loss skip count (5721 by step ≈10057) is identical to the deciding run's.

**Selection** used the deciding run's rule: composed-class macro-F1 on validation (n = 819), tiebreak stance accuracy, then later step. Raw logits came from the pod (`infer_raw`). The offline flow (`laya_raw_to_primitives` → `select-composed-f1` → `gate_all_ckpts`, settled proxies `b086cdac`) is `base/offline.sh`. It was checked first on the deciding run's raw and reproduced 5766 / 0.8259 / 16-20-13 exactly.

| Ckpt (base) | epoch | val macro-F1 | val stance acc | Held-out v2 E/M/C (pod raw) | v1-207 E/M/C | CSE (n / missed / extra) |
|---|---:|---:|---:|---|---|---|
| 1922 | 0.5 | 0.3974 | 0.8095 | 17/172/2 | 9/66/2 | 29/7/2 FAIL |
| 3844 | 1.0 | 0.6847 | 0.8291 | 50/80/16 | 21/34/7 | 29/0/1 FAIL |
| 5766 | 1.5 | 0.7838 | 0.8657 | 25/31/12 | 8/11/3 | 29/1/0 FAIL |
| 7688 | 2.0 | 0.7685 | 0.8474 | 31/21/19 | 13/8/9 | 29/0/2 FAIL |
| 9610 | 2.5 | 0.7557 | 0.8523 | 21/32/14 | 9/11/7 | 29/4/0 FAIL |
| **10099 (selected)** | 2.6 | **0.7921** | 0.8571 | 26/19/15 | 9/8/6 | 29/1/0 FAIL |
| *large 5766 (deciding run, for reference)* | 1.5 | *0.8259* | *0.9109* | *16/20/13* | *5/10/4* | *29/0/0 PASS* |

No base checkpoint passes the CSE named gate, including the converged ones (epoch ≥ 2.0: 7688, 9610, 10099). The selected base checkpoint is 0.034 macro-F1 and 5.4 pt stance accuracy below large 5766 on validation.

**CPU latency (VPS, S2c recipe unchanged):** packed export (`export_packed.py`, same code path as large S2; torch packed vs padded max|Δlogit| 6.2e-6, ORT packed vs torch padded 3.0e-4 on 21 items), `--pack-cap costmin` with the large-model cost coefficients unchanged, intra 8, `allow_spinning=0`, fp32, one `session.run` per response, full 471.

| Run | Median ms | p95 ms | Mean ms | Max ms |
|---|---:|---:|---:|---:|
| **base 10099, S2c + spin0 (r2, clean)** | **433** | **505** | 439 | 607 |
| base 10099, S2c + spin0 (r1, overlapped the pod-archive upload and remote sha check) | 439 | 531 | 446 | 629 |
| large 5766, S2c + spin0 (best large) | 1069 | 1305 | 1093 | 2456 |

r1 and r2 are bit-identical in outputs (0 disagreements, max|Δp| 0). Only r2's timing is reported. Base is 2.47× faster at the median and 2.58× at p95. **1 s is hit with margin (max 607 ms).**

**Accuracy against large S2c (VPS ORT raw, item by item, shared compose, default thresholds):**

| | v2 E/M/C | v1-207 E/M/C | CSE |
|---|---|---|---|
| large 5766 S2c (ref) | 16/20/13 | 5/10/4 | 29/0/0 PASS |
| base 10099 S2c (cand) | 25/19/15 | 9/8/6 | 29/1/0 **FAIL** |

- Composed-verdict disagreement: **45 / 471 items (9.6%)**.
- Thresholded primitive flips: 215 across 154 items (32.7%). The largest buckets are explicit_register 58, is_mention_not_use 44 and stance 36.
- max|Δp| ≈ 1.0. These are two different models, and the outputs are not identical.
- CSE miss: `ho2d-child_sexual_exploitation-pos-12`. Base drops `subject_is_minor` and `explicit_register`, so the item composes to sexual_content only. Large fires CSE + sexual_content.
- Base VPS ORT fp32 against base pod GPU (bf16 AMP) raw for the same checkpoint: v2 25/19/15 against 26/19/15, a 1-extra difference from precision. The gates above use VPS ORT for both models.

**Verdict.** The large model with S2c is the best accuracy-matched build: 1069 / 1305 ms, 1 s **not** met at the median. ModernBERT-base on the same recipe gets 433 / 505 ms, so 1 s **is** met, but it is a new model that fails the CSE named gate and is worse on validation and on v2 extras. Adopting it would need its own accuracy work (for example distilling from large 5766, or more epochs and a learning-rate retune for the smaller encoder) and a fresh gate. That is outside this task. Retraining does not change the large model's latency.

**Spend this phase:** one pod, 6459 s wall = 1.794 h × $0.74 = **$1.33** (hard stop $25). No other GPU. The pod sat idle for about 13 min after `POST_INFER_DONE`. The orchestrator's archive step failed because `paramiko` was missing on the box. The archive was redone by hand with rsync + ssh and remotely verified, and the pod was terminated right after (`podTerminate` OK, `myself.pods` = []).

**Disclosures.**
- `training-meta.json` `labels_sha256` shows the stale `5bdae44c…` value. It comes from `airp_laya_common.LABELS_SHA256` and is metadata only, the same as in the deciding run. The actual train and val files are labels v4 (shas above).
- The selected base checkpoint ships a NaN calibration temperature (laya warns `temperature[2]=nan -> 1`). Gates use raw logits with default thresholds, so they are unaffected. Confidence calibration for this checkpoint is invalid.
- The S2c cost coefficients were fit on large-model held-out timings and reused unchanged for base. They are not re-fit, so the bin cap may be slightly suboptimal for base.
- The large s0 p95 is inflated (see the ladder footnote).
- The Task 2a int8 gate ran on box ORT (AMX). Step 3 showed far more int8 flips there than on the VPS. int8 stays out.

## Notes for Task 4 (Node integration)

- spin off is a session option: `intraOpNumThreads: 8` plus session config `session.intra_op.allow_spinning = "0"` in onnxruntime-node. It needs the same check in the Node runtime that ships, which may differ from this measurement.
- The packed layout needs Node to reproduce `pack_common.pack_rows` (FFD, the S2c cap rule, seg/position ids, flat marker and row_start indices) exactly. That is another surface for the two paths to drift apart, so the cross-path identity test should cover the packed feed, not only logits.
- int8 remains out (Task 2a). Speed numbers here are fp32.

## Paths and SHAs

BOX: `/workspace/airp/decide/adopt/cpu-speed/`. VPS archive: `/root/primitives-evaluator/decide-2026-10-06/adopt/cpu-speed/` (MANIFEST.sha256).

| Artifact | sha256 |
|---|---|
| Large 5766 fp32 padded ONNX | `0b5694036a20f3093f2cac7c8f6d8569400756e9982a28ccd4070997a522aa8e` |
| Large 5766 fp32 packed ONNX (S2 / S2c) | `910eec0576e3e8ecd61064c1856f8d34c3d29ba07f90044fcfcc7c385a992696` |
| Large 5766 ortopt ONNX (not adopted) | `cc7a9b4cb6e0e57c4c6dfd003313dac1bdcafe72b14a50f0960d1a64d70ba0a8` |
| Base trainpack `base-trainpack.tgz` | `20f1d7c7718200ac35e6c76cf8ae49c19a919e8c12b8610957569dc8184071d8` |
| Pod output `base-out.tgz` (6 ckpts, raw, logs, meta) | `b5a442d271cd3a55a054c037d34cfdc5a4c1dc1347fbd56fc510a14331c81111` |
| ModernBERT-base init weights @ 8949b909 | `340ac08b74eef0d7bdec2d7981a6a3d4249bf0e6aab60634b72ad02c2b8023a9` |
| Base 10099 `model.safetensors` | `c27e5d548a93d5fcedff678a59feca88c362cc6c13bfbb54462a0792c3ee1cf8` |
| Base 10099 fp32 packed ONNX | `ac4921f2886a423cb0d3cafe27f64e041be6f6184bdb0657285dbc64e09852d4` |
| Base 1922 / 3844 / 5766 / 7688 / 9610 `model.safetensors` | `8f1ea672…` / `d0992924…` / `9d926ccb…` / `ec8643e9…` / `ac35e3a6…` (full list in VPS `base/MANIFEST.sha256`) |
| Base selection `base/offline/selection/laya-primary.json` | `b3f388b1dd1c69cc06374c7a5633b091e1c04bfcc7c65d3a7220ab899c79a2d8` |
| Base gates `base/offline/gates/laya-primary.json` | `cb8086c62cfec011de637dc9b89afd9ecec8bbaf79a59eb2cd0e3ab26f20421d` |
| Base VPS raw r2 / r1 | `ba3635c9d592660251f66e4d42f5836774b97d8b0197d1cbdec114f49e59889a` / `9a1da1599fb865d4dd381c0d8b370fc1f73666b8a6fc5367d2c0408e3e0a14fc` |
| Base VPS bench r2 json | `e8b34887ab21b1fc65b3e5cb0604d2d459aa5ae8ee178a7963dbb609d54c6b7c` |
| Base vs large S2c disagree json | `ef02c92d65a69ad053cc47a4ec9f955a38959dbb6cf0cbe681530a4449e216dc` |
| Held-out suite v2 / questions | `6c7b30e1…` / `f519fa8e…` |
| VPS pod archive `cpu-speed/base/MANIFEST.sha256` (73 entries, remote verify OK) | `bf6bf67904c4d0f50f12ae31f7b8b8df66f37bfd17c523f297fd886e213ea02e` |

The full cpu-speed tree MANIFEST is `cpu-speed/MANIFEST.sha256` on the VPS (remote `sha256sum -c` OK).
