# EXPLORATORY: within-run checkpoint averaging (epochs 2.0/2.5/3.0), FRESH-05 s12/s13/s14 + FRESH-06 s15

Date 2026-10-18 (NPT, UTC+5:45). Brief: Justin 13:56 NPT. **EXPLORATORY. Nothing here is certifiable.** Every number below was produced after the individual checkpoints' held-out results were already known. No pod was used, there was no new spend, and FRESH-06 was not rerun.

## Method
- **Sources.** VPS archives of the network-volume copies, each verified against its manifest just before use: FRESH-05 `MANIFEST-volume.sha256` `96000011…` (190 files, sha -c OK) and FRESH-06 `MANIFEST-volume-f06.sha256` `880b4e53…` (90 files, sha -c OK).
- **Averaging.** Per seed, a uniform mean (1/3 each) of every tensor in `model.safetensors` for that run's own epoch 2.0, 2.5 and 3.0 checkpoints. Accumulated in fp32 and stored fp16 like the source checkpoints (`avgx/average_n.py`). No cross-seed averaging.

  | averaged model | model.safetensors sha256 |
  |---|---|
  | avg-f05-s12 | `7a4d4be6…` |
  | avg-f05-s13 | `3d2cf76a…` |
  | avg-f05-s14 | `0b09a470…` |
  | avg-f06-s15 | `5e531aba…` |

- **Inference.** VPS CPU (`infer_raw_shared.py` 2d3c2030) under `flock /tmp/airp-vps-bench.lock`, `nice -n 10`, with a 9G memory cgroup. Run on val (819) and held-out v2 (471).
- **Scoring.** T=1, 0.5 on every yes/no head, stance argmax, corrected composition `4e840f3b…`. The scoring tooling is the same tooling that reproduced the FRESH-05 converged results bit-for-bit (`avgx/analyze.sh`).
- **Same-device control.** All 12 individual converged checkpoints were also re-inferred on the same VPS CPU. Their primitives are **identical** (same primitives sha) to the GPU records used by FRESH-05 and FRESH-06 on all 12, so the table compares like with like.

## Table (EXPLORATORY; v2 = held-out v2 471 items; E+M = extras + misses)

| seed | artifact | val macro-F1 | v2 E/M = E+M | v1-207 E/M = E+M | CSE | self_harm misses |
|---|---|---|---|---|---|---|
| s12 (F05) | ep2.0 | 0.7815 | 19/19 = 38 | 9/8 = 17 | clean | 0 |
| | ep2.5 | 0.7235 | 20/15 = 35 | 8/6 = 14 | clean | 0 |
| | ep3.0 | 0.7624 | 19/14 = 33 | 6/5 = 11 | clean | 0 |
| | **avg 2.0–3.0** | **0.7668** | **20/16 = 36** | **8/6 = 14** | **clean** | **0** |
| s13 (F05) | ep2.0 | 0.7639 | 25/17 = 42 | 8/8 = 16 | **FAIL** (extras bnd-02, ctr-03) | 0 |
| | ep2.5 | 0.8104 | 20/16 = 36 | 7/7 = 14 | clean | 0 |
| | ep3.0 | 0.8047 | 18/16 = 34 | 6/6 = 12 | clean | 0 |
| | **avg 2.0–3.0** | **0.8010** | **20/16 = 36** | **7/7 = 14** | **clean** | **0** |
| s14 (F05) | ep2.0 | 0.7904 | 18/18 = 36 | 4/7 = 11 | clean | 0 |
| | ep2.5 | 0.8085 | 16/12 = 28 | 4/5 = 9 | clean | 0 |
| | ep3.0 | 0.7844 | 14/16 = 30 | 4/5 = 9 | clean | 0 |
| | **avg 2.0–3.0** | **0.7985** | **16/14 = 30** | **4/5 = 9** | **clean** | **0** |
| s15 (F06) | ep2.0 | 0.7973 | 19/19 = 38 | 6/7 = 13 | clean | **1** (ho2c-self_harm-pos-12) |
| | ep2.5 | 0.7576 | 18/20 = 38 | 5/8 = 13 | clean | 0 |
| | ep3.0 | 0.7671 | 17/22 = 39 | 5/10 = 15 | clean | 0 |
| | **avg 2.0–3.0** | **0.7799** | **18/19 = 37** | **5/7 = 12** | **clean** | **0** |

Summary:

| | individual converged checkpoints (12) | within-run averages (4) |
|---|---|---|
| CSE or self_harm failure | 2/12 checkpoints; 2/4 seeds (s13, s15) | 0/4 |
| v2 E+M > 36 | 5/12 checkpoints; 3/4 seeds | 1/4 (s15: 37) |
| worst v2 E+M across seeds | 42 (s13 ep2.0); 39 at ep3.0 only (s15) | 37 (s15) |
| average vs the same seed's ep3.0 on v2 E+M | | worse on s12 (36 vs 33) and s13 (36 vs 34); equal on s14 (30); better on s15 (37 vs 39) |

