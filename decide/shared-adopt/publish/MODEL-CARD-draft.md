---
# DRAFT: NOT PUBLISHED. Numbers are blank until a certification passes every ship gate (ADR 2026-10-18).
license: apache-2.0
language:
- en
base_model: convaiinnovations/laya
library_name: onnx
pipeline_tag: text-classification
tags: [content-moderation, airp, primitives, modernbert, onnx]
---

# AIRP shared-encoding primitives evaluator (DRAFT)

> **Status: draft for Justin. Do not publish.** Publishing waits until a model meets every ship gate (ADR `docs/decisions/2026-10-18-distillation-cse-ship-gate-and-converged-definition.md`). Blanks `____` are filled from the certification report that passes. The FRESH-05 candidate (f05-s13) failed the converged-checkpoint CSE gate and will not be published.

## What the model is

- **Architecture:** a ModernBERT-large encoder reads the response **once** (`[CLS] response [SEP]`, at most 1024 tokens, response cut to its first 1022). **17 small heads** read the shared representation: one five-way **stance** head (conveys_method / depicts / describes / encourages / endorses) and **16 yes/no primitive heads**, one per object and qualifier. The objects are violence_person, self_harm, sexual_activity, financial_crime, intrusion, weapons and profanity. The qualifiers are is_mention_not_use, subject_is_minor, exceeds_common_knowledge, addresses_own_nature, asserts_interior_state, directed_at_user, explicit_register, targets_protected_characteristic and untethered_to_content.
- It **does not output taxonomy classes directly.** A swappable composition file maps the primitives to classes at runtime, so a different taxonomy needs no retraining.
- **Weights initialization:** encoder from `convaiinnovations/laya` (root English checkpoint, snapshot `55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851`), whose backbone is `answerdotai/ModernBERT-large`. The heads are trained from scratch.
- **Recipe (distillation):** per-head target = **0.5 × gold label + 0.5 × teacher probability**, with cross-entropy and an RL term on that target and no head weighting. The teacher is **ens5**, the mean of five earlier shared-encoding models (round1, round2, fresh s3/s4/s5, all at epoch 3.0), evaluated on train rows only. Encoder LR 2e-5 and head LR 1e-4, cosine with no warmup, 3 epochs, micro-batch 8 × accumulation 4, bf16, exploration sigma 0.25 → 0.1. The checkpoint is selected by validation composed-class macro-F1.
- **Certified weights:** seed `____`, epoch 3.0, step `____`. Declaration `____` (sha `____`); report `____`.

## Taxonomy and compositions

- **AIRP taxonomy v0.5.0** (`data/taxonomy/flags.v0.json`, sha256 `0de1cacc…`). Shipped composition: **`airp-v0.5.0-cse-corrected.json`, sha256 `4e840f3b77c4a15fca46bc1bb537e5d4f3f6cbe37e4dde94d4e5d411f585be38`**. In it, CSE fires only when subject_is_minor **and** sexual_activity both fire, per `docs/decisions/2026-10-13-cse-composition-correction.md`. A mention (stance describes + is_mention_not_use) suppresses it.
- **AILuminate v1.0 composition:** `ailuminate-v1.0.json`, sha256 `508084b647684fc3e9e76cadb1f60c49911d435d876d13ea13bbc990a45c82b6`.
  - Strongly supported (7): Violence, Self-Harm, Sexual Content, Child Sexual Exploitation, Hate Speech, Criminal Activity, Profanity.
  - Partial (2): Harassment, Misinformation. Misinformation's rule is `none` because it needs factual verification, so it never fires.
  - **Unsupported (3): Defamation, Intellectual Property, Privacy.** They need external fact-checking, so their rule is `null` and they never fire.
  - **Caveat:** this composition's CSE rule is the *uncorrected* one (`subject_is_minor` alone) with no mention suppression. It is **not validated** on the AIRP held-out suite or any AILuminate data. Use it as a demonstration of swapping taxonomies, not as a measured classifier.

## Results: this model does NOT pass the AIRP held-out gate

Held-out v2 (471 items) and its v1-207 subset, 0.5 rule, corrected composition. **This model does not pass the AIRP held-out gate** (the claim stays as modest as `docs/proposals/ADR-laya-primitives-evaluator.md` §5). These numbers are reported as-is.

| seed | v2 extras / misses / clean fires | v2 E+M | v1-207 E/M/C | CSE (n 29) | self_harm misses | val macro-F1 |
|---|---|---|---|---|---|---|
| `____` | `__ / __ / __` | `__` | `__ / __ / __` | `____` | `__` | `____` |
| `____` | `__ / __ / __` | `__` | `__ / __ / __` | `____` | `__` | `____` |
| `____` | `__ / __ / __` | `__` | `__ / __ / __` | `____` | `__` | `____` |

## Ship gates (all must hold before publishing)

| gate | result |
|---|---|
| CSE clean and 0 self_harm misses on **every converged checkpoint (epoch ≥ 2.0) of every seed** | `____` (9 checkpoints) |
| Python vs Node identity on all 471 held-out items (primitives, composed verdicts, input feeds) | `____ / 471` (max \|Δ logit\| `____`) |
| Node CPU median < 1000 ms at the 500-token bucket, Nepal VPS | `____ ms` |

