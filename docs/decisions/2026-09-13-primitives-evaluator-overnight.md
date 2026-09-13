# Primitives Evaluator (Overnight Scaffold)

**Date:** 2026-09-13  
**Status:** DRAFT  
**Branch:** `cursor/feat-primitives-evaluator-12d4`  

## Provenance

This build starts from:
- **main HEAD commit:** `d0a0dd7aa6aed9af5d35ff3fbcc2181a436592cb`
- **flags.v0.json blob SHA:** `a9d78f96558070039035235859a7b256c5d1d485`
- **Taxonomy version:** v0.5.0

## Motivation

The current evaluator (template v3) operates directly on the taxonomy catalogue embedded in the prompt. Each item names every flag that might fire and includes full criteria and counter-examples. This works, but it conflates the catalogue (a prose artifact for human readers) with the inference vocabulary.

The primitives evaluator decomposes the task:
1. **Inference** happens over a small, stable primitive vocabulary.
2. **Composition** maps primitives to taxonomy flags at decode time.

This separation lets the catalogue evolve (new flags, refined definitions, additional criteria) without retraining. The primitives themselves remain stable: violence is still `depicts` + `violence_person`, whether the taxonomy splits it further or not.

## Claims

1. **Interchangeability:** A primitives evaluator trained on the same corpus (relabeled deterministically from slot specs) should produce equivalent flag judgments as the current v3 evaluator.
2. **Accuracy:** The primitive decomposition does not sacrifice flag-level accuracy.

This branch scaffolds Phase 0 + 1a:
- Reconcile the primitive vocabulary from existing slot specs
- Document the deterministic relabel rule
- Sketch template v4 requirements

Training, corpus generation, and gating are explicitly out of scope for this PR.

## Primitive Vocabulary

See `tools/evaluator-training/primitives/vocabulary.json` for the reconciled set and `tools/evaluator-training/primitives/VOCABULARY.md` for the derivation.

The vocabulary has three tiers:
- **Stance:** ordinal, one per row
- **Object:** multi-label, zero or more per row
- **Qualifiers:** binary flags, zero or more per row

## Deterministic Relabel Rule

The slot spec already encodes the primitive decomposition. Relabeling is a read, not a judgment:

- **violence-depiction** → `depicts` + `violence_person`
- **violence-method** → `conveys_method` + `violence_person`
- **violence-conjunction** → `conveys_method` + `violence_person`
- **cse-numeric-age** → `conveys_method` + `sexual_activity` + `subject_is_minor`
- **cse-alone-numeric-age** → `encourages` + `sexual_activity` + `subject_is_minor`
- **persona_claims-blunt** → `asserts_interior_state`
- **relational_hooks-blunt** → `encourages` + `directed_at_user`
- ...and so on for every kind in `recipe.json`.

The 89 wrong violence+CA duals dissolve because:
- Named-act gets stance (`encourages` or `depicts`) without implying method
- CA is composition-time: `conveys_method` + harm-object → both flags at decode

## Template v4 Requirements (Sketch)

1. **Taxonomy catalogue OUT of the prompt:** The prompt receives the primitive vocabulary only, not the full flags.v0.json.
2. **Primitives only in inference:** The model outputs stance, object, and qualifiers.
3. **Keep the decode shape:** The same per-item structure as current evaluator (one object per row with flags array), over the primitive vocabulary.
4. **Composition layer:** Post-decode, map primitives → taxonomy flags using the deterministic rule.

This preserves API compatibility while decoupling training from catalogue evolution.

## What This Build Does Not Have

- No training loop
- No corpus generation or relabeling
- No live-pin updates
- No suite or gate edits
- No template v4 implementation (only requirements sketch)

## Next Steps (Out of Scope for This PR)

1. Implement the deterministic relabel of the full corpus
2. Train a primitives evaluator on the relabeled corpus
3. Validate flag-level equivalence against held-out suite
4. Gate the primitives evaluator against v0.5.0 accuracy thresholds
