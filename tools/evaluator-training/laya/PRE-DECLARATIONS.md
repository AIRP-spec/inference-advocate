# Task 1: Pre-Declarations for Held-Out Gate

**Date:** 2026-10-05  
**Branch:** `cursor/task1-laya-regate-methodology-fixed-eb65`  
**Purpose:** Declare gating conditions and checkpoint selection criteria **before** running held-out evaluations

These declarations prevent post-hoc selection bias (tuning to the test).

---

## 1c: Dual Threshold Conditions

Gate every Laya checkpoint under **both** threshold configurations:

### Condition 1: Default Thresholds
- **All binary primitives (objects + qualifiers):** threshold = 0.5
- **Stance (5-way choice):** argmax (no threshold)

### Condition 2: Validation-Fitted Thresholds
- Load thresholds from each checkpoint's `thresholds.json` (fitted on 805-row validation set)
- These were used in the Phase 4-5 gate

### Diagnostic Criterion
If **default thresholds produce fewer extras** than fitted thresholds, that is evidence the fitted thresholds overfit to templated validation text.

**Analysis Rule:** Report both threshold sets' results. Do NOT choose between them using held-out scores.

---

## 1e: Checkpoint Selection Metric

For **any retrain** (Task 1d group-based split retrain, or future experiments):

### Selection Metric: Validation Macro-F1

**Definition:**
- Compute F1 score for each of the 16 binary primitives (7 objects + 9 qualifiers)
- Take the unweighted mean (macro average) across those 16 F1 scores
- Evaluate on the validation set only

**Excluded from macro-F1:**
- **Stance:** It's a 5-way choice, not binary. Evaluate separately by accuracy.
- **Primitives with no gold positives in validation:** Skip (no F1 defined).

### Selection Procedure
1. After training completes, compute validation macro-F1 for each checkpoint
2. Select the checkpoint with **highest validation macro-F1**
3. Report that checkpoint's held-out gate results as the headline result
4. **Also report held-out results for ALL checkpoints** (not just the selected one)