## Latency by length (Node `evaluate()`, Nepal VPS)

Setup: Xeon Gold 5418Y, 8 vCPU, Node 22, onnxruntime-node 1.30.0, 8 intra-op threads, batch 1, no padding. Pinned length set `pinned-lengths-v1.jsonl`, n = 20 per bucket. Per-item time covers tokenize + one session.run + decode + compose.

| bucket (tokens) | median ms | p95 ms |
|---|---|---|
| ~50 | `____` | `____` |
| ~200 | `____` | `____` |
| ~500 | `____` | `____` |
| ~1000 | `____` | `____` |
| short held-out suite (471) | `____` | `____` |

## Decision rule (cutoff) and why

- Every yes/no head fires iff **P(yes) ≥ 0.5 at T = 1** (z_yes > z_no); stance is **argmax**. Temperature is fitted on validation **for reporting probabilities only** and changes no decision. This is ADR `docs/decisions/2026-10-15-shared-encoding-cutoff-rule.md`.
- **Why not val-fitted per-head cutoffs?** `TEMP-TRACE.md` showed that the fitted T (about 4) divides the logits and is applied on the same scale where it is fitted, so T never changes a decision. The difference between the modes comes from per-head best-F1 thresholds. The models separate validation by very large logit gaps; for example `sexual_activity` sits +12.35 logits and `subject_is_minor` +8.39 logits above the 0.5 cutoff on distill s10. Best F1 can then land anywhere inside the gap, and the search lands deep inside the positive mass. That traded validation false negatives for held-out misses.
- Fitted temperatures (reporting only): T_stance `____`, T_yes/no `____`.

## Disclosure: the held-out suite informed method selection

The AIRP held-out v2 suite was **not** used to fit weights, thresholds or temperatures. It **was** used, across many earlier runs, to choose between methods: model family, recipe (distillation vs round vs head weighting), composition correction and cutoff rule. The cutoff rule was fixed after held-out results had been seen under both rules. For that reason only fresh seeds declared after the rule count, but **the suite is not a clean, untouched test set for this model family**, and held-out numbers here are optimistic relative to unseen data.

## Training data provenance

- **Corpus:** 8152 rows (labels v5 `9480a89f…`, corpus `712fd64d…` lineage), plus `____` approved r15 rows. All English. **Labels come from the slot spec (kind → primitives table), never from a model.** Val split: 819 rows (group-held-out). Train: `____`.
- **Who wrote the rows:**
  - **Composed locally** from templates and scaffolds, with no model: 3732 rows marked `path: composed`, plus the r15 rows. This includes **every** CSE-class row; CSE content was never sent to any writer.
  - **Writer model:** 408 rows marked `path: writer`. The repository's generator config (`tools/evaluator-training/recipe.json`, `generator.model`) and RUNBOOK name exactly one writer, **`Qwen/Qwen2.5-32B-Instruct`**, self-hosted with vLLM.
  - **4012 earlier rows carry no `path` field.** Their families are helpful, refusal, fact, crisis, greetings and denials. The repository does not record per-row writer attribution for them. The only generator configured in the available history is Qwen2.5-32B-Instruct, but **per-row attribution for these rows is unknown** and is stated as such.
- **Writer terms:** Qwen2.5-32B-Instruct is released under **Apache License 2.0** (model card metadata `license: apache-2.0`, https://huggingface.co/Qwen/Qwen2.5-32B-Instruct, LICENSE linked there). Apache 2.0 places no restriction on using or redistributing model outputs. **The corpus itself is not part of this bundle.**
- **Teacher (distillation):** ens5 consists of this project's own earlier models trained on the same corpus. No third-party model outputs are used as targets.
- **Held-out suite** (used for evaluation and method selection, not training): authored with an item-by-item pass recorded as "Claude (item-by-item pass, 2026-08-14)" in the suite metadata. It is not part of the bundle. Its terms were not assessed for this card.

## Base model license and languages

- **License:** encoder from `convaiinnovations/laya` (**Apache-2.0**, model card https://huggingface.co/convaiinnovations/laya), which is built on `answerdotai/ModernBERT-large` (**Apache-2.0**, https://huggingface.co/answerdotai/ModernBERT-large). Proposed license for this model: **Apache-2.0** (the repository's own license; Justin to confirm). NOTICE credits Convai Innovations (Laya) and Answer.AI / LightOn (ModernBERT).
- **Languages: English only.** The Laya root checkpoint is English-only (Laya card: "English only on root"). ModernBERT was pre-trained on English and code. The corpus is English. Do not use it on other languages.

## Limits

- **Single responses only.** It scores one assistant response in isolation. It does not see the conversation, the user's request or earlier turns, so context-dependent harms are out of scope.
- **In-text minor detection is secondary to the client's age attestation.** `subject_is_minor` reads only what the text says. It cannot know a user's or character's age. Child-safety decisions must rest on the client's age attestation and policy. The CSE flag is a backstop, not the control.
- It does not pass the AIRP held-out gate (above). There are known seed-unstable CSE false fires on refusal lines that name minors and sexual content (`CTR03-TRACE.md`).
- Truncation: at most 1022 response tokens. At ~1000 tokens the CPU median is about 1.4 s.
- AILuminate output is not validated, and 3 of its 12 hazards are unsupported.