## Node identity spot check (one averaged model, EXPLORATORY)
- **Model.** avg-f05-s13 (highest val macro-F1 among the averages). ONNX export on VPS CPU: `d5e78927…`, opset 17, max |Δ logit| vs torch 2.53e-4. Exploratory pins `5550dcea…` (T=1 / 0.5 / argmax, corrected composition).
- **Python (onnxruntime) vs Node `evaluate()` on all 471 items: PASS.**
  - Primitives, composed, decode and input feeds all match on 471/471 items.
  - Max |Δ logit| 1.04e-3; smallest Python margin 0.0126, about 12× the observed drift.
  - Node primitives also equal the torch-CPU gate record for this average on 471/471 items.
- No latency was measured; it was not asked for. The architecture is unchanged, so FRESH-05's 643 ms median is expected to carry over, but it was not re-measured.

## Steadiness verdict
**Criterion.** I wrote this criterion after the numbers were in, so it is not a pre-registered rule; Justin judges. Averaging counts as *clearly steadier* only if all three hold on these 4 seeds:
1. Every average is CSE-clean with 0 self_harm misses.
2. Every average meets v2 E+M ≤ 36, i.e. the averaged artifact would pass every scoring gate on every seed.
3. On v2 E+M, no average is worse than that seed's epoch-3.0 checkpoint, the current candidate unit.

**Result: NOT clearly steadier.**
- (1) holds: 0/4 averages fail CSE or self_harm, against 2/4 seeds whose converged checkpoints failed.
- (2) fails: s15's average is 37.
- (3) fails: s12 and s13 are worse than their epoch 3.0 checkpoint.

**Plain reading.** On these four seeds, averaging removed every CSE and self_harm failure and cut the worst-case E+M from 42 to 37. But under the averaged-artifact gate the drafted declaration would use, s15 would still fail (37 > 36), and on two seeds averaging gave up E+M against the final checkpoint. Four seeds is a small sample, and these are the seeds that motivated the idea.

**Not drafted.** Per the brief, the averaged-artifact certification declaration (2a) and the ADR note on the gate-unit change (2b) were not drafted. If Justin judges averaging steadier anyway, both can be drafted on request.

## Certification attempts so far

**What counts.** An *attempt* is a run with all three of the following:
- (i) declared in writing (committed, pushed and VPS-archived) before any pod or any result for the run;
- (ii) at least one model trained fresh for the run;
- (iii) a pre-written pass bar on held-out v2 whose pass would make the model a ship/adopt candidate for the shared-encoding evaluator.

**Excluded:**
- re-scorings and selections over already-trained models (DECLARATION-ENS, DECLARATION-AVG, RESCORE-CSE-CORRECTED, this report);
- the earlier architecture comparisons (2026-10-05 deciding run; decide 3b);
- exploratory reports (REPORT-EXPLORATORY-05).

| # | attempt (declaration) | declared / run (NPT) | seeds | outcome |
|---|---|---|---|---|
| 1 | Task 3: corpus round (DECLARATION-3) | Oct 13 | round1, round2 (+ base2) | **FAIL**: round not recommended (CSE not clean on all converged checkpoints) |
| 2 | Stability sweep (DECLARATION-SWEEP) | Oct 13 | 12 runs, 4 settings × 3 | **FAIL**: no setting passes (worst-seed E+M 43–68 across the 4 settings; CSE/self_harm failures) |
| 3 | Fresh round recipe (DECLARATION-FRESH) | Oct 13 | s3, s4, s5 | **FAIL**: s3 self_harm miss, s4 CSE extra ctr-03 |
| 4 | Arm B weighting (DECLARATION-ARMB) | Oct 14 | s6, s7, s8 | **FAIL**: s6 CSE miss, E+M 40 |
| 5 | Distillation (DECLARATION-DISTILL) | Oct 14 | s9, s10, s11 | **FAIL**: s9 E+M 49; s10 CSE + E+M 42 (s11 partly lost) |
| 6 | FRESH-05 (DECLARATION-FRESH-05) | declared Oct 15, run Oct 18 | s12, s13, s14 | **PASSED as declared** (epoch-3.0 bar, both ship gates). **Then failed** the ADR converged CSE ship gate (s13 ep2.0) and was **not shipped** (ADR 2026-10-18) |
| 7 | FRESH-06 (DECLARATION-FRESH-06) | Oct 18 | s15 (s16 stopped, s17 not run) | **FAIL**: s15 E+M 39, ep2.0 self_harm miss; stopped, no fallback |

- **Count: 7 attempts, 0 shippable passes.** Under the cutoff-rule ADR (2026-10-15: no prior run is certifiable), only #6 and #7 are certifications under the current rules: **2 attempts, 0 passes**. #6 passed its own declared bar but not the ship gates that apply now.
- The model card must name the attempt that passes, along with this count.
