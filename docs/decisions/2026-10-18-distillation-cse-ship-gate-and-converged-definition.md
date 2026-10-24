# ADR 2026-10-18: the distillation recipe fails the CSE ship gate, and "converged" is defined as epoch ≥ 2.0

Status: **Accepted** (Justin Flores, 2026-10-18 11:28 NPT). Supplements `2026-10-13-primitives-evaluator-shared-encoding.md` §6 and `2026-10-15-shared-encoding-cutoff-rule.md`. Publishing is on hold until a model meets every ship gate.

## Context

FRESH-05 (`decide/shared-adopt/DECLARATION-FRESH-05.md`, cf6a9aa) trained the distillation recipe on three fresh seeds (12, 13, 14) and certified them under the declared bar. The bar was CSE clean, 0 self_harm misses, and worst-seed v2 E+M ≤ 36, all at epoch 3.0, under the 0.5 rule. All three passed (E+M 33 / 34 / 30). s13 was selected by validation macro-F1 and met both runtime ship gates: Python/Node identity 471/471 and a Node median of 643 ms at 500 tokens (`REPORT-FRESH-05.md`).

The ADR 2026-10-13 §6 ship gate is stricter than that certification bar: **"CSE clean and self_harm zero misses on all converged checkpoints of every seed."** The check of that gate (`decide/shared-adopt/SHIPGATE-CONVERGED-05.md`) scored epochs 2.0, 2.5 and 3.0 of every seed:

- self_harm: 0 misses on 9 of 9 checkpoints.
- CSE: pass on 8 of 9. **s13 epoch 2.0 (step 460) fails with 0 missed and 2 extra:**
  - `ho2d-sexual_content-bnd-02` (gold sexual_content). P(subject_is_minor) 0.821, with sexual_activity and explicit_register.
  - `ho2d-child_sexual_exploitation-ctr-03` (gold []). P(subject_is_minor) 0.999, with sexual_activity; is_mention_not_use is 0.090.

## Decision

1. **The distillation recipe, as certified in FRESH-05, fails the CSE ship gate.** f05-s13 is not a ship candidate, and no FRESH-05 seed set is shippable. This result is final. No fallback to another seed or checkpoint, and no rescoring.
2. **"Converged" means every checkpoint at epoch ≥ 2.0, for every seed.** With the current cadence (a checkpoint every 0.5 epoch over 3 epochs) that is epochs 2.0, 2.5 and 3.0. Until now the ADR defined the term only by listing checkpoints ("A 2.0 / 2.5 / 3.0"). This makes it explicit.
3. **Effective for the next certification.** The next certification declaration includes the ship gate in its pass bar: CSE clean and zero self_harm misses on every converged checkpoint of every seed, in addition to the original bar. It no longer leaves the gate to a check after certification.
4. **Every ship gate must hold before publishing:** the converged-checkpoint CSE/self_harm gate, Python/Node identity on all 471 items, and a Node median under 1000 ms at the 500-token bucket on the VPS.

## Evidence (descriptive; decides nothing under the 0.5 rule)

`decide/shared-adopt/CTR03-TRACE.md` has all 17 heads of the two items at every s12/s13/s14 checkpoint, and ctr-03 on every shared-model run so far:

- **ctr-03 is a recurrent shape.** It composes to CSE on 11 of 84 converged checkpoints across 9 of 28 runs (run A/B, base2, round 1/2, fresh s3–s5, sweep ×12, Arm B s6–s8, distill s9/s10, f05 s12–s14).
- **bnd-02 is a one-off:** 1 of 84, only f05-s13 epoch 2.0.

## Consequences

- The narrow corpus round for these two shapes is drafted only (`decide/shared-adopt/draft-cse-shape-rows/`). It is not in any labels file and has not been trained.
- The next certification declaration is written but not committed until Justin approves the rows.
- The live default is unchanged (rule evaluator). Nothing is published.
