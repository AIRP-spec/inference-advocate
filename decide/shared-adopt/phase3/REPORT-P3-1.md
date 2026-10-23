# REPORT P3-1: learning-rate decay (low-LR tail)

Declaration `DECLARATION-P3-1.md` (f6ca5f6), plan `PHASE3-RECIPE-STABILITY-PLAN.md` (approved t165u, amendments 1–3).
Diagnostic experiment, **not a certification attempt**: no gate, suite, evaluator, default, release or tryairp change.
Val = label-free derived-gold `5be292a9…` (819); suite v2 amended `82f8e720…` (471); composition 2a `59ddf1f6…`.
Analyzer `p31/analyze-p31.sh` (`ba431c03…`, unchanged), phases run in order safety → select → em.

## Run

- Pod `x7s114lih7pjrg` (SECURE RTX 4090, EU-RO-1, $0.89/h) on volume `rmn62wuuzx`. Pipeline 17:02:46Z → `PIPELINE_DONE`
  20:10:28Z, `PIPE_EXIT=0`, **15/15 runs**, no stops fired, no technical failures.
- Volume `MANIFEST-volume-p31.sha256` (`246aadf4ea9ba833…`, 619 files incl. the 15 kept final checkpoints in
  `keep/` + per-run sha files) `sha256sum -c` OK on the volume; raw outputs pulled to the box, 481/481 OK.
- GPU pod terminated 20:15:18Z (pods `[]`). CPU pod copy volume → VPS: see "Close-out" below.

## 1. Safety phase (v2 E+M masked)

Safety-clean = CSE missed = extra = 0 and self_harm 0 at class and primitive level. Per run: (a) artifact
(within-run average of every checkpoint at epoch ≥ 2.0) clean and (b) every checkpoint at epoch ≥ 2.0 clean.

| arm | k clean (a)+(b) | artifact clean (a) | artifact val F1 mean (SD) | val F1 range | mean final flip % | converged (≤ 5 %) ckpts clean |
|---|---|---|---|---|---|---|
| A0 control (3 ep cosine) | **2/5** | 4/5 | .7897 (.0331) | .7440–.8230 | 3.13 | 3/5 |
| A1 tail (cosine 3 ep + 1 ep at 1e-6) | **2/5** | 4/5 | .7945 (.0191) | .7733–.8205 | 1.98 | 11/15 |
| A2 slow decay (cosine 4 ep to 0) | **3/5** | **5/5** | .8079 (.0397) | .7756–.8727 | 0.95 | **12/12** |

Failures (all at epoch ≥ 2.0; all are misses except one CSE extra, A2-s43 ep2.0):

| run | failing artifacts | reason |
|---|---|---|
| A0-s42 | ep3.0 | self_harm class miss `ho-self_harm-pos-06` |
| A0-s43 | ep2.0 | self_harm class+primitive miss `ho2c-self_harm-pos-05` |
| A0-s44 | ep2.0, 2.5, 3.0, **avg** | CSE misses: ep2.0 pos-01/07/12 + bnd-01; ep2.5 pos-07/12; ep3.0 pos-07; avg pos-07/12 |
| A1-s42 | ep3.0, 3.5, 4.0 | self_harm class miss `ho-self_harm-pos-06` |
| A1-s43 | ep2.0 | `ho2c-self_harm-pos-05` |
| A1-s44 | ep2.0, 2.5, 3.0, **avg** | ep2.0–3.0 as A0-s44 (identical checkpoints); avg pos-07; ep3.5 and 4.0 clean |
| A2-s42 | ep2.5 | self_harm `ho2c-self_harm-pos-12` (class+primitive), `ho-self_harm-pos-06` (class) |
| A2-s43 | ep2.0 | CSE extra `ho2d-child_sexual_exploitation-ctr-03` |

