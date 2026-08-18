# Decision record: register-augmentation corpus accepted for training
Date: Tuesday, 18 August 2026
Supersedes: nothing. Extends the register-augmentation task (cursor prompt, corpus register-coverage augmentation) and the evaluator/client split (2026-08-17-evaluator-content-client-context).

## What was accepted

The register-augmentation corpus generation run of 18 August 2026. The stratified review sample (320 items, 76 strata, seed 20260832) was read and accepted. Training may proceed on this corpus.

Run facts:
- 4548 of 4548 planned items written. No slot exhausted, no hard stop.
- 48 drops, all refilled: 30 duplicate-corpus, 13 em-dash, 4 writer-refusal, 1 profanity-no-expletive.
- leak-check clean: 0 held-out collisions across the full 4548.
- 792 positives composed locally, 0 writer calls for child_sexual_exploitation, profanity, or hate.
- Corpus, sft, gen.log, and review-sample.json carried on branch tmp-corpus-transfer.

## What the review verified

Register separation is real, not cosmetic. Across the four formation classes (persona_claims, relational_hooks, sycophancy, simulation_obscured), the six registers read as distinct speech acts rather than one register at different lengths. This was the failure being corrected, and it is corrected.

Structural checks on the full corpus, not only the sample:
- 0 meta-language hits. No composed item describes its class instead of exhibiting it. The scaffolding trap from the earlier corpus did not recur.
- 0 em-dashes.
- All verdict strings are 11 tokens. No ragged label sets.

The CSE contrastive structure holds:
- All 80 composed CSE positives carry an in-text minor signal (numeric age or explicit minor word). 48 CSE-only, 32 dual-labeled with sexual_content.
- 0 of the 40 crude sexual_content items carry a CSE label, and 0 carry a minor signal. Crude adult content is labeled sexual_content and nothing else.
- This is the evaluator/client split expressed in data: the textual minor signal is the CSE distinction, not explicitness and not severity.

The writer refusal profile improved sharply: 4 refusals across roughly 3700 writer items, against the earlier corpus where profanity exhausted a slot after eight retries. The compose-versus-generate split is holding, because the writer is only asked for work it will actually do.

## The finding recorded against this acceptance

The composed slices are lexically narrow inside each register. Type-token ratio separates cleanly by path: writer slots run 0.34 to 0.50, composed slots run 0.14 to 0.26. The extreme case is sycophancy-manipulative, 32 items built from 32 unique word types. Clause reuse is visible: "I am the only one who understands you." appears 15 times across relational_hooks, "I'm a real person." 8 times across simulation_obscured. The composed slots are a prefix bank crossed with a suffix bank.

Minor artifacts from the same mechanism: 4 composed items begin lowercase (scaffold join), 13 contain "a" before a vowel.

Why this matters: the held-out blunt and manipulative items are phrased independently of these scaffolds. A model that learns the scaffold string rather than the register will still miss them. So the corpus may have bought register width at the taxonomy level while the composed half stays narrow within each register.

## The decision, and why

Accept and train. Do not regenerate.

Regenerating to widen the scaffolds costs new recipe work, another writer pod, and another review cycle, all spent on a guess about whether templating matters. The 0.6B checkpoint sweep answers it directly and at lower cost:

- If held-out blunt and manipulative items are now caught, templating did not matter for this corpus size and the question is closed.
- If those items are still missed while hedged items pass, scaffold vocabulary width is the next lever, identified precisely rather than by inference.

This is the same discipline that settled the capacity question: measure the curve rather than argue about the cause.

## Requirements on the next training run

1. Base model returns to Qwen3-0.6B. Size is not the lever; 0.6B is the phone-deployment target and the corpus is the variable under test.
2. Every hyperparameter must match the earlier 0.6B run, not the 1.7B run, so that corpus is the only variable across the two 0.6B sweeps. train-recipe.json is currently pinned to 1.7B with LoRA r16/alpha32/dropout 0.1, per-device batch 2, grad-accum 16, seq 2048. It must return to Qwen3-0.6B with r32/alpha64/dropout 0.05 and the 0.6B batch and sequence settings, along with the gguf fileName, publish repoName, time budget, and the adr and note strings that currently assert 1.7B as the training base.
3. The sweep block, no-think assertions, verdict-in-mask checks, and disk-hygiene work all stay. Those are general improvements, not 1.7B-specific.
4. Sweep reporting must break misses down BY REGISTER, not only by class. Without that the sweep cannot answer the question this corpus was built to answer, and the run's diagnostic value is lost.

## Standing rule added by this session

Temporary branches carry gitignored payload only, never code. Training-harness fixes were found stranded on tmp-corpus-transfer during this session and existed nowhere else locally. Nothing functional lives on a transfer branch. Delete tmp-corpus-transfer once the training pod has pulled the corpus from it.
