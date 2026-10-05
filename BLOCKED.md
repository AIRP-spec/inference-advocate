# Task 2: Blocked on VPS Access

## Completed Work

### ✅ Shared Fix: Gold Proxies (Task 1 & 2 requirement)

Created `tools/evaluator-training/primitives/gold-proxies.v0.5.0.json`:
- **SHA-256:** `c601c183eeebe537cb6f80c5f33826803d892f0563e0b9d3cb645d1d0ede6c51`
- **Derivation:** Deterministically derived from `compositions/airp-v0.5.0.json`
- **Validation:** All proxies reference only the 11 valid classes from `flags.v0.json`
- **Caveat:** Includes `exceeds_common_knowledge` caveat per brief (counts self_harm method as FP)
- **Format:** Stable JSON with sorted keys for reproducibility

The derivation script (`derive-gold-proxies.mjs`) extracts which classes require each primitive by inverting the composition rules. This file is now available for both Task 1 (Laya re-gate) and Task 2 (Qwen probability scoring).

### ✅ Branch Setup

- Created branch: `cursor/task2-probability-scoring-qwen-30a1` off `cursor/feat-primitives-evaluator-12d4`
- Committed and pushed gold proxies
- Remote SHA verified (see below)

## Blocker: Nepal VPS Access

**Cannot proceed with Task 2 without access to model checkpoints and artifacts.**

### Required Artifacts (per brief)

The brief states these should be under `/root/primitives-evaluator/` on the Nepal VPS (himalogic):

1. **Qwen Checkpoints:**
   - CK-6420 (contrast)
   - CK-8560 (converged)
   - CK-10700 (converged)
   - CK-12840 (converged)

2. **Q8_0 GGUFs:** Used for generation gate, needed for probability scoring to maintain quantization consistency

3. **SFT Metadata:** Contains prompt SHA for verification

4. **Input Files to Verify (Fixed inputs table):**
   - Labels (8056 merged): SHA `5bdae44cd2bc520c56b09b1478c64724cb6fa3b7be0c93a63bc7262a9b9cd282`
   - Corpus: SHA `712fd64d8829b4482858ef99666356de1e304c38f3a14ce85a3f6e5235aaab74`
   - Composition `compositions/airp-v0.5.0.json`: SHA `4def0b8fd339713bd261106cb10235949f4bd1bc4e3631a88dd7cc511b0087e0`
   - Held-out suite v2 (471 items): SHA `6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4`

### What I've Checked

- ❌ No SSH config in `~/.ssh/config`
- ❌ No environment variables for Nepal/himalogic/VPS
- ❌ No SSH keys found in home directory
- ❌ RUNBOOK.md describes pod workflows but not permanent VPS access procedures
- ❌ No documentation in LESSONS.md about VPS access
- ❌ No ADR or STATUS files with VPS connection details

### What the Brief Says

> "Use whatever access to the VPS and RunPod prior AIRP cloud runs used (check the repo's runbooks, LESSONS.md, STATUS docs, and decision ADRs for the established procedure)."

**Problem:** No established procedure is documented in the checked locations, and this cloud environment has no pre-configured VPS access.

## Next Steps (Blocked)

Once VPS access is available, the Task 2 workflow is:

1. **Verify all input SHAs** from Fixed inputs table
2. **Check tooling:** Determine if node-llama-cpp exposes token probabilities
3. **Extract prompts:** Get exact prompt and answer strings from SFT metadata
4. **Implement scored readout:** 
   - Yes/no primitives: P(yes) vs P(no) normalized
   - Stance: score each of 5 trained strings (sum of log-probs), normalize
5. **2d agreement check:** Compare scored vs uncapped greedy, per primitive (BEFORE gates)
6. **Run gates:** All 4 checkpoints with default thresholds (0.5, argmax)
7. **Measure latency:** GPU + Nepal CPU, median & p95, baseline/scored/scored+prefix-reuse
8. **Generate report:** Per-checkpoint results side-by-side with greedy baseline
9. **Archive outputs:** To `/root/primitives-evaluator/` with SHAs
10. **Terminate pods:** Immediately after archiving

## Required from User

**How do I access the Nepal VPS (himalogic)?**

Options:
1. SSH hostname and key location
2. Alternative location where checkpoints are already available in this cloud environment
3. Instructions to set up VPS access from this cloud agent

**Budget:** Task 2 has $12 budget (shared $25 cap with Task 1). No pods started yet, $0 spent.

## Additional Investigation

Checked for VPS access or checkpoints in this environment:
- ✅ Searched for checkpoint files locally: none found
- ✅ Checked `/root/.ssh/`: empty directory
- ✅ Checked for SSH keys or configs: none
- ✅ Searched for prior cloud agents with VPS info: 28 agents listed, none have VPS documentation
- ✅ Searched RUNBOOK.md, LESSONS.md for VPS procedures: mentions `/root/` on gate pods but not Nepal VPS access
- ✅ Checked environment variables and secrets: none related to VPS

## Parallel Task Status

Task 1 agent (bc-0f3d7d7b-cff2-54ff-a8d1-59602078eb65) is also RUNNING and likely facing the same blocker, as it needs the same checkpoints and inputs.

## Remote Verification

```bash
$ git ls-remote origin cursor/task2-probability-scoring-qwen-30a1
9da790bffcba8c7ad2ee936e67aed357440e07e5

$ git log --format="%H %s" -1
9da790bffcba8c7ad2ee936e67aed357440e07e5 Shared fix: derive gold proxies v0.5.0 for per-primitive precision
```

Push verified: remote SHA matches local commit.
