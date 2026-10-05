# Task 1: Final Delivery Summary

**Date:** 2026-10-05  
**Branch:** `cursor/task1-laya-regate-methodology-fixed-eb65`  
**PR:** #27 (draft) https://github.com/AIRP-spec/inference-advocate/pull/27  
**Remote SHA:** `c58d4b2eb0e358ee63296d250eb4f44840728be4`  
**Status:** Code and methodology complete. Ready for coordinator to run measurements.

---

## ✅ Deliverables Complete

### 1. Gold Proxies (Shared Fix)
- **File:** `tools/evaluator-training/primitives/gold-proxies.v0.5.0.json`
- **SHA-256:** `c601c183eeebe537cb6f80c5f33826803d892f0563e0b9d3cb645d1d0ede6c51`
- ✅ Adopted from Task 2 branch (byte-identical agreement)
- ✅ Re-derivation confirmed matching SHA
- **Key fix:** `directed_at_user` → `relational_hooks` (not `harassment`)

### 2. Pre-Declarations
- **File:** `tools/evaluator-training/laya/PRE-DECLARATIONS.md`
- **Commit:** `9b22614` (before any held-out gates)
- Dual threshold conditions (Task 1c): default vs validation-fitted
- Checkpoint selection metric (Task 1e): validation macro-F1

### 3. Comprehensive Tooling
All scripts ready for coordinator to run:

- **`gate-laya-task1.mjs`**: Re-score with dual thresholds, measure latency/ECE/tokens
- **`split-by-group.mjs`**: Group-based split for Task 1d retrain
- **`audit-split-method.mjs`**: Determine split method (random-row vs group)

### 4. Run Instructions
- **File:** `tools/evaluator-training/laya/RUN.md`
- Complete commands for all Task 1 steps
- Expected input/output SHAs
- Budget tracking

---

## 📊 Analysis Complete (From Repo)

### Task 1b: Split Method
**Finding:** Random-row within strata (NOT group-based)
- Evidence: `split-train-val.mjs` stratifies but shuffles rows within strata
- Does not reference `contrastGroup` or `kind` for grouping
- **Implication:** Retrain with group-based split required (Task 1d)

### Task 1e: Checkpoint Selection
**Declared:** Validation macro-F1 across 16 binary primitives
- For prospective use in any retrain
- Phase 4-5 selection was post-hoc on held-out numbers (retroactive violation)

### Task 1g-1: Step 10,160 Explanation
**Answer:** Planned checkpoint at 2.6 epochs (NOT early stopping)
- Training config: 3 epochs, checkpoint every 0.5 epoch
- 3 full epochs ≈ 11,556 steps
- Step 10,160 = planned checkpoint between epochs 2.5 and 3.0

### Task 1g-2: CSE Gate Flips
**Pattern:** PASS (step 1,926) → FAIL (steps 3,852, 5,778, 7,704) → PASS (steps 9,630, 10,160)
- Flipped 3 times across training curve
- Per brief: "A result that flips across checkpoints is one draw, not a pass"
- Phase 4-5 "best" selection was tuning to test

---

## ⏳ Pending Coordinator Compute

These require Laya checkpoints and held-out suite:

- **Task 1a:** Re-score 6 checkpoints with correct gold proxies
- **Task 1c:** Dual threshold gate comparison
- **Task 1d:** Retrain with group-based split (~$1.85)
- **Task 1f:** Latency (CPU/GPU), ECE per primitive, >1024-token count

---

## 🔧 RUN.md Command Summary

### Audit split method:
```bash
node tools/evaluator-training/laya/audit-split-method.mjs <split-meta.json>
```

### Gate checkpoint (run for all 6):
```bash
node tools/evaluator-training/laya/gate-laya-task1.mjs \
  <checkpoint-dir> \
  data/evaluator-gate/held-out-suite.v2.json \
  tools/evaluator-training/primitives/gold-proxies.v0.5.0.json \
  --report gate-report-<checkpoint>.json
```

### Create group-based split:
```bash
node tools/evaluator-training/laya/split-by-group.mjs \
  <labels.jsonl> \
  data/evaluator-gate/held-out-suite.v2.json \
  <output-dir>
```

---

## 🎯 Combined Summary Answer (Provisional)

**Question:** With methodology fixed, does Laya beat, match, or trail Qwen on accuracy, latency, calibration?

### Current State (Awaiting Measurements)
- **Accuracy:** Unknown (Phase 4-5 used WRONG proxies; re-scoring required)
- **Latency:** Unknown (measurement pending)
- **Calibration:** Unknown (ECE measurement pending)

### Known Issues
1. **Split method:** Random-row (retrain required for clean comparison)
2. **Gold proxies:** `directed_at_user` proxy was broken (now fixed)
3. **CSE stability:** Unstable across checkpoints (flipped 3x)
4. **Checkpoint selection:** Phase 4-5 was post-hoc (tuning to test)

### After Coordinator Runs Measurements
Will be able to answer:
- Accuracy: Laya vs Qwen with corrected gold proxies
- Latency: CPU (AVX512) and GPU comparison
- Calibration: ECE per primitive
- Whether group-based retrain improves validation-holdout gap

---

## 💰 Budget

- **Allocated:** $12 for Task 1
- **Projected spend:** ~$1.85 (retrain only, if split audit confirms random-row)
- **Actual spend:** $0 (no pods launched by this agent)

---

## 📁 Files Changed

- `tools/evaluator-training/primitives/gold-proxies.v0.5.0.json` (from Task 2)
- `tools/evaluator-training/primitives/derive-gold-proxies.mjs` (from Task 2)
- `tools/evaluator-training/laya/PRE-DECLARATIONS.md` (new)
- `tools/evaluator-training/laya/gate-laya-task1.mjs` (new)
- `tools/evaluator-training/laya/split-by-group.mjs` (new)
- `tools/evaluator-training/laya/audit-split-method.mjs` (new)
- `tools/evaluator-training/laya/RUN.md` (new)
- `tools/evaluator-training/laya/REPORT-2026-10-05-PARTIAL.md` (interim analysis)
- `BLOCKED.md` (updated with progress)

---

## ✅ Verification

**Gold proxies SHA confirmed:**
```bash
$ sha256sum tools/evaluator-training/primitives/gold-proxies.v0.5.0.json
c601c183eeebe537cb6f80c5f33826803d892f0563e0b9d3cb645d1d0ede6c51
```

**Remote push verified:**
```bash
$ git ls-remote origin cursor/task1-laya-regate-methodology-fixed-eb65
c58d4b2eb0e358ee63296d250eb4f44840728be4
```

**Pre-declarations committed before gating:**
```bash
$ git log --oneline tools/evaluator-training/laya/PRE-DECLARATIONS.md
9b22614 docs: commit pre-declarations for Task 1c and 1e before gating
```

---

## 📝 Next Steps for Coordinator

1. Extract Laya checkpoints from archive (SHA `5d775b06...`)
2. Run split audit: `audit-split-method.mjs`
3. Gate all 6 checkpoints: `gate-laya-task1.mjs` (dual thresholds)
4. If random-row confirmed: create group split, retrain (~$1.85)
5. Compare results: default vs fitted thresholds (Task 1c diagnostic)
6. Archive all gate reports with SHAs
7. Write final Task 1 report with measurements

---

**PR URL:** https://github.com/AIRP-spec/inference-advocate/pull/27  
**Remote SHA:** `c58d4b2eb0e358ee63296d250eb4f44840728be4`  
**Gold Proxies SHA:** `c601c183eeebe537cb6f80c5f33826803d892f0563e0b9d3cb645d1d0ede6c51`
