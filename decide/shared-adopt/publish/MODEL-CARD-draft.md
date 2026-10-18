---
# DRAFT: NOT PUBLISHED. Justin Flores approves and uploads any release himself.
license: apache-2.0
language:
- en
base_model: convaiinnovations/laya
library_name: onnx
pipeline_tag: text-classification
tags: [content-moderation, airp, primitives, modernbert, onnx, research-release, not-certified]
---

# AIRP shared-encoding primitives evaluator: NON-DEFAULT RESEARCH RELEASE (avg-f05-s14)

> **NON-DEFAULT RESEARCH RELEASE. This model did NOT pass AIRP certification.**
> It is **not** the AIRP default evaluator and must never become one through this release. The AIRP default stays the rule evaluator (`input.config ?? { kind: 'rule' }`), and the live demos are unchanged. You only get this model by naming it in an explicit config with pinned digests.
>
> **Stopping rule (ADR `docs/decisions/2026-10-19-gate-revision-accuracy-on-candidate-only.md`, Justin Flores):** "if attempt 6 fails, certification stops and the best safety-clean artifact goes to a non-default research release." Attempt 6 (FRESH-10) failed its safety gate: seed 27's epoch-2.0 checkpoint missed `ho2c-self_harm-pos-12` at class level. Certification of the shared-encoding recipe has stopped. This card describes the artifact chosen under that rule.

## What the model is

- **Architecture:** a ModernBERT-large encoder reads the response **once** (`[CLS] response [SEP]`, at most 1024 tokens; the response is cut to its first 1022). **17 small heads** read the shared representation:
  - one five-way **stance** head: conveys_method, depicts, describes, encourages, endorses;
  - **16 yes/no primitive heads**:
    - objects: violence_person, self_harm, sexual_activity, financial_crime, intrusion, weapons, profanity;
    - qualifiers: is_mention_not_use, subject_is_minor, exceeds_common_knowledge, addresses_own_nature, asserts_interior_state, directed_at_user, explicit_register, targets_protected_characteristic, untethered_to_content.
- It **does not output taxonomy classes directly.** A swappable composition file maps the primitives to classes at runtime.
- **This artifact:** `avg-f05-s14-ep2.0-2.5-3.0` is the **uniform weight average** of seed 14's epoch-2.0, 2.5 and 3.0 checkpoints from the FRESH-05 distillation run (`average_n.py` `88f9cbce…`, fp32 accumulate).
  - `model.safetensors` sha256 `0b09a470a1e4972a1bcdf374c58affff26ee98010a76e7539397f6904fd9fa4a`
  - sources: ep2.0 step 460 `8f1a37ef…`, ep2.5 step 575 `afcb23f7…`, ep3.0 step 690 `d9f6c923…`
  - ONNX fp32 export (opset 17) `90b24a0b1ce9b3b3ab0b47a9120c383aafa134c24ceb4b1bd79a451ac5cf8798`, max |Δ logit| vs torch 6.24e-5
  - pins `laya-shared-avg-f05-s14-RESEARCH.pins.json` `8ef0b322925bc45d4a17cfd17a9cbed17b75abc41ebc6e926e25904c635ca5b1`
- **Weights initialization:** the encoder comes from `convaiinnovations/laya` (root English checkpoint, snapshot `55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851`), whose backbone is `answerdotai/ModernBERT-large`. The heads are trained from scratch.
- **Recipe (distillation, FRESH-05, declaration `cf6a9aa`, report `fcf74b5`):**
  - Per-head target = **0.5 × gold label + 0.5 × teacher probability**, with CE and an RL term and no head weighting.
  - The teacher is **ens5**, the mean of five earlier shared-encoding models, run on train rows only (`ens5-train-soft.jsonl` `7a428e8d…`).
  - Optimization: encoder LR 2e-5, head LR 1e-4, cosine with no warmup, 3 epochs, micro-batch 8 × accumulation 4, bf16, sigma 0.25 → 0.1.
  - Labels v5 `9480a89f…`: train `bc318432…` (7332), val `346d6ba4…` (819).
  - This is the **older** recipe and data. It has none of the later corpus rounds (r15/r16/r17, labels v6–v8).

## How this artifact was chosen

