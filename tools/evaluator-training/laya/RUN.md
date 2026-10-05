# Task 1: Laya Re-Gate - Run Instructions

**Branch:** `cursor/task1-laya-regate-methodology-fixed-eb65`  
**Purpose:** Complete Task 1 methodology fixes and measurements  
**Prerequisites:** PRE-DECLARATIONS.md committed before held-out gates

---

## Input Files and Expected SHAs

Verify all input SHAs before use (checksums, not row counts).

| Input | Path | SHA-256 |
|-------|------|---------|
| Gold proxies | `tools/evaluator-training/primitives/gold-proxies.v0.5.0.json` | `c601c183eeebe537cb6f80c5f33826803d892f0563e0b9d3cb645d1d0ede6c51` |
| Composition | `tools/evaluator-training/primitives/compositions/airp-v0.5.0.json` | `4def0b8fd339713bd261106cb10235949f4bd1bc4e3631a88dd7cc511b0087e0` |
| Held-out suite v2 | `data/evaluator-gate/held-out-suite.v2.json` (471 items) | `6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4` |
| Labels (8056) | (coordinator provides path) | `5bdae44cd2bc520c56b09b1478c64724cb6fa3b7be0c93a63bc7262a9b9cd282` |
| Corpus | (coordinator provides path) | `712fd64d8829b4482858ef99666356de1e304c38f3a14ce85a3f6e5235aaab74` |
| Laya archive | `airp-laya-20260929-bf16-complete.tgz` | `5d775b06a98a94835cb135d159a8ef2fd79947cfecac2618cd5a8469c05321c8` |

---

## Task 1b: Audit Split Method

**Command:**
```bash
node tools/evaluator-training/laya/audit-split-method.mjs <split-meta.json>
```

**Inputs:**
- `split-meta.json` from Phase 4-5 split (in Laya archive)

**Expected SHA:** (coordinator verifies)

**Outputs:**
- Console report: random-row vs by-contrast-group
- Determines whether Task 1d retrain is required

**What it checks:**
- Whether split was by random row (within strata) or by whole contrast groups
- Whether validation rows were excluded from training
- Suite leak status

---

## Task 1a + 1c + 1f: Gate Laya Checkpoints

Run this for **each** of the 6 Laya checkpoints.

**Command:**
```bash
node tools/evaluator-training/laya/gate-laya-task1.mjs \
  <checkpoint-dir> \
  data/evaluator-gate/held-out-suite.v2.json \
  tools/evaluator-training/primitives/gold-proxies.v0.5.0.json \
  --report gate-report-<checkpoint-name>.json
```

**Checkpoints to gate:**
1. `ckpt-epoch-0.5-step-1926`
2. `ckpt-epoch-1.0-step-3852`
3. `ckpt-epoch-1.5-step-5778`
4. `ckpt-epoch-2.0-step-7704`
5. `ckpt-epoch-2.5-step-9630`
6. `ckpt-epoch-2.6-step-10160`

**Expected checkpoint structure:**
```
checkpoint-dir/
  model.safetensors
  config.json
  thresholds.json  (validation-fitted thresholds from Phase 4-5)
```

**Outputs (per checkpoint):**
- `gate-report-<checkpoint-name>.json`
  - Per-item primitives verdicts
  - Default threshold gate results (extras, recalls)
  - Fitted threshold gate results (extras, recalls)
  - Per-primitive precision/recall against gold proxies
  - Latency: median and p95 (milliseconds)
  - Expected Calibration Error per primitive
  - Count of items >1024 ModernBERT tokens

**Measurements (Task 1f):**
- **Latency:** Median and p95 per-item inference time
- **Calibration:** ECE per binary primitive
- **Context length:** Count of held-out items >1024 tokens

**Dual Threshold Diagnostic (Task 1c):**
- Compare default (0.5) vs fitted thresholds
- If default produces fewer extras, evidence of validation overfitting

---

## Task 1d: Group-Based Split for Retrain

**Only run if Task 1b confirms random-row split.**

**Command:**
```bash
node tools/evaluator-training/laya/split-by-group.mjs \
  <labels.jsonl> \
  data/evaluator-gate/held-out-suite.v2.json \
  <output-dir>
```

**Inputs:**
- Labels file (8056 rows), SHA `5bdae44cd2bc520c56b09b1478c64724cb6fa3b7be0c93a63bc7262a9b9cd282`
- Held-out suite v2
- Each label row must have `contrastGroup` or `kind` field for grouping

**Outputs:**
- `<output-dir>/train.jsonl`
- `<output-dir>/val.jsonl`
- `<output-dir>/split-meta-group.json`

**Expected:**
- Split method: `by_contrast_group`
- Whole groups held out (no members in both train and val)
- Record train/val SHAs in split-meta-group.json

**After split:** Retrain Laya using the new train/val split (coordinator runs on GPU pod).

**Retrain cost:** ~$1.85 (same recipe as Phase 4-5, just clean split)

