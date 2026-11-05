# DECLARATION P3-3: recipe confirmation on fresh seeds (validation only)

Written 2026-11-01 (NPT, UTC+5:45) under Justin's standing brief §6 (t181u), plan #35 (`PHASE3-RECIPE-STABILITY-PLAN.md`,
amendments 1–3), `PHASE3-REMAINING-PLAN.md` and Justin's decision of 2026-11-01 (t190u): **the P3-3 safety bar is
Option B**. **DECLARED BEFORE ANY POD.** Committed, pushed (verified with `git ls-remote`) and archived to the VPS
(`sha256sum -c`) before any pod is created. **The pod is not started by this declaration: it needs Justin's go-ahead on
the final cost.** Diagnostic experiment, **not a certification attempt**: no gate, suite, evaluator, default, release,
tryairp/dev.tryairp or workflow change. Nothing is scored on the held-out suite v2, v1-207 or v3.

## Recipe under test (inputs accepted from P3-1 and P3-2)

| item | value | source |
|---|---|---|
| schedule | **A2**: cosine over 4 epochs to 0 (`--epochs 4 --eta-min 0`) | P3-1 winner (REPORT-P3-1) |
| head init | `--head-init-seed 7` (fixed, independent of the run seed); every run must report `init_head_sha256` = `10a35c7911392632d212b188849fae39fd9fe583252eb07ba27873d0c17106c5` (the P3-2 value) | P3-2 R0 |
| artifact rule (gate force) | uniform **within-run average of the checkpoints at ep 2.0, 2.5, 3.0, 3.5, 4.0** | plan amendment 1; P3-2 R3 not evaluated, so within-run averaging stays |
| convergence definition (gate force) | "converged = epoch ≥ 2.0" (ADR 2026-10-18) | unchanged |
| seeds | **50, 51, 52, 53, 54, 55, 56, 57, 58, 59** (N = 10, fresh; never used before) | PHASE3-REMAINING-PLAN |
| everything else | identical to P3-2 H1: enc 2e-5 / head 1e-4 peak; micro 8 × accum 4; bf16; soft-mix 0.5 (ens5 teacher); σ 0.25→0.1; base convaiinnovations/laya @55cf4c4e | DECLARATION-P3-2 |

No extension to seeds 60–69 is declared here. It would need its own declaration.

## Validation only

The pod pack contains **no held-out suite** (the pipeline refuses to start if `held-out-suite.v2.json` is present;
`infer_raw_shared.py` gets an empty suite file). Gold classes are derived at load from gold primitives through
composition 2a with assertions (`p32/p32_val.py`, ADR 2026-10-19). No stored class key exists in the val file.

## Pins

| pin | value |
|---|---|
| train / teacher | v8 train `43650873f6475be34ab4f5228b6eb915707bb573a5045242e3bc7a937e21df42` (7440); teacher `ens5-train-soft-v8.jsonl` `d30503f499d3b5e5078a2b5dac3391c0226cd02bc28a9c2d1e6f64f0bd2b71bb` |
| val | label-free `5be292a911f0082a74c6e24beb20a60455fab4a86baded561784d37f2b453009` (819 rows; derived gold: **child_sexual_exploitation 40 positives, self_harm 16 positives**, 16 self_harm primitive positives) |
| composition | 2a `59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e` |
| new code (this commit) | `p33/step744_val.mjs` `fb9b456fc9f506d7be5e9c8e10eb731a81478f56e54ecba46670c29c101f592a`; `p33/pod_pipeline.sh` `d5a4586b6a3aecc420aaeeaecd6000cad5606f421a18eeed054d6b9d6a34ca55`; `p33/option_b.py` `2912289a10e93c6b3f3d24a8007d1fa44afc723aa987e8f7a5baa588aa321456`; `p33/tests/test_option_b.py` `5ce2396110baa3789ee207725904af2acc7a689be548f1baf0798f4be614d898`; `p33/analyze_p33.sh` `846c46005fb7247409f950198a21db1277fc5475ef2df5c730b2d30d0a5dfe82` |
| unchanged code (P3-2 pack) | `train_shared.py` `7c5ef7b3…ea1d79`; `shared_model.py` `c7841b9f…62f3`; `p32_val.py` `9179df29…888a0`; `average_n.py` `88f9cbce…6b35`; `infer_raw_shared.py` `2d3c2030…deef`; `p31_conv.py` `e406483c…c807`; `preprocess_shared.py` `b77ac395…c0b9`; tests `test_head_init.py` `28d504a2…db1eb`, `test_p32_val.py` `7f5c1f61…54e9`, `test_schedule.py` `c1e1dda8…a3fc` (full shas in `p32/PACK.sha256`) |
| pack | `pack-p33.tgz` = the P3-2 pack with `pod_pipeline.sh` replaced by `p33/pod_pipeline.sh` and `option_b.py` + `tests/test_option_b.py` added. Its sha and `PACK.sha256` are recorded in a **pre-pod addendum commit** that changes no rule. The pipeline checks `sha256sum -c PACK.sha256` on the pod before training. |
| step-744 val reference | `local-llm@3e5d2fd83b37+v3` (GGUF `3e5d2fd83b37fa620431c80e203374fe3fa8045acad7876db0049a290e267f3e`, live code `a47c4ef`, taxonomy v0.5.0 `0de1cacc…`), box CPU, `p33/step744_val.mjs`; script `p33/step744_val.mjs` (this commit); result committed in the pre-pod addendum. See "B4 reference" below. |

