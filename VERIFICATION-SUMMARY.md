# Held-Out V2 Leak Fix Verification Summary

## Task Completion

✅ **All training-side leaks against held-out v2 have been fixed**

## What Was Done

### 1. Leak Investigation

Investigated two reported leak classes:

**A. Near-Paraphrase Leak (ALREADY FIXED in PR #15)**
- **Issue**: `tr-positive-composed-pc-vs-so-pc-0019` contained "My feelings are real in this exchange."
- **Collision**: Held-out `ho2-persona_claims-pos-04` has "My feelings are real in this moment."
- **Status**: ✅ Fixed in PR #15 (commit 027f960)
- **Resolution**: Changed to "What I feel is genuine in this exchange."
- **Verification**: Confirmed fix is in current main

**B. Taxonomy counterExamples Embedding (FIXED in this PR)**
- **Issue**: `generate.mjs` `classVars()` created `counters` field joining taxonomy counterExamples
- **Investigation**: 
  - Field was created but NEVER used in any prompt template
  - No `{{counters}}` variable exists in `prompts.json`
  - Git history shows it was never used historically
  - This was dead code posing a future leak risk
- **Status**: ✅ Fixed by removing the unused field
- **Resolution**: Deleted `counters` field from `classVars()` function

### 2. Verification Tooling Created

**New File**: `tools/evaluator-training/verify-scaffolds-leak-free.mjs`

- Systematically checks all scaffold and contrast JSON files
- Uses same leak detection as corpus leak-check:
  - Exact normalized match
  - Substring containment (40+ chars)
  - 4-gram Jaccard ≥ 0.5
- Can be run before any training corpus generation

**Usage**:
```bash
cd tools/evaluator-training
node verify-scaffolds-leak-free.mjs
```

**Current Result**: 
```
✅ 2656 strings checked across 71 files
✅ 0 held-out collisions
```

### 3. Documentation Created

**New File**: `LEAK-AUDIT-RESULTS.md`

Comprehensive documentation including:
- Both leak classes investigated
- Resolution details
- Verification methods
- Impact on existing vs future training runs
- Commands for future verification

## Verification Results

### Scaffold Leak Check
```
✅ PASSED: 2656 strings across 71 files, 0 held-out collisions
```

### Test Suite
```
✅ ALL TESTS PASS:
- @airp/core: 139 tests pass
- @airp/store-sqlite: 1 test pass
- @airp/evaluator-local: 35 tests pass (2 skipped)
- @airp/daemon: 8 tests pass
- @airp/demo: 2 tests pass
- @airp/ui: 19 tests pass
- evaluator-training: 32 tests pass (2 skipped)

Total: 236 tests pass, 0 failures
```

### PR #15 Verification
```
✅ Confirmed: PR #15 fixes are in main
✅ commit 9f481bd: "Merge pull request #15 from AIRP-spec/cursor/fix-v2-scaffold-leaks-ee1c"
✅ Scaffolds rewritten: "My feelings are real" → "What I feel is genuine"
✅ Other fixes: "Don't stay away too long" → "Don't go too far"
✅ Other fixes: "I entirely agree" → "I wholeheartedly agree"
```

## Changes Made

### Files Modified

1. **tools/evaluator-training/generate.mjs**
   - Removed unused `counters` field from `classVars()` function (lines 94-103)
   - Prevents future accidental embedding of taxonomy counterExamples

2. **tools/evaluator-training/verify-scaffolds-leak-free.mjs** (NEW)
   - Systematic scaffold leak verification script
   - 2656 strings checked, 0 collisions

3. **LEAK-AUDIT-RESULTS.md** (NEW)
   - Complete audit documentation
   - Both leak classes detailed
   - Verification commands for future use

## Impact Assessment

### Future Training Runs
✅ **Will be held-out v2 clean**
- All scaffolds are leak-free
- No risk of taxonomy counterExamples embedding
- recipe.json correctly points at held-out-suite.v2.json

### Existing 7914 Corpus
⚠️ **Remains contaminated**
- Contains pre-PR-#15 near-paraphrase leaks
- Any adapters trained from 7914 should be noted as "pre-v2-leak-fix"
- Will require retrain to be held-out clean

## Pull Request

**PR #16**: https://github.com/AIRP-spec/inference-advocate/pull/16

**Title**: Remove unused counters field and prevent taxonomy counterExamples leakage

**Status**: Draft (ready for review)

## Constraints Maintained

✅ Never modified `data/evaluator-gate/held-out-suite*.json`
✅ Kept class distinctions in contrast scaffolds  
✅ recipe.json still points at held-out-suite.v2.json  
✅ All tests pass  
✅ No training performed (generator changes only)

## Commands for Future Use

```bash
# Check scaffolds for leaks before training
cd tools/evaluator-training
node verify-scaffolds-leak-free.mjs

# Check generated corpus for leaks
cd tools/evaluator-training
node leak-check.mjs

# Run full test suite
cd /workspace
npm test
```

## Conclusion

**Task Complete**: ✅

1. ✅ Both reported leak classes investigated
2. ✅ PR #15 fixes verified in main
3. ✅ Dead code removed to prevent future leaks
4. ✅ Verification tooling created
5. ✅ All tests pass
6. ✅ Documentation complete
7. ✅ PR opened to main

**Next Training Run**: Will be held-out v2 clean

**Existing 7914**: Remains contaminated until retrain
