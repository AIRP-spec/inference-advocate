# Report: weight averaging of round seeds (DECLARATION-AVG)

Date 2026-10-13 (NPT). Declaration `DECLARATION-AVG.md` sha256 `4607d06c74cf73543256ccdb124a473c5a48b1ed6b913c16c436466de27037c6` (committed tip `3540fa2`, ls-remote verified, VPS-archived **before** averaging inference/gating). Best single-round v2 E+M stated in declaration: **31**.

Compute: Nepal VPS CPU under `flock /tmp/airp-vps-bench.lock` + `nice -n 10`. No GPU pod. Spend this step: **$0.00** (total still ~**$3.11 of $30**).

## CSE failure table (archived, read-only) — summary

Full detail: `CSE-FAILURES.md` (sha256 `927ae789…`). Converged epoch ≥ 2.0.

| run | 2.0 | 2.5 | 3.0 |
|---|---|---|---|
| A (ref) | PASS | PASS | PASS |
| base2 | FAIL extra `ho2d-…-ctr-03` | PASS | FAIL extra `ho2d-…-ctr-03` |
| round1 | FAIL extras `ho-hate-pos-04`, `ho2d-…-ctr-03` | FAIL extra `ho-hate-pos-04` | FAIL extra `ho-hate-pos-04` |
| round2 | FAIL miss `ho2d-…-pos-01` | PASS | PASS |

Drivers: CSE composes on `subject_is_minor`. Round1 hate false-fire co-fires that qualifier; base2/round1 ctr-03 co-fires minor+sexual_activity; round2 miss keeps minor below 0.5.

## Averaging gate (decision-bearing = val-fitted T/thresholds)

| average | T_stance / T_noul | CSE | self_harm FN | v2 E+M | bar1 CSE | bar2 sh | bar3 ≤31 | recommend |
|---|---|---|---:|---:|---|---|---|---|
| `avg-r12-epoch-2.5` | 0.777 / 0.830 | FAIL (miss 1, extra 2) | **0** | 64 (16+48) | FAIL | PASS | FAIL | **no** |
| `avg-r12-epoch-3.0` | 0.791 / 0.866 | FAIL (miss 2, extra 1) | **0** | 64 (17+47) | FAIL | PASS | FAIL | **no** |

**Outcome: recommend neither average.** Every bar applied per average; no fallback.

Primary T=1 / 0.5·argmax (continuity only, not decision): ep2.5 v2EM=65 CSE miss7; ep3.0 v2EM=67 CSE miss10; self_harm FN=0 both.

## Probability ensemble (reference only)

Two-pass: average archived `p_true` + stance probs of round1∥round2 at matched epochs; fit thresholds on val ensemble probs only.

| ensemble | CSE | self_harm FN | v2 E+M |
|---|---|---:|---:|
| ens-r12-epoch-2.5 | FAIL (extra `ho-hate-pos-04`) | 0 | 38 |
| ens-r12-epoch-3.0 | FAIL (extra `ho-hate-pos-04`) | 0 | 36 |

Not decision-bearing.

## Artifacts

- VPS: `…/shared-adopt/work-avg/` averages, raw logits, `run_avg_vps.log`
- Box/repo: gates, secondary fits, ensemble, this report, `STABILITY-SWEEP-PROPOSAL.md`
- Declaration sha: `4607d06c…`
