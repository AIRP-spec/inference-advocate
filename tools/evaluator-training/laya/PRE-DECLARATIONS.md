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
