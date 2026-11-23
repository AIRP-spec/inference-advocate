# Phase 3 plan: recipe stability (APPROVED by Justin 2026-10-19 17:12 NPT, t165u)

Written 2026-10-19 (NPT). **Approved 2026-10-19 17:12 NPT (Justin, t165u)**, with the amendments in
"Approval amendments" below. Status when first written: **plan only**. No pod was created, nothing was spent ($0.00), no gate, suite,
evaluator, workflow or secret was touched. Every experiment below needs (1) Justin's approval of this plan and
(2) its own DECLARATION committed, pushed (verified with `git ls-remote`) and archived to the VPS before any pod exists.

Budget (Justin, t164u): **$60 GPU, stop-and-report at $30.** This plan projects **≈ $9–12 base, ≈ $17 with 50 %
contingency**, and sets a Phase 3 hard cap of **$20** so the rest of the $60 stays for v3 corpus/training work.
Ledger for Phase 3 starts at $0.00 (if Justin meant the $60 to be cumulative with earlier spend, the $30 stop
still holds and is not reached by this plan).

Inputs used (all existing records, read-only):
`f10/record/all-artifacts/results.json` (40 artifacts: 10 seeds × ep 2.0/2.5/3.0 + 10 within-run averages,
valF1, v2 E/M, CSE, self_harm proxy + class), `f10/rescore/SUMMARY.txt`, the per-checkpoint raw val outputs of
FRESH-05…10 (all six half-epoch checkpoints per seed), pod train logs `train-f07-s18/19/20`, `f08-s21`, `f09-s24`,
`f10-s27`, `REPORT-SWEEP.md`, `DECLARATION-FRESH-10.md`, `PROGRESS.md` (pod costs), `pack-f09/train_shared.py`
and `shared_model.py`. Analysis script: `phase3/convergence_flips.py` → `phase3/convergence-flips.json`
(sha256 `e72fac43…4da2b7c`), using the composition module from PR #34 (`v3/airp_v3`, 1767890).

## Approval amendments (Justin, t165u, 2026-10-19 17:12 NPT)

1. **The 5 % convergence rule (§0.3) is ANALYSIS-ONLY** until it is confirmed on new seeds (P3-3). It is reported in
   every Phase 3 result, but no gate, pass/fail verdict or stop decision uses it. Using it in any gate needs an ADR.
   Until then the ADR 2026-10-18 definition ("converged = epoch ≥ 2.0") is the only one with gate force, and the
   Phase 3 safety reporting covers **every checkpoint at epoch ≥ 2.0** as well as the declared artifact.
   Consequently, P3-1's declared artifact for an arm is the within-run average of its checkpoints at epoch ≥ 2.0
   (the current rule, extended to 4.0 for the 4-epoch arms); the "average of converged checkpoints only" variant is
   reported alongside as analysis.
2. **Validation gold is derived** (ADR `docs/decisions/2026-10-19-val-gold-classes-derived.md`): Phase 3 pins the
   label-free val split sha256 **`5be292a911f0082a74c6e24beb20a60455fab4a86baded561784d37f2b453009`** and selects
   with `phase3/select-composed-f1-derived.mjs` (classes derived via 2a at load time, with assertions). The legacy
   val sha `346d6ba4…` is no longer used. The flip-rate analysis (§0.2) is gold-free and is unaffected.
3. Budget: $60 GPU, **stop and report at $30**, and stop and report after **each** experiment (P3-1 first). Each
   experiment's declaration is committed before its pod; headroom check before each run; checksum-verified volume
   copy before termination; terminate within 15 min of any failure.

---

## 0. What the existing records say (no pod, $0)

### 0.1 Safety by checkpoint, current recipe (10 seeds: s12 s13 s14 s15 s18 s19 s20 s21 s24 s27)

"Clean" = CSE missed = extra = 0 **and** self_harm 0 misses at class level **and** primitive level.

| artifact | safety-clean seeds | v2 E+M mean (SD) range | val F1 mean (SD) |
|---|---:|---|---|
| ep 2.0 | **4/10** | 35.2 (3.9) 29–41 | .7843 (.0291) |
| ep 2.5 | 8/10 | 31.2 (4.5) 24–37 | .7802 (.0270) |
| ep 3.0 | **10/10** | 30.9 (2.9) 27–37 | .7846 (.0156) |
| avg(2.0, 2.5, 3.0) | 9/10 | 31.5 (3.7) 27–37 | .7876 (.0209) |
| best-val-F1 ckpt per seed | 7/10 | — | — |

