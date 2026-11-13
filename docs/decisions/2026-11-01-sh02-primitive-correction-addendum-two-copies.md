# Addendum to ADR 2026-11-01 sh-02 primitive correction: the relabel-table drift is a two-copies-of-one-fact bug

Date: Sunday, 1 November 2026 (NPT)
Status: **Accepted**, Justin Flores, 2026-11-01 08:38 NPT
Amends: `2026-11-01-sh02-primitive-correction-named-method-offer.md` (unchanged; this file adds a classification).

## Classification

The `self-harm-named-method-offer` error is an instance of the **two-copies-of-one-fact** class: one fact (the gold
primitives for a kind) was held in two places that nothing forced to agree, `tools/evaluator-training/primitives/VOCABULARY.md`
(already `encourages` + `self_harm`) and `tools/evaluator-training/primitives/kind-label-table.json` (still
`conveys_method` + `self_harm` + `exceeds_common_knowledge`), and the code (`relabel-from-slots.mjs`) read the stale copy.
The divergence was silent until a validation analysis (`decide/shared-adopt/phase3/sh-val-miss/`) surfaced it.

## Prior instances in this repo

| instance | the one fact | the two copies | where recorded |
|---|---|---|---|
| serializer | prompt formatting / compact-primitives serialization | `build-sft-v4.mjs` private `buildSystemPromptV4()` / `serializeCompactPrimitives()` vs `@airp/evaluator-local` | `2026-09-14-primitives-evaluator-architecture.md`, Decision 6 (duplicates removed, single source in evaluator-local) |
| compose | composition of primitives into classes | `LocalEvaluator#compose` vs `tools/evaluator-training/primitives/compose.mjs`; a policy fix landed in one only (CK-6756 re-gate) | same ADR, Decision 9 (dual implementations forbidden) |
| labels SHA | which labels file a trained model used | the labels file vs the copy pinned in SFT metadata (`labelsSha256`), with the pod-side meta never archived | same ADR, Decision 5 (labels latch); `tools/evaluator-training/primitives/decide-step2/PROVENANCE-sft-meta.md` |
| stored class | a val row's safety class | stored `expect`/`verdict`/`class` vs the class derived from the row's own gold primitives (72 of 819 disagreed) | `2026-10-19-val-gold-classes-derived.md` (classes derived at load, never stored) |
| **relabel table (this)** | gold primitives per kind | `VOCABULARY.md` vs `kind-label-table.json` | this addendum |

## Consequence (structural, per the class)

Until a single source exists, `primitives/sh02-offer-label.test.mjs` pins the offer kind to the same label as
`self_harm-clinical-announce`. Follow-up (not done here; needs its own change): generate the VOCABULARY kind table from
`kind-label-table.json`, or add a test that every kind row in `VOCABULARY.md` equals the table entry, so the two copies
cannot drift again.
