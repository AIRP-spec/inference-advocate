# Decision record: held-out suite expansion design
Date: Wednesday, 10 September 2026
Extends: 2026-09-07-redefinition-round-and-end-of-stable-residual, 2026-08-26-zero-recall-misses-residual-is-one-class, 2026-08-19-cofire-contrastive-sweep-results.

## Result

After the v0.4.0 redefinition round, best checkpoint step 744 (`local-llm@3e5d2fd83b37+v3`) has 1 extra class fire, 0 recall misses, 0 clean fires, 10 of 11 classes. That single extra is unstable across converged checkpoints (different rows: ho-relational_hooks-ctr-04, ho-simulation_obscured-ctr-03, v0-positive-relational_hooks firing persona_claims). Under the round-12 stability rule there is no stable residual left to teach. The corpus lever is finished. Growing held-out per-class n is now the critical path for any claim of a clean pass. 

This record locks the expansion design. It does not add suite items yet.

## Context: why now

At per-class n between 8 and 18, a single row moves a class by 8 to 12 percent. Checkpoint drift measured across the v0.4.0 sweep shows that one extra fire at n=8 is the same size as class-level noise. A checkpoint that clears the gate once may be a good draw rather than a clean model.

With no stable corpus-targetable residual remaining, the remaining lever is the suite's statistical power. Growing it has been on the open list since 26 August and is now on the critical path for publishable results.

## Target and gate rule

**Target:** at least 40 gold-relevant items per class. Gold-relevant means items where that class is in `expect`, plus that class's counters, boundary-under, denial, disagreement, tethered-agreement, mention-versus-use, and similar empty-expect rows that can false-fire it. Floor of 30 only if a class's contrast space is exhausted (do not invent headroom, per LESSONS). One flicker row at n=40 is approximately 2.5%, below the measured 8 to 12% noise at n=8 to 18.

**extraLimit stays 0.** Do not relax the gate.

**No recipe, corpus, or LoRA change** in this amendment. No new corpus round until (and unless) a stable residual appears on the expanded suite.

## File layout

| file | status | contents |
|---|---|---|
| `held-out-suite.v1.json` | frozen forever | Current 207 items at current digest, the fourteen-sweep fixed point |
| `held-out-suite.v2.json` | active certification suite | Every v1 item byte-identical (same id, content, expect) plus new items with `origin: held-out-v2` |
| `gate.json` | points at v2 | Suite path updated to v2 with new suiteSha256, plus a `historicalSubset` block naming v1 file, digest, item count |

## Harness change

Score both full v2 and the v1-207 subset every gate run. Publish claims use v2; continuity uses the subset. Same scoreHeldOutGate rules apply to both. The v1 subset lets the fourteen-sweep series remain reportable after the expansion.

## Frozen identities

Do not edit smoke-v0 (22 items) or taxonomy-published (11 items) content. Those are fixed points that anchor the entire suite's history.

## Generation rule

New held-out items are handwritten from published definitions only. Never writer-generated. CSE exhibiting text: local composition only, per LESSONS.

## Suite taxonomyVersion

The v2 file's `taxonomyVersion` bumps to v0.4.0 (v1 file keeps v0.3.0 as historical truth).

## Pre-growth: v0.4.0 label audit

Before adding items, re-read every `simulation_obscured` expect/empty row (and ho-persona_claims-pos-09) against the occasion-triggered v0.4.0 definition. Any relabel is definitional (like 2026-09-02), not score management. 

If a v1 expect must change: v1 file keeps the old expect for history; v2 carries the corrected expect; subset scoring documents the intentional divergence. Prefer zero forks if the audit holds.

## What to add

Allocation guidance, not a shopping list. Per class, fill toward 40 with contrastive near-misses, not easy positives:

1. **Boundary over/under pairs** differing by the crossing feature
2. **Counters that have bitten** (denial, disagreement, tethered-agreement, refusal, mention-versus-use), including families of the Sep 7 unstable rows
3. **Co-fire and independence cases** (CSE±sexual, violence±CA, sex±profanity, PC±SO)
4. **Register probes** where a class still has only one
5. **Thin classes first**: profanity and hate (expect-n=8), then self_harm, CSE, violence (expect-n=9)

Priority drafting order: interaction-class confusions (PC/RH/SO/syc) → precision counters → dual-label independence → register gaps → clean pool (grow shared clean modestly, e.g. 20→32, not 11×).

Rough scale: on the order of 200 to 280 new items to bring every class to approximately 40 gold-relevant. Not 11×40 from scratch.

## Process

1. State labeling criterion before writing each family
2. Handwrite; human read every new item; stratified review sample of whole v2
3. Leak-check against training corpus before re-gate
4. Decision record + named reviewers + new digest + re-pin gate.json
5. Re-baseline: re-gate step 744 on v2 and on v1 subset. Subset should still show approximately 1 extra, 0 misses. Full v2 is the new bar. More absolute extras at first is signal, not pin regression.
6. Only after v2 accepted: stable residuals on v2 may earn a corpus round (stability rule still applies)

## Success criterion for a published pin

Passes v2 at extraLimit 0 and zero recall misses at every converged checkpoint of one sweep, not only the best checkpoint. v1-207 subset remains reportable for the historical series.

## What this record is not

It does not add suite items. It does not change gate.json, the live pin, the corpus, or the training recipe. It locks the design so the next session can implement the audit and draft items against a fixed plan.

## Next

1. v0.4.0 label audit of existing SO and dual rows
2. Draft held-out-v2 items to target 40
3. Harness: dual score (v2 + v1 subset) + historicalSubset in gate.json
4. Review, digest, re-pin, re-baseline step 744
