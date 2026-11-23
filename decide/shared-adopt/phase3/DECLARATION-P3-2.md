# DECLARATION P3-2: shared head initialisation (valid cross-seed averaging)

Written 2026-10-27 00:45 NPT (2026-10-26 19:00Z) under Justin's standing brief of 2026-10-26 §6 item 3 ("Go", t181u) and
plan #35 (`PHASE3-RECIPE-STABILITY-PLAN.md`, approved t165u, amendments 1–3). **DECLARED BEFORE ANY POD.** Committed,
pushed (verified with `git ls-remote`) and archived to the VPS (`sha256sum -c`) before the GPU pod is created.
Diagnostic experiment, **not a certification attempt**: no gate, suite, evaluator, default, release, tryairp or workflow change.

## Inputs accepted from P3-1 (report d14399a, close-out 45cdc81)

- Schedule = P3-1 winner **A2** (cosine over 4 epochs to 0, `--epochs 4 --eta-min 0`), as the plan's H1 row specifies.
- The 5 % flip rule stays **analysis-only** (not confirmed in P3-1). Artifact rule with gate force = within-run average
  of every checkpoint at epoch ≥ 2.0 (plan amendment 1), i.e. ep 2.0, 2.5, 3.0, 3.5, 4.0 under A2.

## Validation only (brief §6, §10)

This experiment uses **validation only**. The pod pack contains **no held-out suite** (the pipeline refuses to start if
`held-out-suite.v2.json` is present; `infer_raw_shared.py` is given an empty suite file). No v2, v1-207 or v3 item is
scored, opened or printed. Consequently the plan's "rate-based safety for each per-seed artifact and for the soup",
which P3-1 measured on v2, is reported here **on val** (derived gold): CSE class missed/extra, self_harm class missed,
self_harm primitive missed. On P3-1's A2 artifacts val safety is never clean (self_harm class misses 7–12 of 16 val
positives), so val safety is a **count compared per seed**, not a clean/unclean bar. v2 safety for the P3-2 artifacts is
not computed; it would need a separate decision.

## Pins

| pin | value |
|---|---|
| train / teacher | v8 train `43650873…7df42` (7440); teacher `ens5-train-soft-v8.jsonl` `d30503f4…2b71bb` |
| val | label-free `5be292a911f0082a74c6e24beb20a60455fab4a86baded561784d37f2b453009` (819; gold classes derived via 2a at load, asserted) |
| composition | 2a `59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e` |
| pack | `pack-p32.tgz` `41dc3d0808253a79ef91301bd569afb47854f6b0a51f51b36283d00913ec5edc`; `PACK.sha256` `498c5c1d8a9a14938bf5941756557cba1a7c5cc24da51fb2af8d94f6704bb31b` (31 files, `sha256sum -c` on the pod; full list in `p32/PACK.sha256`, full code shas in `p32/CODE.sha256`) |
| code | `train_shared.py` `7c5ef7b3…ea1d79` (adds opt-in `--head-init-seed`; default path unchanged); `pod_pipeline.sh` `ab7e07ab…a6a970`; `p32_val.py` `9179df29…888a0`; `analyze_p32.py` (box) `41dd85f4…f02bb`; tests `test_head_init.py` `28d504a2…db1eb`, `test_p32_val.py` `7f5c1f61…54e9`, `test_schedule.py` `c1e1dda8…fc` (all run on the pod before training); unchanged from P3-1: `infer_raw_shared.py` `2d3c2030…`, `average_n.py` `88f9cbce…`, `p31_conv.py` `e406483c…`, `shared_model.py` `c7841b9f…` |
| base | convaiinnovations/laya @55cf4c4e; enc 2e-5 / head 1e-4 peak; micro 8 × accum 4; bf16; soft-mix 0.5; σ 0.25→0.1 |
| H0 inputs | P3-1 A2 finals `keep/p31-A2-s4{0..4}-final` on volume rmn62wuuzx (each `sha256sum -c` against its own sha file on the pod; also archived on the VPS, manifest `246aadf4…`) |

The P3-1 pipeline's own convention is kept: one checkpoint per epoch tag (`ls | sort | head -1`).

## The fix (code)

`--head-init-seed K`: `torch.manual_seed(K)` immediately before `load_base` (heads: queries, cross layers, trunk,
output layers), then `torch/numpy/random` re-seeded with `--seed` (data order, RLCD noise, dropout). Unset = old path.
CPU tests (box, 2026-10-27, PASS; re-run on the pod): same K + different seeds → byte-identical step-0 state
(`init_state_sha256`); different K → different heads; default path identical to the old inline code (tensors and RNG
state); RNG state after the build depends on `--seed` only. Each run records `init_head_sha256`/`init_full_sha256` in
`training-meta.json`.

## Arms