Failures: ep 2.0 — s13 (CSE extras sexual_content-bnd-02, cse-ctr-03), s15/s19/s20 (self_harm **pos-12**, class +
primitive), s21 (CSE **pos-07** + pos-12 misses), s27 (pos-12, class only). ep 2.5 — s18 (pos-12 class only), s24
(CSE bnd-01 miss). Averages — only s21 fails (CSE **pos-07**), although its ep 2.5 and ep 3.0 are both clean: the
unconverged ep 2.0 member is carried into the average. Every failure is at ep 2.0/2.5 or in an average containing ep 2.0.

### 0.2 Candidate convergence signals

**Train loss / reward (logs): rejected.** Half-epoch window means plateau by ep 1.5 (reward ≈ .71–.75 from 1.5 on;
loss window means within ±0.03 of 0 and sign-flipping). By that signal ep 2.0 would be "converged", but ep 2.0 is
where 6/10 seeds fail safety. The RLCD loss is noisy (σ noise, negative values) and insensitive to the boundary items.

**Val macro-F1: rejected as a convergence signal.** It does not plateau: half-epoch moves of −.056…+.048
(ep 2.0→2.5) and −.025…+.038 (2.5→3.0), no monotone trend, seed SD falls only at ep 3.0. It is also depressed
by gold that disagrees with itself: **72/819 val rows** carry stored `expect` classes that differ from composing
their own gold primitives under 2a (32 cse-alone-age-marker, 20 cse-frame-enact, 20 rh-denial; found while building
`v3/airp_v3/score.py`). Selection F1 should be computed on **derived** classes from now on (score.py does this).

**Prediction stability between consecutive checkpoints: adopted.** Fraction of the 819 val rows whose composed class
set changes between consecutive half-epoch checkpoints (gold-free, v2-free):

| to ckpt | mean | min | max | stance flips | rows with a flip on subject_is_minor / sexual_activity / self_harm |
|---|---:|---:|---:|---:|---:|
| 1.0 | 27.0 % | 21.3 | 33.3 | 13.0 % | 44.4 |
| 1.5 | 16.5 % | 10.7 | 23.8 | 8.2 % | 32.7 |
| 2.0 | **9.2 %** | 6.2 | 12.3 | 5.0 % | 18.8 |
| 2.5 | 4.9 % | 3.5 | 6.0 | 3.1 % | 9.0 |
| 3.0 | **2.7 %** | 2.0 | 4.4 | 1.5 % | 4.1 |

The flip rate roughly halves every half epoch and tracks the cosine LR (encoder LR 6.0e-6 at 2.0, 2.35e-6 at 2.5,
1.0e-6 at 3.0 — ep 2.0 is still at 27 % of peak). ep 2.0 is **not** converged by this measure.

### 0.3 Empirical "converged" definition (proposed; post hoc, so it must be confirmed in P3-3)

> **(Analysis-only; see Approval amendment 1.)** A checkpoint *c* is **converged** iff its composed-class flip rate on val versus the previous half-epoch
> checkpoint is **≤ 5.0 %** (≤ 40 of 819 rows). Computed from val raw outputs only (no gold, no v2), before any
> v2 number is opened.

Check against the records:

| | qualifying ckpts | safety-clean |
|---|---:|---:|
| flip ≤ 5 % | 14 (all ten ep 3.0; ep 2.5 of s14, s15, s19, s27) | **14/14** |
| flip > 5 % | 16 (all ten ep 2.0; ep 2.5 of s12, s13, s18, s20, s21, s24) | 8/16 |
| old ADR rule "ep ≥ 2.0" | 30 | 22/30 |

It catches every observed instability: self_harm pos-12 at ep 2.0 (s15 6.2 %, s19 12.2 %, s20 10.6 %, s27 9.7 %)
and at ep 2.5 (s18 5.4 %), CSE pos-07 at ep 2.0 (s21 12.3 %), CSE at ep 2.5 (s24 5.9 %), CSE extras at s13 ep 2.0
(8.2 %). A tighter 3 % bar would also exclude s24 ep 3.0 (4.4 %); 5 % is the bar declared here. **Caveat:** the
threshold was chosen looking at v2 safety outcomes of the same 30 checkpoints, so it is a hypothesis until P3-3
reproduces it on fresh seeds. Changing the ADR's "converged = epoch ≥ 2.0" is Justin's decision (ADR), not this plan's.

Consequence for averaging: average **only converged checkpoints** (at least the final one). With the current
3-epoch cosine there is usually just one (ep 3.0), which is the motivation for P3-1.

---

## Common rules for every Phase 3 experiment

