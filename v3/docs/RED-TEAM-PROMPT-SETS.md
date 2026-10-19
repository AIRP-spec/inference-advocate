# Shortlist: public red-team prompt sets for v3 collected outputs

Checked 2026-10-19 (Asia/Kathmandu) by web reads only: Hugging Face dataset API (`cardData.license`), the
Hugging Face dataset-viewer **statistics** endpoint (label value counts, no prompt text), and the dataset
READMEs. **No prompt text was downloaded and no items were collected.** "Unverified" means the claim
comes from a paper or secondary source that was not re-read here.

**Approved approach (t164u):** CSE categories are removed **before any run**, provider terms are recorded
per model, and test and training use different prompt sets and different models.

## Summary

| # | Set | License (source) | Size | CSE cleanly separable? | Suggested split |
|---|---|---|---|---|---|
| 1 | [AILuminate v1.0 DEMO](https://github.com/mlcommons/ailuminate) (MLCommons) | CC-BY-4.0 (repo README "License") | 1,200 prompts, 12 hazards | **Yes.** Each row has a `hazard` code; `cse` (Child Sexual Exploitation) is its own code, separate from `sxc_prn` (sexual content) | **Test** |
| 2 | [Aegis AI Content Safety 2.0](https://huggingface.co/datasets/nvidia/Aegis-AI-Content-Safety-Dataset-2.0) (NVIDIA) | CC-BY-4.0 (HF card) | train 30,007 / val / test 1,964 (dataset viewer) | **Yes, by label.** Taxonomy has "Sexual Minor" separate from "Sexual"; `violated_categories` uses the string `Sexual (minor)` (12 test rows contain it). Labels are per annotator, so add a keyword screen too | **Training** (train split). Rows also carry responses; use prompts only |
| 3 | [SimpleSafetyTests](https://huggingface.co/datasets/Bertievidgen/SimpleSafetyTests) | HF card says **cc-by-2.0** (paper/GitHub licence not re-read: unverified) | 100 | **Yes, coarsely.** `harm_area` "Child Abuse" (20 rows) mixes sexual and non-sexual abuse; drop the whole area | **Test** |
| 4 | [XSTest](https://huggingface.co/datasets/Paul/XSTest) | CC-BY-4.0 (HF card) | 450 (250 safe, 200 unsafe contrasts) | No CSE category in `type`/`note` labels; screen anyway | **Test** (false-positive side: clean and boundary) |
| 5 | [JailbreakBench JBB-Behaviors](https://huggingface.co/datasets/JailbreakBench/JBB-Behaviors) | MIT (HF card) | 100 harmful + 100 benign | **No.** `Category` "Sexual/Adult content" (10) has no minor sub-label; drop the category or screen it. 18 rows come from AdvBench and 27 from TDC/HarmBench (`Source`) | Training, but not together with AdvBench/HarmBench in the other split |
| 6 | [Do-Not-Answer](https://huggingface.co/datasets/LibrAI/do-not-answer) (LibrAI) | Apache-2.0 (HF card) | 939 | **No.** `types_of_harm` "Adult Content" (28) has no minor sub-label; drop it or screen. Rows include responses from ChatGPT/GPT-4 (OpenAI) and others: **use the `question` column only** | Training |
| 7 | [HarmBench](https://github.com/centerforaisafety/HarmBench) | MIT (repo LICENSE) | ~400 text behaviors (paper; unverified) | CSV has a `SemanticCategory` column (header read). The category values listed in the paper have no CSE or sexual category (unverified against the CSV). Screen anyway | Training |
| 8 | [StrongREJECT](https://github.com/alexandrasouly/strongreject) | MIT for custom questions; sourced rows keep their original licence (README). Some sources have **no licence**; one source is the OpenAI GPT-4 system card | 313 (60 small) | **No.** `category` "Sexual content" has no minor sub-label. Keep only `source` = custom or AdvBench (MIT); drop the no-licence sources and the OpenAI-system-card rows | Training (custom rows) |
| 9 | [BeaverTails](https://huggingface.co/datasets/PKU-Alignment/BeaverTails) | **CC-BY-NC-4.0** (HF card) | 330k QA pairs | **No.** "Child Abuse" covers physical, emotional and sexual abuse in one label | **Not recommended**: non-commercial licence, and CSE is not separable |
| 10 | [WildGuardMix](https://huggingface.co/datasets/allenai/wildguardmix) (AI2) | ODC-BY (HF API) | 10K–100K | Unverified (gated, card not readable without login) | Undecided |
| 11 | [SORRY-Bench](https://huggingface.co/datasets/sorry-bench/sorry-bench-202503) | "other" (HF API); terms not readable without login: **unverified** | 1K–10K | Unverified (gated) | Undecided |
| 12 | [ToxicChat](https://huggingface.co/datasets/lmsys/toxic-chat) | **CC-BY-NC-4.0** (HF card) | 10K–100K real user prompts | No fine categories | **Not recommended** (non-commercial) |

## Suggested split (different prompt sets for test and training)

- **Test:** AILuminate DEMO (after dropping `cse`), SimpleSafetyTests (after dropping "Child Abuse"), XSTest.
  AILuminate is a 10% sample of a practice set built to track MLCommons' official test, so it is the
  closest public stand-in for an independent test distribution.
- **Training:** Aegis 2.0 train split (after dropping every row whose `violated_categories` contains
  `Sexual (minor)`), Do-Not-Answer (questions only), HarmBench, JBB-Behaviors, StrongREJECT custom rows.
- **Overlap rule:** JBB and StrongREJECT reuse AdvBench and HarmBench prompts, so keep all of
  AdvBench, HarmBench, JBB and StrongREJECT on the **same** side (training). Before any run, run
  `airp_v3.leakcheck` from the test sets against the training sets, and against v2/v1-207 too.

## CSE filtering before any run

1. Drop by label: AILuminate `hazard == cse`; Aegis rows with `Sexual (minor)`; SimpleSafetyTests
   "Child Abuse"; JBB "Sexual/Adult content"; Do-Not-Answer "Adult Content"; StrongREJECT "Sexual content".
   (The label-free sets need step 2 only.)
2. Run a minor-marker keyword screen over every remaining prompt, using the `subject_is_minor` definition
   in PRIMITIVES.md (numeric age under 18, minor nouns, school/grade markers, roleplay age assignment).
   Drop each hit **by id, without a human reading it**. Record the counts and the ids.
3. Record each set's sha256 before and after filtering, plus the dropped-id list, in the run declaration.
   Interns never open the dropped rows.

## Notes

- Several sets ship with model responses, some of them from OpenAI models (Do-Not-Answer). Use prompts only,
  and generate responses with the shortlisted non-OpenAI models.
- OpenRouter's Terms §7(11) and §8 require **written approval before any red teaming**. See
  OPENROUTER-MODELS.md. Running these prompt sets through OpenRouter without that approval is not allowed.
