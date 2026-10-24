# ADR: Fixed decision cutoffs for the shared-encoding primitives model

Date: 2026-10-15
Status: **Accepted**, effective 2026-10-15 22:14 NPT
Decided by: Justin Flores

## Decision

- Every yes/no primitive head fires iff **P(yes) ≥ 0.5** at T = 1, i.e. z_yes > z_no.
- Stance is **argmax**.
- Per-head best-F1 cutoffs fitted on validation are **no longer used for decisions**.
- Temperature (`T_stance`, `T_noul`) is still fitted on validation, but **only to report calibrated probabilities**. It does not affect decisions.

## Why

Validation is too well separated to support per-head best-F1 cutoffs (`decide/shared-adopt/TEMP-TRACE.md`):
- The models separate the validation split by very large logit gaps, which is also why the fitted T is about 4.
- Best F1 can then be reached anywhere inside a wide gap, so the search lands deep inside the positive mass.
- Distill s10: `sexual_activity` **+12.35 logits** and `subject_is_minor` **+8.39 logits** above the 0.5 cutoff. Fresh s5: `sexual_activity` +12.30, `profanity` +11.67.
- Across runs the fitted margins range from about −14 to +12 logits.

Temperature itself never changed a decision (0 differing decisions on all 22 runs checked). The instability came entirely from the cutoffs.

## Certification caveat

This rule was set **after held-out results had been seen under both rules** (the 0.5 rule and fitted cutoffs), including the distillation run, where they disagree. **No existing run can be certified under this rule.** Rescores of archived runs under it are exploratory only. Certification needs fresh seeds declared after this ADR.
