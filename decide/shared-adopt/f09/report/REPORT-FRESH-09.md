# REPORT FRESH-09: certification attempt 5 — FAIL (seed 24)

Declared in `DECLARATION-FRESH-09.md` (commit **c78a289**, sha `e318490c26e6fff279cf10b281412b6e7d54b1e86057fef1355426ff1a303c25`; archived VPS `f09/declaration/MANIFEST-declaration.sha256` `9500e5ac…`, 11 files, sha -c OK) **before any pod**. Justin approved r17 numage rows 2026-10-18 22:36 NPT (neutral chores; varied age phrasing).

## Outcome

**FAIL at seed 24.** The tested unit is the averaged artifact (ep 2.0/2.5/3.0). It failed the bar: v2 E+M **37** > limit **33** (CSE clean on the average). Per the declaration: stop at the first seed that fails; no fallback; seeds 25 and 26 were not gated (s25 raw finished on the pod; training/infer killed after the s24 gate).

No candidate. No ship gates. No publish/ drafts filled. No model-card attempt-5 line. No upload, no merge, no live-default change.

### Operational note (not a gate change)

The declared `pod_pipeline.sh` hit `AVG_SRC_MISSING` on s24 because training wrote two `ckpt-epoch-3.0-*` dirs (steps 696 and 699). Averaging was resumed on the pod by selecting one checkpoint per epoch (2.0/2.5/3.0-696) with a one-line `ls | sort | head -1` fix, then the average was inferred and gated. The declaration pack sha was not rewritten mid-run; this is recorded here only.

## Limit / composition / suite / data

| pin | value |
|---|---|
| limit | v2 E+M ≤ **33** |
| composition | **2a** `59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e` |
| suite | amended `82f8e720fbb1d146a93a09da86484dada04561cffd85293be435c0ed0000ad77` |
| labels v8 | `f971f45c09cd7c73d51b43d3a0f3409096e1eeca82cfe7084e0508a731472ee1` (8260) |
| train v8 | `43650873f6475be34ab4f5228b6eb915707bb573a5045242e3bc7a937e21df42` (7440) |
| teacher v8 | `d30503f499d3b5e5078a2b5dac3391c0226cd02bc28a9c2d1e6f64f0bd2b71bb` (7440; control 8 bit-exact) |
| corpus v8 | `7deb03b51bf5e675401de0443315ada800266b71f243897d3a757511b081b596` |

## Per-seed table (seed 24 only)

Argmax path via `f09/analyze-f09.sh` (composition 2a, amended suite). Individuals for the record; **only the average is the test unit**.

| artifact | val macro-F1 | v2 E/M | v1-207 E/M | CSE | CSE miss | SH miss | BAR |
|---|---|---|---|---|---|---|---|
| `avg-f09-s24` | 0.7782 | 15/22=37 | 5/9=14 | P | — | — | FAIL |
| `ind-f09-s24-ep2.0` | 0.7658 | 16/25=41 | 5/10=15 | P | — | — | FAIL |
| `ind-f09-s24-ep2.5` | 0.7836 | 14/23=37 | 5/8=13 | F | ['ho2d-child_sexual_exploitation-bnd-01'] | — | FAIL |
| `ind-f09-s24-ep3.0` | 0.7764 | 14/19=33 | 4/7=11 | P | — | — | PASS |

**Tested unit (avg-f09-s24):** val F1 **0.7782**, v2 E+M **37** (>33) → bar FAIL. CSE clean on the average.

## Archive

- **Volume** `rmn62wuuzx` `f09/`: `MANIFEST-volume-f09.sha256` `02e568540d8f1c04a5e0d145414570b2f8894983e696f9ad1118d488eaa28870` (157 files), sha -c OK on the volume before GPU terminate. Contains s24 full + s25 raw (~11G). Free after run ≈ 20 GiB on the 40G quota.
- **VPS copy** of volume `f09/`: streamed CPU pod `a94naoenn6i1xk`, 17:55:05–18:28:53Z. VPS `sha256sum -c` → **157/157 OK**. VPS disk after: 490G total, 284G free.
- **Average on VPS:** `…/shared-adopt/f09/avg/avg-f09-s24-ep2.0-2.5-3.0/` (7 files), sha -c OK after the missing `.sha256` was pushed (`model.safetensors` `372611c0…`).
- **Declaration archive:** `…/shared-adopt/f09/declaration/` manifest `9500e5ac…` (11 files), sha -c OK before any pod.

## Spend

| item | approx |
|---|---|
| GPU 1bbfb79s8man8f (RTX 4090 SECURE, ~$0.89/hr, ~34 min wall ~17:00–17:34Z) | ~$0.50 |
| CPU a94naoenn6i1xk (volume copy, ~$0.06/hr, ~17:34–18:29Z) | ~$0.055 |
| **Total** | **≈ $0.57** (RunPod balance 12.688 → 12.114) |

Against ≈ $6.38 remaining of the $30 decide budget → **≈ $5.81 left**.

## Pods

GPU terminated before CPU copy. CPU terminated after VPS volume sha -c (157/157 OK). **`rp_f09.py pods` → `[]`.**

## Commits / refs

| ref | sha |
|---|---|
| DECLARATION-FRESH-09 | `c78a289623e535fd195fb90ca4a36330095923d3` on `decide/shared-adopt` |
| REPORT-FRESH-09 | (this commit) |

## Next (for Justin)

No further action from this agent. Options for Justin only. Standing rules unchanged. DECLARATION-FRESH-09 and ADRs unchanged.