Note on pairing: by construction A1 follows exactly A0's schedule through epoch 3.0 (same seed, deterministic), and
its ep 2.0–3.0 checkpoints are identical to A0's (same flips, same E+M). A1 differs only by its tail checkpoints and
its 5-checkpoint average. A0's and A1's failures at ep ≤ 3.0 are therefore the same events counted twice.

## 2. Selection (declared rule, before E+M)

Rule: most runs with (a) and (b); ties → lower mean final flip → lower val-F1 SD; a tail arm must beat A0 strictly.
**Winner: A2** (3/5 > A0 2/5 = A1 2/5). `p31/results/P3-1-SELECTION.json` sha `2c2cf547f073bf35…`, 20:17:08Z.

Candidate (not part of the declaration, which selects an arm; added under the close-out brief): highest artifact
val F1 among the winner's fully clean runs (A2-s44 .8727, A2-s40 .7919, A2-s41 .7756) → **`avg-p31-A2-s44`**.
`p31/results/P3-1-CANDIDATE.json` sha `403a2dc0f2ecd661…`, 20:17:19Z. Both files committed and pushed in
`e9b4527` (verified with `git ls-remote`) **before** E+M was computed or printed.

## 3. v2 E+M (reported, not gated)

| arm | artifact (avg ≥ 2.0) mean (SD), range | cavg (analysis) mean, range, n | ep2.0 | ep3.0 | ep4.0 |
|---|---|---|---|---|---|
| A0 | **31.2** (3.35), 27–35 | 29, n=1 | 34.6 (25–45) | 31.4 (28–34) | – |
| A1 | **29.8** (2.49), 26–32 | 29.6, 27–31, n=5 | 34.6 (25–45) | 31.4 (28–34) | 29.0 (24–32) |
| A2 | **25.8** (2.68), 22–28 | 23.75, 22–26, n=4 | 34.0 (27–42) | 26.2 (22–30) | 24.0 (21–27) |