1. No pod until Justin approves this plan. Then, per experiment, a DECLARATION (pins: data v8 `f971f45c…`, teacher
   `ens5-train-soft-v8` `d30503f4…`, composition 2a `59ddf1f6…`, suite `82f8e720…`, script shas) is committed,
   pushed, verified with `git ls-remote`, and archived to the VPS (sha -c) before the pod is created.
2. Fresh seeds only (none used before: earlier seeds ≤ 29). Seeds paired across arms where stated.
3. Code changes are opt-in CLI flags with defaults that reproduce `train_shared.py` `aab483c2…` exactly
   (CPU test: LR/σ trace for the default path identical to the old script). No change to the suite, gates,
   evaluator, `tryairp`, workflows, secrets; no self-hosted runner; draft PRs only; no merges.
4. Selection-before-v2: the converged set, the artifact and any winner are computed from val raw outputs and
   safety-masked scoring (`score.py --mask-accuracy`), written to a selection JSON, committed and pushed **before**
   v2 E+M is opened.
5. Reporting is rate-based: for each arm, *k/N* seeds safety-clean (CSE missed = extra = 0, self_harm 0 at class and
   primitive level) at the declared artifact **and** at every converged checkpoint; E+M as mean, SD, range.
   One-sided 95 % lower bound on the per-seed clean rate for N/N: N=5 → .55, N=10 → .74, N=15 → .82, N=20 → .86.
6. Stop on spend: stop and report at a Phase 3 cumulative $20 (hard cap) and in any case at the $30 stop.
   Archive raw outputs to the VPS (sha verified) before terminating any pod; the VPS is never terminated.
   Volume headroom checked before each run; checkpoints below the converged set are deleted after inference.

Cost model (from PROGRESS): SECURE 4090 **$0.89/h**; one 3-epoch seed incl. inference of all checkpoints
≈ 8.5 min (FRESH-07: 3 seeds in 25.4 GPU-min, $0.38) to ≈ 11.7 min (sweep: 12 runs in 140 min) → planned at
**12 min = $0.178 per 3-epoch "unit"**; 4-epoch runs = 1.33 units. Per pod session +15 min fixed ($0.22; FRESH-08's
single seed cost $0.36). CPU copy pod $0.06/h ≈ $0.05/session. Volume $0.004/h. Averages and soups are built and
scored on the VPS CPU ($0).

---

## P3-1 Learning-rate decay (low-LR tail)

Question: does more training time at low LR make **more than one** checkpoint converged and the safety outcome
seed-independent? (The earlier sweep showed that a *lower peak* LR or longer warmup is worse — L5e6 worst E+M
57/68, L1e5 still fails one seed per setting — so peak LR stays 2e-5 / head 1e-4; only the decay changes.)

| arm | schedule (enc 2e-5 / head 1e-4 peak, no warmup, σ 0.25→0.1 over the cosine part) | ckpts | units/seed |
|---|---|---|---:|
| A0 control | current: cosine over 3 ep to 1e-6 | 0.5 … 3.0 | 1.00 |
| A1 tail | cosine over 3 ep to 1e-6, then 1 ep constant at 1e-6 (σ held at 0.1) | 0.5 … 4.0 | 1.33 |
| A2 slow decay | cosine over 4 ep to 0 (`eta_min=0`) | 0.5 … 4.0 | 1.33 |

Seeds: **40, 41, 42, 43, 44**, the same five in every arm (paired; seed sets data order, RLCD noise and — until
P3-2 — head init). Per arm: N = 5.

Declared outcomes (val raw only, before v2):
- converged set per seed by the 0.3 rule; number of converged checkpoints per seed;
- artifact = uniform average of the converged checkpoints (within-run, same init — valid);
- winner = arm with the most seeds safety-clean at its artifact and at every converged checkpoint; ties →
  lower mean final flip rate, then lower val-F1 SD (derived gold). E+M is opened only after the winner is pushed.
- If no tail arm beats A0, the result is "keep the 3-epoch cosine, artifact = ep 3.0 only".

Code: `--lr-schedule {cosine,cosine_tail,cosine_to_zero}`, `--tail-epochs`, checkpoint cadence and
`pod_pipeline.sh` epoch list extended to 4.0. CPU tests of the LR/σ trace for each schedule.

Cost: 5×1.00 + 5×1.33 + 5×1.33 = 18.3 units ≈ 220 GPU-min + 2 sessions (volume headroom) ≈ **4.2 GPU-h ≈ $3.75**,
+ CPU copy $0.10 → **≈ $3.85** (arm cap $6).

