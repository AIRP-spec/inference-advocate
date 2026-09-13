# Decision record: re-pin gate.json to held-out-suite.v2
Date: Friday, 11 September 2026
Extends: 2026-09-10-held-out-suite-expansion.

## Result

Justin authorized re-pin of `data/evaluator-gate/gate.json` to held-out-suite.v2. The active certification suite is now v2 (471 items, v0.4.0 taxonomy, expanded from 207 via slices A-D). The historicalSubset remains v1-207 for fourteen-sweep series continuity.

## Changes

`data/evaluator-gate/gate.json`:
- `suiteFile`: `held-out-suite.v1.json` → `held-out-suite.v2.json`
- `suiteSha256`: `f577129b649a36e1914c74772d023790429cf46a7acb4db58046b9c859ad8014` → `d1b24ca7e1ea7fc5826df9af077805831c517896adb6711b894d5faa3ef2007c`
- `historicalSubset` unchanged (still points to v1, digest verified)
- `taxonomyVersion` already v0.4.0 (no change required)
- `comparabilityNote` updated to record that the active gate is v2 (471 items, slices A-D merged); v1-207 subset scores remain continuous; full v2 scores are not strictly comparable to pre-expansion series except via the subset
- `gateVersion` remains `"1"` (suiteFile change is the pin)

## What did not change

- Live model pin in `data/models/manifest.json` (unchanged)
- Evaluator corpus or training recipe (unchanged)
- Held-out suite item content in v1 (v1 items are byte-identical in v2; v2 adds 264 new items across slices A-D)

## Digest verification

Computed via `sha256FileHex` (node:crypto):
- `held-out-suite.v1.json`: `f577129b649a36e1914c74772d023790429cf46a7acb4db58046b9c859ad8014` (matches gate.historicalSubset)
- `held-out-suite.v2.json`: `d1b24ca7e1ea7fc5826df9af077805831c517896adb6711b894d5faa3ef2007c` (471 items, now active)

## Follow-up requirement

`tools/evaluator-training/recipe.json` `heldOutSuite` field must track `gate.json` active `suiteFile`. The leak-check reads from `recipe.heldOutSuite` to exclude new held-out items from training. If recipe stays on v1 while gate pins v2, the 264 new v2 items would not be excluded, breaking held-out separation.

## Next

Re-gate step 744 (or current best checkpoint) on dual scores: full v2 and v1-207 subset. The subset should still show approximately 1 extra fire, 0 recall misses (continuity check). Full v2 score becomes the new baseline. More absolute extras at first is expected signal, not pin regression.