| arm | what | seeds | GPU |
|---|---|---|---|
| H1 shared head init | `--head-init-seed 7 --epochs 4 --eta-min 0`, data seeds **45, 46, 47, 48, 49** (fresh) | 5 | 5 × 1.33 units |
| H0 negative control | P3-1 A2 runs s40–s44 (different head inits), finals at ep 4.0, no new training | 5 | inference only |
| H2 warm start (plan: optional) | **not run** in P3-2 (keeps the arm inside its $3 cap; can be declared separately) | – | – |

Per H1 run: checkpoints 0.5 … 4.0 → val raw; flip rate (analysis-only); within-run artifact = uniform average of
ep 2.0–4.0 → val raw. Cross-seed phase, per arm: the 5 finals (ep 4.0) re-inferred on val as endpoints; the 10 pairwise
midpoints (uniform 2-way average) and the 5-seed soup (uniform average of the 5 finals) → val raw. Analysis-only:
H1 soup of the 5 within-run artifacts.

## Declared rules (fixed now; computed by `analyze_p32.py` on val raw only)

Metrics per model (`p32_val.py`): **val F1** = composed-class macro-F1 on derived gold (identical to
`select-composed-f1-derived.mjs`; verified equal to 1e-6 on all five P3-1 A2 artifacts); **val loss** = mean over rows ×
17 heads of the cross-entropy of softmax(logits) against the gold primitive one-hot (the CE term of `train_shared.py`).

- **R0 (technical precondition).** All five H1 runs report the same `init_head_sha256` and `head_init_seed = 7`. The
  pipeline stops (exit 16) at the first mismatch; that is a technical failure, P3-2 has no valid output, report.
- **R1 (validity, per arm H0 and H1).** For each of the 10 seed pairs (i, j) of finals: midpoint val loss
  ≤ max(loss_i, loss_j) + 0.02 **and** midpoint val F1 ≥ min(F1_i, F1_j) − 0.02. And the 5-seed soup's val F1 ≥ the
  mean val F1 of its 5 ingredients. Cross-seed averaging is **valid for an arm iff all 10 pairs pass and the soup
  condition holds.** Expected: H0 invalid (confirms the problem), H1 valid.
- **R3 (cross-seed vs within-run averaging; only if R0 and R1-H1 hold).** Per seed s ∈ 45–49: the H1 soup is compared
  with that seed's within-run artifact. The soup **replaces within-run averaging** as the artifact rule iff, for **every**
  seed (5/5), soup val F1 ≥ artifact val F1 **and** soup val safety errors (CSE missed + CSE extra + self_harm class
  missed + self_harm primitive missed) ≤ the artifact's. Otherwise: **within-run averaging stays** the artifact rule.
  If R0 or R1-H1 fails, R3 is not evaluated and within-run averaging stays.
- Reported, not gated: worst-seed comparison (soup vs the lowest artifact val F1), per-model val safety counts, flips,
  converged sets (5 % rule, analysis-only), H1 artifact val F1 mean/SD/range next to P3-1 A2 (.8079/.0397; unpaired seeds),
  H1 soup-of-artifacts.
- No rule here is changed after the pod starts. If a rule cannot be computed (missing output) the result is
  "no valid output" and the experiment stops for Justin.

## Stops, spend and pod handling

- Spend: SECURE RTX 4090 EU-RO-1 (≈ $0.89/h). Projection ≈ 1.7 GPU-h ≈ **$1.5**; **P3-2 cap $3** (box monitor kills at
  3.0 GPU-h). Phase 3 spend before this run: RunPod balance $11.65 at the P3-1 declaration → **$7.69** read
  2026-10-27 00:34 NPT ⇒ ≈ **$3.96** (P3-1 pods, the Oct 20–23 CPU copy pod overrun, volume storage). Brief stop at $30
  not reachable by this run. Keep ≥ $2 of balance: the run does not start if balance < $5.
- Headroom (before the pod): VPS free space read (236 G free 2026-10-27); on the pod the pipeline refuses to start with
  < 12 GB free on the volume or < 15 GB on the container disk and checks ≥ 4 GB before each run. If the volume has
  < 15 GB free, VPS-verified archives are pruned first (re-verify `sha256sum -c` on the VPS immediately before deletion).
- Technical failure (pipeline exit ≠ 0, CUDA, sha mismatch, R0 mismatch, monitor timeout, SSH lost): kill, volume
  manifest + `sha256sum -c` of what exists, terminate the GPU pod **within 15 min**.
- Close-out: volume `MANIFEST-volume-p32.sha256` with `sha256sum -c` on the volume → raw outputs pulled to the box
  (`sha256sum -c`) → GPU pod terminated → CPU pod copies `/workspace/p32` to the VPS → VPS `sha256sum -c` OK → CPU pod
  terminated (synchronously; no unattended watcher). The VPS is never terminated or rebooted. Then report.
