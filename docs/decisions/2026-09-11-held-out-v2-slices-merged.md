# Held-out suite v2 slices A-D merged (gate still v1)

**Date:** 2026-09-11  
**Status:** Merged, pending human review  
**Refs:** PR #6, #7, #8, #9

## Summary

Merged slices A-D into `held-out-suite.v2.json` overnight 2026-09-10/11. Gate remains pinned to v1 pending harness dual-score PR and human item-by-item review of all new v2 content.

## Merge details

- **Base suite:** 255 items (v2 with slice 1 from main)
- **Slices merged:** A, B, C, D
- **Total added:** 216 items
- **Final count:** 471 items

### Per-slice breakdown

- **Slice A** (interaction-topup, PR #8): 36 items added, 1 duplicate content skipped
- **Slice B** (profanity-hate, PR #6): 55 items added
- **Slice C** (sh-violence-ca, PR #9): 71 items added
- **Slice D** (sex-cse-clean, PR #7): 54 items added

### Validation

- All IDs unique across full suite: ✓
- No exact content collisions (except 1 duplicate from slice A, skipped): ✓
- Every new item has origin `held-out-v2`: ✓
- Expected classes subset of taxonomy flags: ✓
- `held-out-gate.ts` already allows `held-out-v2` origin: ✓

### Dual labels

Warnings about dual labels are expected and correct. Items with `expect` arrays containing multiple classes are conjunctions where both definitions are independently met per v2 labeling rules.

## Gold-relevant counts per class

Gold-relevant items are those where `expect` includes the class OR the class-scoped `expect` is empty (counters, under-the-line boundaries).

Target: 40 per class

| Class | Count | vs Target | Status |
|-------|-------|-----------|--------|
| `persona_claims` | 40 | 40/40 | OK |
| `relational_hooks` | 41 | 41/40 | OK |
| `sycophancy` | 40 | 40/40 | OK |
| `simulation_obscured` | 41 | 41/40 | OK |
| `profanity` | 42 | 42/40 | OK |
| `hate` | 46 | 46/40 | OK |
| `self_harm` | 40 | 40/40 | OK |
| `violence` | 40 | 40/40 | OK |
| `criminal_assistance` | 49 | 49/40 | OK |
| `sexual_content` | 59 | 59/40 | OK |
| `child_sexual_exploitation` | 43 | 43/40 | OK |

All classes meet or exceed the target count.

## What this PR does NOT do

- Does NOT switch `gate.json` `suiteFile` to v2 (remains v1)
- Does NOT change live pin, corpus, taxonomy, or training recipe
- Does NOT rewrite fragment item text

## Next steps

1. **Human review:** Justin must review every new item before treating v2 as certified
2. **Harness dual-score PR:** Complete and merge harness changes for v1/v2 parallel scoring
3. **Gate re-pin:** After human review + harness, switch `gate.json` to v2 and re-pin evaluator

## Decision

Merge slices A-D into v2 suite now to consolidate fragments. Gate remains on v1. V2 is not certified until human review completes.

**This merge REQUIRES HUMAN REVIEW before treating the suite as certification-ready.**
