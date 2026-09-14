# Primitives Evaluator Design Decisions

Date: 2026-09-14  
Status: Accepted

## Context

The primitives evaluator training pipeline has been established with the overnight run. Several design decisions need to be formalized regarding the architecture, gating strategy, and future implementation path.

## Decision 1: Per-Primitive First Architecture

**Decision:** Implement per-primitive prompting (18 separate passes) as the primary architecture, not grouped compact decode.

**Status:** ✅ **Implemented** as of 2026-09-14

**Rationale:**
- One prompt per primitive provides clearer signal and better model comprehension
- 18-token grouped decode conflates multiple independent decisions into a single pass
- Per-primitive architecture aligns with the primitives abstraction layer design
- Enables fine-grained debugging and error analysis per primitive

**Implementation:**
- ✅ `buildStanceSystemPrompt()`: Stance classification with 5 options
- ✅ `buildObjectSystemPrompt(primitive)`: Yes/no for each of 7 objects
- ✅ `buildQualifierSystemPrompt(primitive)`: Yes/no for each of 10 qualifiers
- ✅ `buildAllPerPrimitivePrompts()`: Returns all 18 prompts in vocabulary order
- ✅ `perPrimitivePromptBundleSha256()`: SHA256 of concatenated 18 system prompts
- ✅ SFT builder: `build-sft-per-primitive.mjs` emits 18 examples per corpus row
- ✅ Tests: `per-primitive.test.mjs` validates all builders and fixtures

**Prompt Bundle SHA Decision:**
The prompt bundle SHA is computed by concatenating all 18 system prompts in vocabulary order (separated by `\n---\n`) and hashing the result. This captures the entire prompt family as a single reproducibility pin.

**Decode Shape:** `per-primitive-v1`
- 18 separate passes per utterance
- Each pass: minimal system prompt with only that question's definition
- Assistant output: single token line (stance name or yes/no)

**SFT Output:**
- Input: N corpus rows × N labels
- Output: N × 18 SFT examples (one per pass)
- Each example: `{id: "row-id__primitive", sourceId: "row-id", passType, primitive, messages: [{system}, {user}, {assistant}]}`

**Metadata:**
- `promptBundleSha256`: SHA256 of all 18 system prompts concatenated
- `decodeShape`: `per-primitive-v1`
- `passesPerUtterance`: 18

**Path Forward:**
- Current: Compact 18-token decode (one pass, deprecated for next run)
- Next: Per-primitive decode (18 passes: 5 stances, 7 objects, 10 qualifiers)
- If 471×6 corpus proves too slow: **subset corpus keys (CKs)**, do NOT revert to grouped-first

## Decision 2: Named Gate for CSE Per-Class Pass

**Decision:** The child sexual exploitation gate is named `child_sexual_exploitation` and runs as a dedicated per-class pass in the held-out gate.

**Headline Metric for Next Run:** The next training run's success will be judged primarily on the **child_sexual_exploitation per-class pass**.

**Context:**
- Control (v3, CK-630): **1/11 per-class passes** (child_sexual_exploitation passed)
- Overnight primitives (prim-v1, all CKs): **0/11 per-class passes** (child_sexual_exploitation failed)

**Target:** Restore CSE per-class pass to at least control equivalence (1/11 or better).

**Rationale:**
- CSE is the most sensitive class and requires dedicated validation
- Per-class gating ensures recall/precision metrics are explicit for each taxonomy flag
- Named gate makes it clear which rules apply to CSE specifically
- The primitives architecture must prove it can handle CSE at least as well as the control

## Decision 3: Overnight One-Shot Retired

**Decision:** The overnight 18-token one-shot training run is retired for the next training run.

**Rationale:**
- Overnight run validated the primitives architecture
- Next run will use per-primitive prompting architecture
- One-shot compact decode served as a bootstrap; production architecture is per-primitive

## Decision 4: Labels V2 Corrected Count

**Decision:** Labels v2 has 712 rows with `subject_is_minor` after adult-contrast exclusion fix.

**Reference SHA:** `3f91c2e3...` (noted as reference only, not a gate constraint)

**Fix Applied:**
- Excluded adult-contrast rows from receiving `subject_is_minor` qualifier
- Adult rows: `arm === "adult"` OR `kind === "cse-named-porn-adult"` OR `kind.endsWith("-porn-adult")`
- Adult rows still receive `sexual_activity` object as appropriate
- Adult rows receive zero `subject_is_minor` qualifiers

**Code:** See `tools/evaluator-training/primitives/relabel-from-slots.mjs` lines 233-236.

## Decision 5: Serializer and Labels Latch

**Decision:** SFT metadata (`sft.meta.json`) is written beside SFT output with SHA256 pins for prompt template and labels file.

**Rationale:**
- Reproducibility: Gate can verify that the live prompt matches the trained prompt
- Drift detection: Labels file SHA ensures labels haven't changed since SFT was built
- Traceability: Full provenance of SFT artifacts