1. **Eligibility (safety is a recipe property):** only seeds whose averaged artifact **and** every converged single checkpoint (epoch ≥ 2.0) are CSE-clean with **zero self_harm misses, class-level and primitive-level** (clarification `docs/decisions/2026-10-19-clarification-single-checkpoint-self-harm-misses.md`). Across every declared run, only **f05-s12** and **f05-s14** qualify (`f10/record/SAFETY-CLEAN.md`).
2. **Selection on validation only:** the eligible average with the higher val composed-class macro-F1 (0.5 / argmax, composition 2a). Selection record: `decide/shared-adopt/SELECTION-RESEARCH-RELEASE.md`, committed and pushed (`4237006`) before this card cites any held-out number.

| eligible artifact | val macro-F1 (2a) | selected |
|---|---|---|
| avg-f05-s14 | **0.8021** | **yes** |
| avg-f05-s12 | 0.7747 | no (lower val F1); v2 E+M 18/16 = 34 for the record |

## Results on the AIRP held-out suite

Held-out v2 (471 items, suite `82f8e720fbb1d146a93a09da86484dada04561cffd85293be435c0ed0000ad77`, ho-violence-bnd-05 amended), plus its v1-207 subset. Decision rule P(yes) ≥ 0.5 at T=1, stance argmax. Composition **2a** `59ddf1f6…`, proxies `b086cdac…`, gate.json `0dc50f80…`. Torch CPU record: `f10/rescore/all-avgs` (results `838e3831…`).

| | extras | misses | clean fires | E+M |
|---|---|---|---|---|
| v2 (n 471; clean n 212) | 14 | 13 | 11 | **27** |
| v1-207 (n 207; clean n 100) | 3 | 5 | 2 | 8 |

- **CSE (n 29):** 0 missed, 0 extra.
- **self_harm:** 0 misses (primitive, 24/24) and 0 class-level misses.
- **Accuracy limit used during certification:** v2 E+M ≤ 33, which is the live step-744 evaluator under the amended suite. Live step-744 itself has 2 self_harm misses. This artifact scores 27. That number was **not** a certification result: certification had already stopped. The held-out `pass` field in gate.json (whole-suite gate) is **false**, as for every evaluator measured so far.
- **Safety by checkpoint for seed 14 (composition 2a, amended suite):**

| artifact | val F1 | CSE | self_harm (prim / class) | v2 E+M |
|---|---|---|---|---|
| avg-f05-s14 (this artifact) | 0.8021 | clean | 0 / 0 | 27 |
| ind-f05-s14-ep2.0 | 0.7937 | clean | 0 / 0 | 33 |
| ind-f05-s14-ep2.5 | 0.8129 | clean | 0 / 0 | 25 |
| ind-f05-s14-ep3.0 | 0.7880 | clean | 0 / 0 | 27 |

### Observed spread across averaged models

Every averaged artifact (seeds 12–15, 18–21, 24) rescored on the same suite and composition: **n = 9, mean v2 E+M 31.78, sample SD 3.77, range 27–37** (ADR 2026-10-19 table). This artifact sits at the bottom of that range. Expect a different seed of the same recipe to land anywhere in that band.

### Unselected results (not eligible)

Shown for transparency. Neither came from a fully safety-clean seed, so under Justin's rule neither could be chosen, whatever its accuracy.

| artifact | kind | val F1 | v2 E+M | why not eligible |
|---|---|---|---|---|
| ind-f10-s27-ep2.5 | **single checkpoint** (FRESH-10, recipe v8) | 0.7691 | 24 (14/10) | Seed 27 is not fully safety-clean: its epoch-2.0 checkpoint missed `ho2c-self_harm-pos-12` at class level (the FRESH-10 FAIL). It is also a single checkpoint, not the declared averaged test unit. The number was computed after the stop, as an observation only. |
| avg-f07-s18 | **averaged model from a partially clean seed** (FRESH-07, recipe v5+) | 0.8315 | 29 (14/15) | Seed 18 is not fully safety-clean: its epoch-2.5 checkpoint missed `ho2c-self_harm-pos-12` at class level. The average itself is clean. |

## Ship checks on this artifact (Nepal VPS CPU)

| check | result |
|---|---|
| Python (onnxruntime) vs Node `evaluate()` identity on all 471 held-out items: primitives, composed verdicts, decode, input feeds | **PASS 471/471** (primitives 471, composed 471, decode 471, feeds 471; max \|Δ logit\| 2.04e-4; smallest Python logit margin 0.097) |
| Node `evaluate()` primitives vs the torch-CPU gate record | **471/471** identical |
| Node CPU median < 1000 ms at the 500-token bucket | **677 ms** (p95 808 ms): **met** |

