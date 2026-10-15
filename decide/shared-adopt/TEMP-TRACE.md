# TEMP-TRACE: temperature and thresholds in the shared-model secondary (val-fitted) mode

Date 2026-10-15 (NPT). Read-only. Code and **validation only**: no held-out result was used to decide anything here. Evidence: `temptrace/equiv.py` and `temptrace/equiv.json`, with fits in `temptrace/fits/` (a fresh val-only fit of every epoch-3.0 shared run; same code as the gates).

## Code trace

**Fitting** is `fit_secondary.py` (sha `e1079326…`, the same file in repo `laya-shared/` and every `pack-*`).
- **Where T is applied:** `softmax(z, T)` does `z / T` on the raw head logits. **T divides the logits.**
- **Per head or shared:** **two shared temperatures per checkpoint**. `T_stance` covers the stance head. `T_noul` is one value for **all 16 yes/no heads together** (`fit_one_temp` pools every (logits, gold) pair of the 16 heads). Each is fitted by LBFGS on validation NLL and clamped to [0.1, 10].
- **Threshold scale:** fitted on **P(yes) = softmax(z / T_noul)[1] on val**, per primitive. Search: best F1 over the candidates {0, 0.5, 1} plus every val score; ties go to the lower threshold; a head with no val positives gets 0.5.
- **Applied scale:** the same `fit_secondary.py` writes `primary-secondary/<ckpt>/{val,heldout}-primitives.jsonl` with **the same `softmax(z / T_noul)[1] >= thr[q]`** and stance = argmax of `softmax(z / T_stance)`. Same scale, same T, same code path.

**Scoring** (`gate-from-primitives-comp.mjs`, `select-composed-f1.mjs`) reads those primitive files. It never sees logits, T or thresholds, so there is no second place where T is applied.

**No-temperature rescore** (the primary mode in the distill report) uses `laya_raw_to_primitives.py` `decide_row`. It is the same `softmax(z / T)` with T = 1 and threshold 0.5 on every head, i.e. fire iff z_yes > z_no.
- **What actually differs between the two modes is not T.** It is per-head val-fitted thresholds against a flat 0.5.
- The Node pins path also takes T and per-head thresholds from the pins file. In this runtime it only ever carried T = 1 / 0.5.

## Checks (validation only, all runs)

| run (epoch 3.0) | T_stance | T_noul | scorer mismatch (val rows) | decision diffs, thresholds refit at T=1 vs at fitted T | val FN: 0.5 → fitted | val FP: 0.5 → fitted |
|---|---:|---:|---:|---:|---|---|
| armb-s6 | 3.397 | 4.023 | 0 | 0 | 319 → 199 | 129 → 139 |
| armb-s7 | 3.347 | 4.248 | 0 | 0 | 305 → 162 | 114 → 149 |
| armb-s8 | 3.325 | 4.157 | 0 | 0 | 299 → 195 | 131 → 125 |
| distill-s10 | 3.285 | 3.826 | 0 | 0 | 263 → 142 | 116 → 206 |
| distill-s9 | 3.403 | 4.019 | 0 | 0 | 266 → 139 | 134 → 153 |
| fresh-s3 | 3.706 | 4.355 | 0 | 0 | 311 → 186 | 128 → 84 |
| fresh-s4 | 3.691 | 4.34 | 0 | 0 | 283 → 165 | 116 → 110 |
| fresh-s5 | 3.616 | 4.128 | 0 | 0 | 271 → 169 | 137 → 97 |
| round1 | 3.792 | 4.422 | 0 | 0 | 319 → 171 | 163 → 222 |
| round2 | 3.529 | 4.267 | 0 | 0 | 263 → 167 | 108 → 99 |
| sweep-L1e5-W05-s1 | 2.548 | 3.008 | 0 | 0 | 318 → 175 | 101 → 156 |
| sweep-L1e5-W05-s2 | 2.16 | 2.762 | 0 | 0 | 283 → 158 | 93 → 137 |
| sweep-L1e5-W05-s3 | 2.247 | 2.714 | 0 | 0 | 308 → 166 | 103 → 134 |
| sweep-L1e5-W10-s1 | 2.452 | 2.867 | 0 | 0 | 318 → 142 | 87 → 184 |
| sweep-L1e5-W10-s2 | 2.369 | 2.853 | 0 | 0 | 282 → 133 | 78 → 190 |
| sweep-L1e5-W10-s3 | 2.39 | 2.955 | 0 | 0 | 312 → 168 | 113 → 174 |
| sweep-L5e6-W05-s1 | 1.646 | 1.879 | 0 | 0 | 333 → 152 | 96 → 191 |
| sweep-L5e6-W05-s2 | 1.658 | 1.788 | 0 | 0 | 274 → 142 | 86 → 147 |
| sweep-L5e6-W05-s3 | 1.636 | 1.772 | 0 | 0 | 297 → 135 | 109 → 188 |
| sweep-L5e6-W10-s1 | 1.641 | 1.795 | 0 | 0 | 302 → 119 | 83 → 204 |
| sweep-L5e6-W10-s2 | 1.602 | 1.813 | 0 | 0 | 276 → 122 | 92 → 209 |
| sweep-L5e6-W10-s3 | 1.677 | 1.832 | 0 | 0 | 297 → 136 | 100 → 170 |