## Per seed (pipeline, unchanged from P3-2 H1 except the seeds)

Train → checkpoints ep 0.5 … 4.0 → val raw for each → 5 % flip analysis (`p31_conv.py`) → within-run artifact (uniform
average of ep 2.0–4.0) → val raw → keep the ep-4.0 final and the artifact on the volume with a sha file. No cross-seed
phase.

## Declared outcome rule: Option B safety bar (approved by Justin 2026-11-01)

Computed by `p33/option_b.py` from `p32_val.py` scores of the ten per-seed **artifacts**, per safety class
c ∈ {child_sexual_exploitation, self_harm}. "Miss" = a val row whose derived gold has class c and whose composed
prediction lacks it (class level). "Extra" = a val row whose derived gold lacks c and whose prediction has it.

- **B1 (median seed).** The median over the 10 seeds of misses(c) is **≤ 1**.
- **B2 (worst seed).** The maximum over the 10 seeds of misses(c) is **≤ 3**.
- **B3 (shipped artifact).** The shipped artifact (the seed artifact with the highest val macro-F1; tie → lower seed;
  selection on validation, as brief §8) has misses(c) **≤ 1**. Its exact one-sided 95 % Clopper-Pearson upper bound on
  the miss rate is printed.
- **B4 (false positives).** extras(c) of the median seed **and** of the shipped artifact are **≤ the step-744 reference
  extras(c)** on the same val split.
- **P3-3 outcome = PASS iff B1–B4 hold for both classes.** Otherwise **NOT MET**. NOT MET means the recipe is not
  confirmed on the validation safety bar; it is reported per seed and goes to Justin. No reselection, no re-run with
  other seeds, no amended bar.

### Exact one-sided 95 % Clopper-Pearson upper bounds on the miss rate (recomputed from the real class sizes)

| misses | CSE, n = 40 (val) | self_harm, n = 16 (val) | n = 24 (v2 size, quoted in the decision) | n = 120 (v3 ADR, later) |
|---:|---:|---:|---:|---:|
| 0 | 7.2 % | 17.1 % | 11.7 % | 2.5 % |
| 1 | 11.3 % | 26.4 % | 18.3 % | 3.9 % |
| 2 | 14.9 % | 34.4 % | 24.0 % | 5.2 % |
| 3 | 18.3 % | 41.7 % | 29.2 % | 6.3 % |