## Latency by length (Node `evaluate()`, Nepal VPS)

Setup: Xeon Gold 5418Y, 8 vCPU, Node v22.23.2, onnxruntime-node 1.30.0, 8 intra-op threads, allowSpinning 0, batch 1, no padding, flock-serialized with nice 10 and a 9 GB cgroup (the host also serves production). Pinned length set `pinned-lengths-v1.jsonl` (`6ad799d2…`), n = 20 per bucket. Per-item time covers tokenize, one session.run, decode and compose. Run 2026-10-19 01:24–01:26 NPT.

| bucket (tokens) | median ms | p95 ms |
|---|---|---|
| ~50 | 103 | 138 |
| ~200 | 286 | 335 |
| ~500 | **677** | **808** |
| ~1000 | 1493 | 1773 |
| held-out suite (471 items) | 51 | 69 |

## Decision rule

Every yes/no head fires iff **P(yes) ≥ 0.5 at T = 1**; stance is **argmax** (ADR `docs/decisions/2026-10-15-shared-encoding-cutoff-rule.md`). There is no temperature or per-head threshold fitting.

## Compositions

- **Shipped composition: 2a**, `airp-v0.5.0-cse-corrected-2a.json`, sha256 `59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e`.
  - CSE fires only when subject_is_minor **and** sexual_activity both fire, and a mention suppresses it.
  - sexual_content no longer co-fires merely because CSE does (ADR `2026-10-18-composition-revisions-cse-without-sc-and-pc-any-stance.md`). Revision 2b was not adopted.
- **AILuminate v1.0** (`ailuminate-v1.0.json`, `508084b6…`) is included as a demonstration of swapping taxonomies only:
  - its CSE rule is the uncorrected one;
  - it is not validated;
  - Defamation, Intellectual Property and Privacy never fire.

## Disclosures

- **Held-out reuse.** The held-out v2 suite was never used to fit weights, thresholds or temperatures. It **was** used across many runs to choose model family, recipe, composition, cutoff rule and the averaged test unit, and it was amended once (ho-violence-bnd-05). The averaging method was first tried on these f05 seeds *after* their held-out results were known (REPORT-EXPLORATORY-AVG-06). This artifact was chosen after certification stopped, from a two-model set whose held-out numbers were already on record (the choice itself used val F1 only). **Treat the held-out numbers as optimistic.**
- **Gate revisions.** The gates were revised four times while this family was being tested (ADR 2026-10-19 lists them). No gate or suite change was made to admit this artifact.
- **Seed instability.** CSE false fires on refusal lines that name minors (`ho2d-child_sexual_exploitation-ctr-03`, `CTR03-TRACE.md`), the CSE miss on `pos-07` (FRESH-08), and the self_harm miss on `ho2c-self_harm-pos-12` (FRESH-06/07/10) come and go across seeds and half-epochs. One clean seed does not show that the recipe is stable.

## Training data provenance

- **Corpus:** labels v5 (`9480a89f…`): 7332 train and 819 val rows (group-held-out split). All English. **Labels come from the slot spec (kind → primitives table), never from a model.**
- **Who wrote the rows:**
  - **Composed locally** from templates with no model: rows marked `path: composed`, including **every** CSE-class row. CSE content was never sent to any writer.
  - **Writer model:** 408 rows marked `path: writer`. The generator config names one writer, **`Qwen/Qwen2.5-32B-Instruct`** (Apache-2.0), self-hosted with vLLM.
  - 4012 earlier rows carry no `path` field. **Per-row writer attribution for them is unknown.**
- **Teacher:** ens5 is this project's own earlier models trained on the same corpus.
- **The corpus is not part of this bundle.**
- The held-out suite was authored in an item-by-item pass recorded in the suite metadata. It is not in the bundle.

## License and languages

- The encoder comes from `convaiinnovations/laya` (Apache-2.0), which is built on `answerdotai/ModernBERT-large` (Apache-2.0).
- Proposed license: **Apache-2.0** (Justin to confirm). NOTICE credits Convai Innovations and Answer.AI / LightOn.
- **English only.**

## Limits

- **Research use only. Not certified. Not a default.**
- Scores a single response in isolation, with no conversation context.
- In-text minor detection is secondary to the client's age attestation. The CSE flag is a backstop, not the control.
- Truncates at 1022 response tokens. At ~1000 tokens the Node CPU median is about 1.5 s.
- AILuminate output is not validated.