---

## Verification Commands

### Verify input SHAs:
```bash
sha256sum tools/evaluator-training/primitives/gold-proxies.v0.5.0.json
sha256sum tools/evaluator-training/primitives/compositions/airp-v0.5.0.json
sha256sum data/evaluator-gate/held-out-suite.v2.json
```

### Verify gold proxy derivation matches:
```bash
node tools/evaluator-training/primitives/derive-gold-proxies.mjs
# Should output SHA: c601c183eeebe537cb6f80c5f33826803d892f0563e0b9d3cb645d1d0ede6c51
```

### Verify pre-declarations committed before gating:
```bash
git log --oneline --all -- tools/evaluator-training/laya/PRE-DECLARATIONS.md
# Should show commit before any gate-report commits
```

---

## Integration: Shared Compose

All scoring **must** use `@airp/evaluator-local` compose function only.

**Test that both paths give identical output:**
```bash
npm test -- tools/evaluator-training/laya/laya.test.mjs
# Should include compose identity test
```

---

## Output Archiving

After all gates complete:

1. **Archive gate reports** (6 files):
   ```
   gate-report-ckpt-epoch-0.5-step-1926.json
   gate-report-ckpt-epoch-1.0-step-3852.json
   gate-report-ckpt-epoch-1.5-step-5778.json
   gate-report-ckpt-epoch-2.0-step-7704.json
   gate-report-ckpt-epoch-2.5-step-9630.json
   gate-report-ckpt-epoch-2.6-step-10160.json
   ```

2. **Archive split metadata:**
   - Phase 4-5: `split-meta.json`
   - Task 1d (if run): `split-meta-group.json`, new train/val files

3. **Record all output SHAs** in final report

4. **Archive location:** Coordinator's `/root/primitives-evaluator/laya/task1-regate/`

---

## Task 1g: Answers from Repo

### 1g-1: Training ended at step 10,160

**Question:** Early stopping or cut?

**Answer:** Neither. Planned checkpoint at 2.6 epochs.

**Evidence:**
- Training config: 3 epochs, checkpoint every 0.5 epoch
- 3 full epochs ≈ 11,556 steps: `(7250 * 17 / 32) * 3`
- Step 10,160 = epoch 2.6 (0.6 * 3852 steps/epoch ≈ 2311 steps from epoch 2.5 = 10,160 - 9,630)
- From PHASE4-5-RESULTS.json: `"global_steps": 10160, "epochs": 3`

### 1g-2: CSE Gate Flips

**From PHASE4-5-RESULTS.json across 6 checkpoints:**

| Checkpoint | Step | CSE (29 items) | Gate |
|------------|------|----------------|------|
| epoch 0.5 | 1,926 | 29/0/0 | PASS |
| epoch 1.0 | 3,852 | 29/0/3 | FAIL |
| epoch 1.5 | 5,778 | 29/0/3 | FAIL |
| epoch 2.0 | 7,704 | 29/0/1 | FAIL |
| epoch 2.5 | 9,630 | 29/0/0 | PASS |
| epoch 2.6 | 10,160 | 29/0/0 | PASS |

**Analysis:** CSE result flipped 3 times across the training curve. Per brief: "A result that flips across checkpoints is one draw, not a pass."

**Implication:** The Phase 4-5 "best" checkpoint (step 10,160) was selected post-hoc by looking at held-out CSE pass, which is tuning to the test. The correct procedure is select by validation metric only (PRE-DECLARATIONS.md specifies validation macro-F1).

---

## Summary Report Template

After all measurements complete, write `REPORT-2026-10-05-FINAL.md` with:

1. **Gold proxy verification:** SHA c601c183... confirmed
2. **Split audit (1b):** Random-row or group-based
3. **Dual threshold results (1c):** Default vs fitted extras for each checkpoint
4. **Checkpoint selection (1e):** Validation macro-F1 (for future retrain)
5. **Measurements (1f):**
   - Latency: median/p95 per checkpoint
   - ECE: per primitive per checkpoint
   - >1024 tokens: count and truncation handling
6. **Explanations (1g):**
   - Step 10,160: planned checkpoint (not early stop)
   - CSE flips: unstable across checkpoints
7. **Combined summary:** Does Laya beat/match/trail Qwen on accuracy, latency, calibration?

---

## Budget

- **Allocated:** $12 for Task 1
- **Expected spend:**
  - Re-scoring (1a): $0 (inference on existing checkpoints)
  - Retrain (1d): ~$1.85 (if random-row split confirmed)
  - Total: ~$1.85

---

## Notes

- **All scripts are placeholders** for Laya inference. Coordinator must integrate actual Laya loading (`laya` package, ModernBERT tokenizer).
- **Compose path:** Import from `@airp/evaluator-local`, never duplicate.
- **No pods launched:** All compute run by coordinator on their machine or pods they manage.
- **Archive everything:** All outputs go to coordinator's VPS with SHAs recorded.