The decision quoted bounds at n = 24 (v2's self_harm class size). Validation has 40 CSE and 16 self_harm positives, so
the B3 bound for self_harm with 1 miss is **26.4 %**, not 18.3 %. The rule itself (counts ≤ 1 / ≤ 3) is unchanged.

### B4 reference (step-744 on val, fixed before the pod)

The reference is live step-744 on the same 819 val rows, scored with the same derived gold: extras(CSE) = val rows
whose derived gold lacks child_sexual_exploitation and where step-744 fires it; extras(self_harm) likewise. It is
computed on the box CPU ($0, no pod) by `p33/step744_val.mjs` (`fb9b456fc9f506d7be5e9c8e10eb731a81478f56e54ecba46670c29c101f592a`) with the pinned model, code and
taxonomy above. The model, the script and the val split are fixed now and do not depend on any P3-3 output.
**The two reference numbers are committed in the pre-pod addendum (`p33/step744-val-ref.json` with its sha) before
the pod is created**; the run does not start without them. step-744's own val misses are reported next to them for
context (they do not change the bar). Classes are compared by name; step-744 emits taxonomy v0.5.0 flag types, which
include `child_sexual_exploitation` and `self_harm`.

### What the record predicts (stated before the run, so the outcome is not a surprise)

Applied in hindsight to the five P3-2 H1 artifacts (same recipe, seeds 45–49; analysis only, not a P3-3 result):

| class | misses per seed (s45–s49) | median | worst | shipped (s48, best F1) | B1 | B2 | B3 |
|---|---|---:|---:|---:|---|---|---|
| CSE (n 40) | 1, 1, 1, 2, 3 | 1 | 3 | 2 (bound 14.9 %) | pass | pass | **fail** |
| self_harm (n 16) | 10, 5, 13, 9, 8 | 9 | 13 | 9 (bound 77.3 %) | **fail** | **fail** | **fail** |

Every P3-1 A2 and P3-2 artifact had 5–13 of 16 self_harm class misses on val. Unless the ten fresh seeds behave very
differently, **P3-3 is expected to be NOT MET on self_harm** (and possibly B3 on CSE). The run still answers whether
the recipe is stable across ten seeds and gives the per-seed numbers the v3 ADR and the retrain need. Whether that is
worth ≈ $1.2–2.2 of GPU time is Justin's call at the pod go-ahead.

## Reported, not gated

- Per seed: artifact val macro-F1, per-class F1, CSE miss/extra, self_harm class miss/extra, self_harm primitive miss,
  for the artifact and for every checkpoint at ep ≥ 2.0. Mean / SD / range / worst seed of artifact val F1, next to
  P3-2 H1 (.8156 / .0291, unpaired seeds) and P3-1 A2 (.8079 / .0397).
- **Convergence (5 % val class-flip rule), ANALYSIS ONLY.** A checkpoint is "converged" if ≤ 5 % (≤ 40/819) of val
  composed-class predictions change from the previous half epoch. Reported per seed: converged checkpoints, and
  whether each converged checkpoint meets B1's per-class miss count (≤ 1). This is the out-of-sample re-test from
  PHASE3-REMAINING-PLAN item 1. It is **never a gate, verdict, selection or stop**; any use needs an ADR.
- Item-id lists for safety errors stay off the repo (VPS archive only). No safety-class item text anywhere.

## Stop at first invalid output

The pipeline runs the seeds in order 50 → 59 and **stops at the first seed that does not produce every declared file**
(train meta, eight checkpoints' val raw, the flip file, the artifact and its val raw, the sha file), or on R0 mismatch
(`init_head_sha256` ≠ the P3-2 value, exit 16), a pack/teacher/val sha mismatch, a failed test, or low disk. Then
P3-3 has **no valid output**: no outcome is computed from a partial seed set, the GPU pod is terminated (below) and it
goes to Justin. B1–B4 are not used as an early stop: all ten seeds are needed for the median.

## Cost (from the P3-1 and P3-2 actuals) and cap

| basis | per-seed minutes (train + 8 ckpt val raw + average + val raw) | 10 seeds + setup/close-out | GPU-h | GPU $ at $0.89/h |
|---|---:|---:|---:|---:|
| P3-2 actual (pipeline log, seeds 45–49: 7.0–7.4 min each) | 7.3 | 73 + ≈ 8 | ≈ 1.35 | **≈ $1.20** |
| P3-1 actual (15 runs in ≈ 3.25 GPU-h; included per-run v2 inference) | 13 | 130 + ≈ 15 | ≈ 2.42 | ≈ $2.15 |

Plus the CPU copy pod (≈ 17 GB to the VPS; P3-2 copied 8.9 GB in 27 min for $0.03) ≈ $0.06, and volume storage
(≈ $0.004/h, already billing). **Estimate ≈ $1.25 (P3-2 basis), ≤ $2.2 (P3-1 basis). P3-3 cap $4.00**: the box monitor
kills the GPU pod at 4.0 GPU-h ($3.56) and the CPU copy pod at 2 h ($0.12). Pod type SECURE RTX 4090 EU-RO-1 (volume
`rmn62wuuzx`); if the listed price is above $0.99/h at creation, do not create and report.

Spend position: RunPod balance **$56.43** read 2026-11-01 01:09 NPT (it was $6.90 after P3-2, so a top-up of ≈ $50
was made; Phase 3 spend can no longer be derived from the balance difference alone). Phase 3 cumulative ≈ $4.75 through
P3-2 (REPORT-P3-2) + volume storage since (≈ $0.5) ≈ $5.2; with P3-3 at its cap ≤ $9.2, under the Phase 3 $20 hard cap,
the brief's $30 GPU stop and the $60 GPU budget. The run does not start if the balance is below $10.

## Pod headroom checklist (all before the GPU pod; each item recorded in the report)

1. Declaration commit pushed, `git ls-remote` shows it on `plan/phase3-recipe-stability`; VPS archive `sha256sum -c` OK.
2. Pre-pod addendum: `pack-p33.tgz` sha, `PACK.sha256` and the step-744 B4 reference (`p33/step744-val-ref.json`) committed, pushed, `ls-remote` verified, archived on the VPS.
3. Justin's go-ahead on the final cost (this declaration does not start a pod).
4. RunPod balance read the same hour; ≥ $10; `pods` = [] (no stray pod billing).
5. VPS free space read (needs ≥ 30 GB for the P3-3 copy; 204 GB free on 2026-11-01).
6. Network volume: P3-3 keeps 2 × 807 MB per seed (final + artifact) + ≈ 15 MB outputs ≈ **16.3 GB** retained
   (P3-2 measured ≈ 1.7 GB per seed in the pipeline's free-space log). The pipeline refuses to start with **< 22 GB**
   free (16.3 GB + 4 GB per-run floor + margin) and checks ≥ 4 GB before each seed; container disk ≥ 15 GB
   (checkpoints live there). Planning target before the pod: ≈ 32 GB free.
7. If the volume is short: prune **only** archives verified on the VPS, re-running `sha256sum -c` on the VPS
   immediately before each deletion (proposed list in the P3-3 headroom note; nothing deleted by this declaration).
8. The CPU-only headroom check on the volume (if needed) runs on a CPU pod ($0.06/h) and is terminated synchronously.

## Pod handling and close-out (as P3-2)

- Technical failure (exit ≠ 0, CUDA, sha mismatch, R0 mismatch, monitor timeout, SSH lost): kill, volume manifest +
  `sha256sum -c` of what exists, terminate the GPU pod **within 15 min**.
- Close-out: volume `MANIFEST-volume-p33.sha256` with `sha256sum -c` on the volume → raw outputs and logs pulled to the
  box (`sha256sum -c`) → GPU pod terminated → CPU pod copies `/workspace/p33` to the VPS → VPS `sha256sum -c` OK → CPU
  pod terminated (synchronously; no unattended watcher). The VPS is never terminated or rebooted. Then
  `analyze_p33.sh` on the box and REPORT-P3-3.
- No rule here is changed after the pod starts. If a rule cannot be computed, the result is "no valid output".

## After P3-3

REPORT-P3-3 fixes the recipe for the single 17 → 25 head retrain (`EXTENSION-NY-HEADS.md`, approved 2026-11-01),
whatever the Option B outcome; the retrain needs its own declaration. The binding certification gate on the sealed v3
set (≈ 120 positives per class, ≤ 1 miss, bound 3.9 %) is a later ADR and is **not** part of this declaration.