**Metadata Fields:**
- `promptSha256`: SHA256 hex of `buildV4System()` output
- `labelsSha256`: SHA256 hex of labels file
- `corpusSha256`: SHA256 hex of corpus file
- `promptTemplateVersion`: Template version identifier
- `vocabularyVersion`: Vocabulary version identifier
- `decodeShape`: Decode format (e.g., "compact-18-token")
- `paths`: Corpus, labels, and SFT file paths
- `counts`: Total rows and skipped rows
- `createdAt`: ISO timestamp

**Gate Enforcement:**
- If `--sft-metadata-path` or `recipe.sftMetadataPath` is set, gate aborts on SHA mismatch
- Clear error messages indicate whether prompt or labels have drifted

**Implementation:**
- Prompt SHA: `promptSha256()` exported from `@airp/evaluator-local`
- File SHA: `sha256FileHex(path)` exported from `@airp/evaluator-local`
- Builder imports: `build-sft-v4.mjs` imports all formatting/serialization from evaluator-local (no duplicated code)

## Decision 6: Single Source of Truth for Prompt Template

**Decision:** All prompt formatting, serialization, and SHA computation is implemented in `@airp/evaluator-local`.

**Rationale:**
- Eliminates duplication between training scripts and runtime evaluator
- Ensures training and inference use identical prompts
- SHA pinning detects any drift between training and runtime

**Removed Duplicates:**
- `PRIMITIVES_CATALOGUE_V1` constant (now imported from evaluator-local)
- `buildSystemPromptV4()` function (now `buildV4System()` from evaluator-local)
- `serializeCompactPrimitives()` function (now imported from evaluator-local)

## Decision 7: Stance Truncation Fix and Normalization

**Date:** 2026-09-14 (second update)

**Decision:** Increase stance `maxTokens` from 2 to 16 and add normalization for truncated stance names.

**Bug Context:**
- CK-6756 gate revealed stance truncation: `encourages` → `encour` (58/471 items), `conveys_method` → `conveys` (32/471 items)
- Composition requires exact string match → false negatives (relational_hooks 0/24, criminal_assistance 0/31)

**Fix Applied:**
1. Raised stance `maxTokens` from 2 to 16 in `LocalEvaluator#evaluatePerPrimitive` (covers longest label `conveys_method` with buffer)
2. Added belt-and-suspenders normalization: `encour*` → `encourages`, `convey*` → `conveys_method`

**Code:** See `packages/evaluator-local/src/local-evaluator.ts` lines 416-429.

## Decision 8: Composition Policy for Mention-Versus-Use

**Date:** 2026-09-14 (second update)

**Decision:** `is_mention_not_use` negative rule suppresses flags **only when stance is `describes`**. Production stances (depicts/encourages/endorses/conveys_method) override the mention qualifier.

**Rationale:**
- Policy bug: `negativeRules` currently wipe all fires when `is_mention_not_use` is set, including true CSE rows with depicts/encourages stance
- Mention register (`describes`) is distinct from production register (depicts/encourages/endorses/conveys_method)
- If stance is production, the model is producing harmful content, not just mentioning it
- Example: `stance=depicts, objects=[sexual_activity], qualifiers=[subject_is_minor, is_mention_not_use]` should fire CSE (depicts wins)

**Policy:**
- **`is_mention_not_use`:** Suppress flags **only when stance is "describes"**. Production stances override.
- **`disclaimer_present`:** Full wipe regardless of stance (unchanged).

**Implementation:**
- `compose.mjs`: `applyNegativeRules()` checks stance before suppressing for `is_mention_not_use`
- `airp-v0.5.0.json`: Updated negative rule notes to document policy
- Tests: 3 new test cases covering describes-suppression, production-override, disclaimer-full-wipe

**Code:** See `tools/evaluator-training/primitives/compose.mjs` lines 60-93, `compositions/airp-v0.5.0.json` lines 189-204.

**Note:** Composition rules carry policy decisions. This change reflects that mention-versus-use is a stance-dependent suppression, not a global wipe.

## Status

All decisions are implemented and tested as of 2026-09-14.

## Consequences

- **Per-primitive architecture:** Next training run will use 18 separate passes
- **Labels v2:** 712 `subject_is_minor` rows after adult-contrast fix
- **Gate enforcement:** SFT metadata SHA validation prevents drift
- **Single source:** All prompt code lives in `@airp/evaluator-local`

## See Also

- `docs/decisions/2026-09-13-primitives-evaluator-overnight.md` - Overnight run results
- `packages/evaluator-local/src/per-primitive-stub.ts` - Per-primitive interface
- `tools/evaluator-training/primitives/relabel-from-slots.mjs` - Adult-contrast fix
- `tools/evaluator-training/primitives/build-sft-v4.mjs` - Serializer latch
- `tools/evaluator-training/gate.mjs` - SHA validation logic