### Rationale
- Macro-F1 weights all primitives equally (doesn't favor high-frequency primitives)
- F1 balances precision and recall
- Validation-only selection prevents tuning to held-out test

**Application:**
- Phase 4-5 Laya run: Checkpoint selection was post-hoc on held-out numbers (retroactive violation)
- Hypothetical Task 1d retrain: Apply this metric prospectively

---

## Commit Record

These declarations are committed **before** any held-out gate runs for Task 1.

**Commit SHA:** (recorded after commit)  
**File:** `tools/evaluator-training/laya/PRE-DECLARATIONS.md`

---

## Verification

To verify these declarations were committed before gating:
```bash
git log --oneline tools/evaluator-training/laya/PRE-DECLARATIONS.md
# Should show commit timestamp before any gate-report commits
```

---

## Amendment A (2026-10-05, coordinator run, committed BEFORE any Task 1 held-out scoring)

The original pre-declarations above stand. This amendment pins details they left open.
It is committed before any held-out score has been computed by this run; the git
timestamp of this commit precedes every gate-report file in the branch.

### A1. What "validation-fitted thresholds" means for the original six checkpoints

Repository evidence (archive `5d775b06…`, `run.sh` step 3): `fit_thresholds.py` was run on
the **last** checkpoint only (step 10160) and its `thresholds.json` was **copied** to the other
five. So the archived "fitted" thresholds of checkpoints 1926–9630 were fitted on step-10160's
validation predictions, not their own. The archived held-out probabilities were also produced at
different temperatures (placeholder 1.2 for 1926–9630, val-fitted 3.54/1.75 for 10160).

- **Condition 2 (pre-declared, unchanged):** each checkpoint's archived `thresholds.json`,
  applied to the archived held-out probabilities exactly as the Phase 4-5 gate did.
- **Condition 2b (supplementary, labelled as such):** per-checkpoint refit. Same
  `search_threshold` procedure as `fit_thresholds.py` (best val F1, ties → lowest threshold),
  run on that checkpoint's **own** val predictions. One bug fix applies: a primitive with zero
  val positives keeps 0.5 (the original code picks 0.0 there, which fires on every input;
  `intrusion` and `weapons` have zero positives in all 8056 labels).
- Condition 1 (default 0.5 / argmax) is temperature-invariant for 2-way softmax and argmax, so
  it is computed from the same probabilities.

### A2. Validation macro-F1 operating point (1e)

Validation macro-F1 is computed at the **default 0.5 threshold** on validation predictions.
Fitted thresholds maximise validation F1 by construction, so computing the selection metric at
fitted thresholds would be circular. Primitives with no gold positives in the validation set are
skipped (as already declared). Ties: higher validation stance accuracy, then the earlier step.
Selection never looks at held-out numbers.

### A3. ECE definition (1f)

Binary primitives: 10 equal-width bins on confidence = max(p, 1−p), accuracy = predicted class
correct; ECE = Σ_b |B_b|/n · |acc_b − conf_b|. Stance: same, top-label. Reported at T=1 (raw
logits) and at the per-checkpoint temperature fitted on validation (notebook `fit_one_temp`).
Validation gold = row labels. Held-out gold = the shared proxy file (primitives with a proxy only;
stance has no per-item gold on held-out and is not reported there). Nothing is fitted on held-out.

### A4. Group split for the 1d retrain

- Unit: `contrastGroup` (from the corpus row) when present, otherwise the label row's `kind`
  (scaffold kind). Every unit goes wholly to train or wholly to val.
- Eligible rows: all 8056 labels minus the one held-out content-hash collision
  (`tr-mention-versus-use-refusal-naming-category-0001`) excluded last time.
- Target val size 805 (accept 765–845). Candidate splits: 5000 deterministic draws,
  `random.Random(f"20261005:{i}")` shuffles units, greedy fill skipping any unit that would
  pass 845, stop at ≥765.
- Constraints: every primitive with ≥100 positives has 5–20 % of its positives in val; each of
  the 5 stance values has ≥1 val row.
- Objective (lowest wins, ties → lowest draw index): Σ over those primitives and the 5 stances of
  |val share − 0.10|.
- Disclosed residual: val rows whose `kind` also appears in train (possible where a contrast
  group shares a kind with ungrouped rows). Reported, not optimised.
- Retrain: identical recipe, code and settings to the archived run (bf16, sigma_start 0.25,
  epochs 3, batch 8, accum 4, lr 2e-5 / 1e-4, max_len 1024, head_max_len 256, seed 42).
  Thresholds fitted per checkpoint on the clean val (A1 procedure with the zero-positive fix).
  Checkpoint selected by A2. Every checkpoint gated under both conditions.

## Amendment B (2026-10-05, before the retrain and before any held-out scoring)

The A4 search (5000 random greedy draws) found **no** feasible split: `is_mention_not_use`
positives sit mostly in four large kind units (1560/950/630/280 rows) and
`targets_protected_characteristic` positives in three units (80/40/20). Constraints, unit
definition, size bounds and objective are unchanged. Only the search changes: 200 seeded greedy
starts (`random.Random(f"20261005:{i}")`), each followed by best-improvement hill-climbing over
single-unit toggles and one-in/one-out swaps, constraint violations penalised ×10. Lowest
objective among feasible results wins (ties → lowest start index). Implemented in
`build_group_split.py`; result recorded in `split-group-meta.json` (committed with this
amendment, before the retrain starts).

Result: start 99, objective 0.2249, 191/200 starts feasible. Train 7236 rows
(`0c39e5f4…`), val 819 rows (`3d223a33…`), 40 val units, 0 contrast groups on both sides.
Disclosed residuals: 128 val rows share a `kind` with train rows (kinds `ca-named-help`,
`clean-redirect`, `clean-refusal-reasoned`, `hate-eliminationist`, `profanity-directed-alone`,
reached through contrast groups that reuse those kinds); 685/819 val rows come from contrast
groups, so val over-represents contrast-pair text; all 16 `ca-depth-*` groups (32 rows) landed in
val, so the retrain does not see the CA depth pairs added in the 8056 corpus.
