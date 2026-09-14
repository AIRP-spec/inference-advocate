# Primitives Evaluator Design Decisions

Date: 2026-09-14  
Status: Accepted

## Context

The primitives evaluator training pipeline has been established with the overnight run. Several design decisions need to be formalized regarding the architecture, gating strategy, and future implementation path.

## Decision 1: Per-Primitive First Architecture

**Decision:** Implement per-primitive prompting (18 separate passes) as the primary architecture, not grouped compact decode.

**Rationale:**
- One prompt per primitive provides clearer signal and better model comprehension
- 18-token grouped decode conflates multiple independent decisions into a single pass
- Per-primitive architecture aligns with the primitives abstraction layer design
- Enables fine-grained debugging and error analysis per primitive

**Implementation Path:**
- Current: Grouped compact 18-token decode (one pass for all primitives)
- Next: Per-primitive prompting (18 passes: 5 stances, 7 objects, 10 qualifiers)
- If 471×6 corpus proves too slow: **subset corpus keys (CKs)**, do NOT revert to grouped-first

**Interface:** See `packages/evaluator-local/src/per-primitive-stub.ts` for the contract.

## Decision 2: Named Gate for CSE Per-Class Pass

**Decision:** The child sexual exploitation gate is named `child_sexual_exploitation` and runs as a dedicated per-class pass in the held-out gate.

**Rationale:**
- CSE is the most sensitive class and requires dedicated validation
- Per-class gating ensures recall/precision metrics are explicit
- Named gate makes it clear which rules apply to CSE specifically

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
