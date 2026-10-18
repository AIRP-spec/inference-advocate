# REPORT FRESH-06: certification FAILS (seed 15 misses the declared bar). No fallback, run stopped.

Date 2026-10-18 (NPT, UTC+5:45). Declaration `DECLARATION-FRESH-06.md` `05458b43…` (commit e9c9354, pushed + ls-remote, VPS-archived before any pod).
Recipe: distillation (0.5 gold + 0.5 ens5 teacher) + the 40 approved r15 rows, train only, with ens5 teacher targets. Labels v6 `8013c115…`, train v6 `27bd533e…` (7372), teacher `ens5-train-soft-v6.jsonl` `c0d5babd…`. Decision rule: 0.5 on every yes/no head, stance argmax, T=1. Corrected composition `4e840f3b…`.

## Result

| run / ckpt | val composed macro-F1 | v2 extras/misses = E+M | CSE | self_harm misses |
|---|---|---|---|---|
| f06-s15 ep2.0 (step 464) | 0.7973 | 19/19 = 38 | clean | **1** (`ho2c-self_harm-pos-12`) |
| f06-s15 ep2.5 (step 580) | 0.7576 | 18/20 = 38 | clean | 0 |
| f06-s15 ep3.0 (step 693) | 0.7671 | 17/22 = **39** | clean | 0 |
| f06-s16 | not gated (killed at ~0.55 ep; checkpoint 0.5 only) | | | |
| f06-s17 | not started | | | |

- **Clause 1 (original bar on every seed at epoch 3.0): FAIL.** s15 has E+M 39, over the limit of 36. A single seed fails, so the worst-seed result is at least 39 whatever s16/s17 would give.
- **Clause 2 (converged gate): FAIL.** s15 at epoch 2.0 misses self_harm on `ho2c-self_harm-pos-12` (it emits conveys_method / [] / exceeds_common_knowledge, with no self_harm object).
- Clauses 3–5 (candidate, identity on 471 items, Node median): **not run**. The declaration runs them only if 1–3 pass. There is **no candidate**.
- Per the declaration ("No fallback. If any clause fails, the report says so and the run STOPS."), the pipeline was stopped at 07:44:04Z, once s15 was gated. s16 was killed mid-epoch 1 and s17 never ran. Nothing was rescored, and no other seed, checkpoint, cutoff or composition was tried.
- Descriptive only: at all three converged s15 checkpoints, the two FRESH-05 failure items compose clean. bnd-02 → depicts/sexual_activity (sexual_content only); ctr-03 → describes/[]/is_mention_not_use. CSE is clean at all three. This is not a pass for anything.
- The gate tooling (`f06/analyze-converged.sh`) reproduced the FRESH-05 converged results bit-for-bit before it was applied to f06.

## Data and teacher (steps 1–2)
- labels v6 = relabel-from-slots over corpus v6 (`1d2d49da…`) with kind table v6 (`c426f8d3…`, + 4 r15 kinds). The same tool first reproduced v5 `9480a89f…` exactly. Against v5: 40 new rows, 0 changed.
- r15 teacher rows `6d902287…` (VPS CPU, 5 ens5 checkpoints with sha checked, `teacher_probs.py` c8528f9e). Control: 8 v5 train rows recomputed bit-exact against `7a428e8d…`. The merged file covers exactly the 7372 train ids, with 0 val and 0 held-out rows.

## Archive and pods
- GPU pod t1o6v05xiysru6 (SECURE 4090, $0.89/h, network volume rmn62wuuzx), 07:28:07Z → terminated 07:45:47Z (~17.7 min). It was terminated after `MANIFEST-volume-f06.sha256` `880b4e53…` (90 files: s15 all 6 ckpts + raw + logs, s16 ckpt 0.5 partial, pack, preprocessed) passed sha -c on the volume.
- CPU pod 8zwu62mo1ueq1t ($0.06/h) 07:46:12Z → terminated 08:05:54Z, after the volume → VPS tar stream into `…/shared-adopt/f06/volume` (07:46:43–08:05:38Z) passed VPS `sha256sum -c` 90/90 OK. VPS free after: 325G.
- Pods: none. Volume rmn62wuuzx kept (~23G used).

## Spend
RunPod balance $13.79 → $13.51: this run ≈ $0.28 (GPU ≈ $0.26, CPU ≈ $0.02). Total ≈ $22.84 of $30 → ≈ $7.16 left. Volume ≈ $0.09/day continues.

## STOP
Certification failed. Nothing is published, nothing is merged, and no further training happens without Justin.