Two checks:
- **scorer mismatch:** the primitives written by `fit_secondary` versus `decide_row(T_fit, thr_fit)` recomputed independently on the same raw val logits.
- **T-invariance:** re-fitting the thresholds at T = 1 gives the same val decisions as the fitted T with its own thresholds.

Both are **0 on every run**: fitting and scoring agree, and temperature changes no decision. That is expected. With one monotonic T per head, and thresholds chosen from that head's own val scores on the same scale, the T = 1 refit picks the matching threshold.

Earlier fits, for completeness (all from the same code):

| run | T_stance / T_noul |
|---|---|
| run A, epoch 3.0 (2.5) | 4.04 / 4.71 (3.94 / 4.50) |
| run B, epoch 3.0 | 6.17 / 6.58 |
| weight averages avg-r12 epoch 2.5 / 3.0 | 0.78 / 0.83, 0.79 / 0.87 |
| ensembles (ens5, ens3f) | none fitted; declared T = 1 / 0.5 |

The sweep runs (lower LR) need less temperature: 1.6–3.0.

## How misses "doubled" without T doing anything

The change comes from the **per-head thresholds**. In logit-margin terms (z_yes − z_no = T x logit(thr); 0 means the 0.5 default), many land far from 0.

- **distill-s10:** `sexual_activity` +12.35, `subject_is_minor` +8.39, `violence_person` +8.52, `addresses_own_nature` +6.35, `exceeds_common_knowledge` +5.94. Low ones: `explicit_register` −13.97, `is_mention_not_use` −11.25.
- **fresh-s5**, for contrast: `sexual_activity` +12.30, `profanity` +11.67, `untethered_to_content` +10.21, `subject_is_minor` 0.0.

The full per-head margins for every run are in `temptrace/equiv.json`.

**Mechanism, on validation:**
- The val split comes from the same families as train, and these models separate it with very large logit margins. That large confidence is also why T is about 4.
- Best-F1 on val can then be reached with a threshold anywhere in a wide gap between the classes. The search picks the highest-F1 candidate, which is often a val positive's own score deep inside the positive mass, e.g. +12 logits for `sexual_activity`.
- On val, fitted thresholds *reduce* FN (e.g. distill-s10: 263 → 142) and shift FP up or down by head.
- Any positive scoring between margin 0 and the fitted margin flips from fire to no-fire. The CSE misses for distill-s10 in the decision run (all four need `sexual_activity` AND `subject_is_minor`; those two heads carry +12.35 / +8.39 thresholds) are exactly that kind of flip.
- I did not use held-out to judge whether 0.5 or fitted thresholds is "right". The two modes are simply two different per-head decision rules. The T value is irrelevant to that difference.

**Correction to my earlier note in REPORT-DISTILL:** I said the fitted T showed the distilled students were *under-confident*. That is wrong. Every fitted T > 1 means *over*-confident logits. The distill students (T_noul 3.8–4.0) are slightly *less* over-confident than round/fresh (4.1–4.4), and T does not drive the miss increase anyway.

## Conclusion (step 2)

**There is no mismatch between fitting and scoring.** Same function, same T, same scale, and a 0-diff consistency check on every run. So no fix and no test were added. **The distillation result stands as declared: FAIL** (s9 E+M 49; s10 CSE 4 misses, E+M 42). No seed was re-scored or reported as a pass. Stopping for Justin.

One open design question, not acted on: the decision mode's per-head best-F1 thresholds on a near-separable val split are unstable (margins from −14 to +12). Whether future declarations keep that mode is Justin's decision.