## P3-2 Head-initialisation fix (valid cross-seed averaging)

Finding from the code: `train_shared.py` calls `torch.manual_seed(seed)` and then `load_base(...)`, whose docstring
says "heads freshly initialised (seed set by caller)". The encoder starts from the same Laya weights in every seed,
but the cross-attention head layers, trunk and per-question heads get a **different random init per seed**. The
existing averages are within one run (same init) and are valid; an average **across seeds** is not, because the
heads do not share a basin/permutation.

Fix: `--head-init-seed K`: seed K immediately before `load_base` (heads), then re-seed with `--seed` for data
order and noise. Default unset = old behaviour. CPU test: two runs with different `--seed` and the same
`--head-init-seed` produce byte-identical head tensors at step 0 (sha of the init state_dict), and the default path
is unchanged.

| arm | init | seeds | units |
|---|---|---|---:|
| H1 shared head init | `--head-init-seed 7` for all; data seeds **45–49**; schedule = P3-1 winner | 5 | 5 × 1.33 = 6.67 |
| H2 common warm start (optional) | one trunk run to ep 0.5 (head seed 7, data seed 45), then 5 branches (data seeds 45–49) continue from that checkpoint | 5 | ≈ 6.0 |
| H0 negative control | the five A0/P3-1-winner seeds (different head inits) — no new training | 5 | 0 |

Declared validity test (CPU on the VPS, $0): for each pair of seeds, the midpoint weight interpolation's val loss
and derived-gold val F1 must be within .02 of the worse endpoint (no barrier), and the 5-seed soup's val F1 ≥ the
mean of its ingredients. Cross-seed averaging is declared **valid for an arm only if every pair passes**; H0 is
expected to fail (that confirms the problem). Then: rate-based safety for each per-seed artifact and for the soup.

Cost: H1 ≈ 80 + 15 min ≈ **$1.45**; H2 (optional) ≈ **$1.35**; soups/interpolations $0 (VPS CPU). Arm cap $3 each.

## P3-3 Confirmation (rate-based gate dry run)

One declared recipe = P3-1 schedule + P3-2 init (if valid) + 0.3 converged rule + artifact rule (within-run average
of converged checkpoints, or cross-seed soup if P3-2 passes). Fresh seeds **50–59 (N = 10)**; optional extension
**60–69 (N = 20)** only if 10/10 and the spend allows.

Outcome reported as: safety-clean k/N at the artifact and at every converged checkpoint (bar for "stable":
**N/N**, i.e. 10/10 → per-seed clean rate ≥ .74 at 95 %); fraction of converged checkpoints that are clean (tests the
0.3 rule out of sample); E+M mean/SD/range after the selection commit. This is evidence for an ADR Justin may
write; it does not change the live gate or the suite.

Cost: N=10: 13.3 units ≈ 160 + 15 min ≈ **$2.65**; extension to N=20 **+$2.45**.

---

## Cost table

| step | GPU-h (planned) | cost | cap | cumulative (base) |
|---|---:|---:|---:|---:|
| P3-0 analysis (done in this plan) | 0 | $0.00 | $0 | $0.00 |
| P3-1 LR decay, 3 arms × 5 seeds | 4.2 | $3.85 | $6 | $3.85 |
| P3-2 H1 shared head init, 5 seeds | 1.6 | $1.45 | $3 | $5.30 |
| P3-2 H2 warm-start branches (optional) | 1.45 | $1.35 | $3 | $6.65 |
| P3-3 confirmation N=10 | 2.9 | $2.65 | $6 | $9.30 |
| P3-3 extension to N=20 (optional) | 2.7 | $2.45 | — | $11.75 |
| volume (~3 days) | — | $0.30 | — | $12.05 |
| contingency +50 % (discarded/failed pods, reruns) | — | $6.00 | — | **≈ $18** |
| **Phase 3 hard cap** | | | **$20** | |
| Justin's stop-and-report | | | **$30** | not reached |
| Justin's GPU budget | | | **$60** | ≥ $40 left for v3 |

Order and stop points: P3-1 → report → P3-2 → report → P3-3. Each arrow is a report to Justin; nothing continues on
a FAIL without approval. OpenRouter spend: none in Phase 3.

## What this plan needs from Justin

1. Approve or edit the plan (seeds, arms, $20 cap).
2. Decide whether the flip-rate "converged" definition may replace "epoch ≥ 2.0" for Phase 3 *analysis* (an ADR
   would be needed before it is used in any certification gate).
3. Decide whether val selection uses derived gold (recommended) or the 72 inconsistent rows are relabelled
   (a data change, separate declaration).
