# ADR: Averaged-checkpoint test unit and a "no worse than live" accuracy limit for shared-encoding certification

Date: 2026-10-18
Status: **Accepted**, effective 2026-10-18 15:12 NPT, for certification attempt 3 (FRESH-07) onward
Decided by: Justin Flores

## Decision

1. **Test unit.** For each declared seed, the certified artifact is the **uniform weight average of that seed's own epoch 2.0, 2.5 and 3.0 checkpoints**. It is made with `decide/shared-adopt/avgx/average_n.py` (sha `88f9cbcec29e1fe16e62de13dd84ce9770e14070099b84ca2cae36df9fac6b35`).
   - The averaged artifact is what has to pass. Individual checkpoints are reported for the record only.
   - The CSE-clean and 0-self_harm-miss requirement applies to every averaged artifact, one per seed. This replaces the per-checkpoint "converged gate" of ADR 2026-10-18 (distillation CSE ship gate), and that ADR's "converged" set (epoch ≥ 2.0) becomes the set that gets averaged.
2. **Accuracy limit.** The held-out v2 limit is **"no worse than live"**: v2 E+M (extra-class fires + items missing an expected class, as scored by `scoreHeldOutGateDual`) must not exceed the stricter of the evaluators live at declaration time.
   - For FRESH-07 the live evaluators are step-744 (E+M 32) and the rule evaluator (E+M 106), so the limit is **32** (`decide/shared-adopt/LIVE-BASELINE-STEP1.md`).
   - This replaces the earlier fixed bar of worst-seed E+M ≤ 36.
   - A live evaluator that is itself not CSE-clean or has self_harm misses does **not** relax the new model's requirement. Today step-744 has 2 self_harm misses; the rule evaluator misses CSE and self_harm. The new model must still be CSE clean with 0 self_harm misses.
3. Unchanged:
   - the decision rule (ADR 2026-10-15: 0.5 per yes/no head, stance argmax, T for reporting only);
   - fresh seeds declared before any pod;
   - no fallback;
   - the Python/Node identity and latency ship gates.

## Why, and when this was adopted

**Both changes were adopted after two certification attempts under the cutoff-rule ADR had failed.** They were not set in advance:
- **Attempt 1, FRESH-05** (seeds 12–14). It passed the then-current bar at epoch 3.0, but a converged checkpoint (s13 epoch 2.0) failed CSE (2 extras; `SHIPGATE-CONVERGED-05.md`). ADR 2026-10-18 then made every converged checkpoint subject to the CSE/self_harm gate.
- **Attempt 2, FRESH-06** (seed 15; stopped at the first failure). Epoch 3.0 had E+M 39 > 36, and the epoch 2.0 checkpoint missed self_harm item ho2c-self_harm-pos-12 (`REPORT-FRESH-06.md`).

The reasons:
- **Converged-checkpoint CSE/self_harm failures.** Single checkpoints flip CSE and self_harm decisions from one half-epoch to the next, so a single-checkpoint unit is unstable on exactly the classes that cannot be traded.
- **The exploratory averaging result (commit 8ccaf14, `REPORT-EXPLORATORY-AVG-06.md`).** This is the evidence for the change. On the four archived seeds (f05 s12–s14, f06 s15), every within-run average of epochs 2.0/2.5/3.0 was CSE clean with 0 self_harm misses. The individual checkpoints included those CSE and self_harm failures. On v2 E+M the averages were 36 / 36 / 30 / 37.
  - That report judged averaging **not clearly steadier** on E+M by its stated criterion.
  - That was exploratory and done after seeing the data. It is why this rule needs fresh seeds and can certify nothing retroactively.
- **"No worse than live"** ties the accuracy limit to what users get today. The earlier 36 was a round-specific number.

Because both changes were made after held-out results under the old rules had been seen, **no archived run can be certified under this ADR.** Rescoring archived runs under it is exploratory only.

## What passing means

Passing makes the averaged artifact **eligible to become a default**: a candidate Justin may choose to publish and switch to. It does **not** mean it passes the AIRP held-out gate in `data/evaluator-gate/gate.json` (zero extra-class fires, zero misses). Neither live evaluator passes that gate either. Publishing, uploading, merging and changing the live default (`resolveEvaluator`: `input.config ?? { kind: 'rule' }`) remain Justin's decisions.
