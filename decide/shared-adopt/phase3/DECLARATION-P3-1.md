# DECLARATION P3-1: learning-rate decay (low-LR tail)

Written 2026-10-19 (NPT) under Justin's t165u (plan approved). **DECLARED BEFORE ANY POD.** Committed, pushed
(verified with `git ls-remote`) and archived to the VPS (sha -c) before the GPU pod is created.
Governing: `PHASE3-RECIPE-STABILITY-PLAN.md` (as amended 2026-10-19), ADR 2026-10-18 (converged = epoch ≥ 2.0),
ADR 2026-10-19 clarification (self_harm class AND primitive), ADR 2026-10-19 val gold classes derived.
This is a **diagnostic experiment, not a certification attempt**: no gate, suite, evaluator, default or release changes.

## Pins

| pin | value |
|---|---|
| train / teacher | v8 train `43650873…7df42` (7440); teacher `ens5-train-soft-v8.jsonl` `d30503f4…2b71bb` |
| val | **label-free** `5be292a911f0082a74c6e24beb20a60455fab4a86baded561784d37f2b453009` (819) |
| suite / proxies | v2 amended `82f8e720…` (471, step4/inputs copy); proxies `b086cdac…` |
| composition | 2a `59ddf1f6…` (gate, selection and flip analysis) |
| pack | `pack-p31.tgz` `570ba304a87747886134355a2bb2177a31303156af70f334d899240a2d4604a3`; `PACK.sha256` `bb71ef33…4a572` (28 files, checked on the pod) |
| code | `train_shared.py` `fc8af76e…593dc` (opt-in `--lr-schedule/--eta-min/--cosine-epochs`; default path = `aab483c2…`, CPU test `tests/test_schedule.py` `c1e1dda8…` run on the pod before training); `pod_pipeline.sh` `1df69505…561c`; `p31_conv.py` `e406483c…c08f07`; `average_n.py` `88f9cbce…` (unchanged); `infer_raw_shared.py` `2d3c2030…` (unchanged); box `analyze-p31.sh` `ba431c03…596ef`, selection `phase3/select-composed-f1-derived.mjs` |
| base | convaiinnovations/laya @55cf4c4e; enc 2e-5 / head 1e-4 peak; micro 8 × accum 4; bf16; soft-mix 0.5; σ start 0.25, end 0.1 |

## Arms (paired seeds 40, 41, 42, 43, 44 in every arm; run order interleaved by seed: s40 A0, A1, A2, s41 …)

| arm | flags | checkpoints | artifact (gate-force rule, plan amendment 1) |
|---|---|---|---|
| A0 control | `--epochs 3` (cosine to 1e-6 over 3 ep) | 0.5 … 3.0 | within-run avg of ep 2.0, 2.5, 3.0 |
| A1 tail | `--epochs 4 --lr-schedule cosine_tail --cosine-epochs 3 --eta-min 1e-6` (σ 0.25→0.1 over the cosine part, then 0.1) | 0.5 … 4.0 | avg of ep 2.0, 2.5, 3.0, 3.5, 4.0 |
| A2 slow decay | `--epochs 4 --eta-min 0` (cosine over 4 ep to 0; σ by the unchanged formula) | 0.5 … 4.0 | avg of ep 2.0 … 4.0 |

One checkpoint per epoch tag (`ls | sort | head -1`, as FRESH-10). **Analysis-only** extras: flip rate per half epoch
(`p31_conv.py`, ≤ 5 % = "converged") and `cavg` = average of the ≤ 5 % checkpoints when there are ≥ 2.

## Outcomes and decision rule (fixed now)

Safety-clean = CSE missed = extra = 0 and self_harm 0 at class and primitive level (v2 suite, 2a).
Per run: (a) artifact clean; (b) every checkpoint at epoch ≥ 2.0 clean. Per arm: k/N runs with (a) and (b).
1. Safety phase (box, `analyze-p31.sh safety`) prints safety, val F1 (derived gold) and flips; **v2 E+M masked**.
2. Winner = most runs with (a) and (b); ties → lower mean final flip rate → lower val-F1 SD of the artifacts. A tail
   arm must beat A0 **strictly**; otherwise the winner is A0 ("keep the 3-epoch cosine"). Written to
   `P3-1-SELECTION.json` (sha + UTC time), **committed and pushed before E+M is computed or printed**.
3. Then E+M per arm (artifact, each epoch, cavg): mean, SD, range. Reported, not gated.
4. Rate framing: N/N with N=5 → per-run clean rate ≥ .55 at 95 % (one-sided). No certification claim.

Safety misses are recorded outcomes, **not** stop conditions: all 15 runs complete unless a stop below fires.

## Stops, spend and pod handling

- Spend: SECURE RTX 4090 $0.89/h. Projection ≈ $3.85; **P3-1 cap $6** (box monitor kills at 5.5 GPU-h). Phase 3
  hard cap $20; Justin's stop-and-report at $30 is not reachable (RunPod balance $11.65 at declaration).
- Headroom: pipeline refuses to start with < 16 GB free on the volume or < 15 GB on the container disk; checks
  ≥ 3 GB before every run. Checkpoints live on the container disk and are deleted after each run; the final
  checkpoint of each run is kept on the volume (`keep/`, for P3-2's negative control).
- Technical failure (pipeline exit ≠ 0, CUDA, sha mismatch, monitor timeout): kill, archive what exists, terminate the
  GPU pod **within 15 min**.
- Close-out: volume MANIFEST of `/workspace/p31` with `sha256sum -c` on the volume → raw outputs pulled to the box
  (sha -c) → GPU pod terminated → CPU pod copies the volume dir to the VPS → VPS `sha256sum -c` OK → CPU pod
  terminated. The VPS is never terminated. Then stop and report to Justin (P3-2 needs approval of the P3-1 report).