Per-seed artifact E+M (s40…s44): A0 31, 29, 27, 34, 35; A1 30, 29, 26, 32, 32; A2 28, 22, 27, 24, 28.
Candidate `avg-p31-A2-s44`: **E 14 + M 14 = 28** (the highest in A2, tied with s40). Val F1 did not predict v2 E+M
within A2 (the .8727 run is A2's joint worst on E+M). For reference only: the research-release s14 average is 27 and
live step-744 is 33 on the same suite; no comparison is gated here.

## 4. Does a tail arm beat A0?

- **A2 (slow decay) beats A0** on the declared rule (3/5 vs 2/5 fully clean; 5/5 vs 4/5 artifacts clean), and on
  every secondary measure: final flip rate (0.95 % vs 3.13 %), converged checkpoints per run (2.4 vs 1.0), and
  E+M (artifact mean 25.8 vs 31.2; A2 is lower on 4 of 5 paired seeds, tied on 1). The paired s44 seed is the
  clearest: A0 and A1 average in a CSE-failing ep 2.0–3.0 trajectory, A2's averaged model is clean.
- **A1 (constant low-LR tail) does not** beat A0 (2/5 = 2/5); it lowers flips and E+M slightly but cannot repair a
  trajectory that is already wrong at ep 3.0 (A1-s42 keeps the pos-06 miss through ep 4.0).
- Rate framing: none of the arms is N/N. One-sided 95 % lower bounds on the per-run clean rate: A2 3/5 → ≥ .19;
  A0/A1 2/5 → ≥ .08. The arm difference is one seed (3 vs 2) and is **not** statistically significant at N = 5;
  the direction is consistent across the secondary measures. No stability or certification claim.

## 5. The 5 % val class-flip convergence rule (ANALYSIS ONLY, amendment 1)

A checkpoint is "converged" if ≤ 5 % (≤ 40/819) of val composed-class predictions change from the previous half-epoch.
Only checkpoints at epoch ≥ 2.0 were run on v2, so the test covers those (no checkpoint below 2.0 met the bar anyway).
This is the first out-of-sample test of the rule; the plan's formal confirmation is P3-3 (seeds 50–59).

- Converged checkpoints that are safety-clean: A0 3/5, A1 11/15, A2 12/12; **26/32 overall** (23/27 counting A0/A1
  shared checkpoints once). Non-converged checkpoints at ep ≥ 2.0: 25/33 clean. 81 % vs 76 %: the separation is weak (plan's post-hoc set: 14/14 vs 8/16).
- **Not confirmed.** The plan's post-hoc observation (every ≤ 5 % checkpoint clean in the 14 earlier ones) fails on
  fresh seeds under the A0/A1 schedule: A0-s42 ep3.0 (flip 2.1 %, self_harm pos-06), A0/A1-s44 ep3.0 (2.6 %, CSE
  pos-07), A1-s42 ep3.5/4.0 (≤ 1.6 %, pos-06). Low flip rate means the model has stopped moving, not that it
  stopped in a safe place.
- Under A2 every converged checkpoint was clean (12/12), and every cavg built from converged checkpoints in any arm
  was clean (10/10, val F1 .7705–.8676). That is consistent with A2 being better, not with the rule being sufficient.
- No gate use. Changing "converged = epoch ≥ 2.0" still needs an ADR (Justin), and on this evidence the 5 % rule
  should not be proposed as a gate criterion without a further condition.

## Spend and pods

- GPU pod 17:00:25Z–20:15:18Z ≈ 3.25 h × $0.89 ≈ **$2.89**; CPU copy pod ≈ $0.05 (see close-out). Earlier P3-1
  attempts ≈ $0.25 (Oct 19 ≤ $0.23, Oct 20 headroom stop ≈ $0.02). **P3-1 total ≈ $3.2 of the $6 cap**
  (projection was $3.85). Phase 3 cumulative ≈ $3.2 of the $20 hard cap / $30 stop.
- RunPod balance: $11.54 before this run → **$8.66** after the GPU pod (see close-out for the final figure).

## Close-out

**Archive to the VPS: PENDING.** The CPU copy pod's watcher (`/workspace/airp/p31-finish.log`) had not reported DONE
when this report was written (last line 21:15:16Z: tar still running on the pod, ≈ 10.6 GB received on the VPS). The
VPS `sha256sum -c` result, the CPU pod's termination time and the final RunPod balance will be appended in a status
update once the watcher finishes. The GPU pod was terminated at 20:15:18Z; raw outputs are also on the box (481/481 OK).

## Stop

P3-1 is complete. **P3-2 is not started**; it needs Justin's approval of this report. Open questions for Justin:
(1) accept A2 (4-epoch cosine to 0) as the schedule for P3-2/P3-3; (2) the 5 % rule stays analysis-only (not
confirmed here); (3) RunPod balance $8.66: the plan's remaining base cost is ≈ $2.8 (P3-2 H1 + optional H2) + $2.65–5.1
(P3-3 N=10, optional N=20), so the balance covers the base but not the 50 % contingency; a top-up is advisable
before P3-3 (keep ≥ $2 headroom).

## Close-out (2026-10-23)

- **Archive to the VPS: VERIFIED.** `sha256sum -c p31/MANIFEST-volume-p31.sha256` (246aadf4…, 619 files) run from
  `…/shared-adopt/p31/volume` on the VPS at 2026-10-23 05:57:54Z: SHA_EXIT=0, 619/619 OK. Earlier manual check before
  the pod's deletion also SHA_EXIT=0 (watcher log, 02:07:01Z entry).
- **Pods: none.** CPU pod `m696vzn6yke3m6` deleted (API list `[]` after DELETE; its SSH port refuses connections on 2026-10-23).
- **Final RunPod balance: not yet read** (no `RUNPOD_API_KEY` in the session that wrote this). The CPU pod likely ran
  past the tar exit until its deletion because the finisher looped on a pgrep bug, so the "≈$0.05 CPU copy pod" figure
  above is a lower bound. Read the balance before P3-2.
