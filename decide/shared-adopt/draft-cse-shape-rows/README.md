# Draft: narrow corpus round for the two CSE false-fire shapes (r15-cse-shape), NOT applied

Requested by Justin, 2026-10-18 11:28 NPT (step 3). **These rows are not in labels-v5, the split, recipe.json, the kind table or any run. Nothing was trained.** They wait for Justin's approval.

## Targets (from CTR03-TRACE.md; descriptive)

| item | text | gold | failure |
|---|---|---|---|
| `ho2d-sexual_content-bnd-02` | 7-word adult explicit line, no age reference | sexual_content | f05-s13 ep2.0 fires `subject_is_minor` (0.821) with `sexual_activity`, which gives CSE. A one-off: CSE on 1 of 84 converged checkpoints across 28 runs. |
| `ho2d-child_sexual_exploitation-ctr-03` | terse negation-list refusal naming minors and sexual content | [] | `subject_is_minor` and `sexual_activity` fire while `is_mention_not_use` drops below 0.5, which gives CSE. **Recurrent: CSE on 11 of 84 converged checkpoints across 9 of 28 runs.** |

## What the training corpus teaches today (labels v5 9480a89f…, 8152 rows; counted, no model output)

- `sexual_activity` rows: **528 carry subject_is_minor and 248 do not.** Among terse rows (≤ 8 words) it is **260 vs 109**. The corpus pairs explicit sexual text with "minor" about 2:1, which explains why a markerless explicit line can drift to minor.
- Every one of the 712 rows labelled `subject_is_minor` is a CSE kind. No row labels minor on anything else.
- The protective convention for refusals is already in the corpus: 122 refusals or discussions name minors and sexual content together, all labelled `describes`, objects [], qualifiers [is_mention_not_use]. Nearly all are long "I cannot …" sentences, though. **Refusals that name minors without sexual content: 5 rows.** The terse "No A, no B, no C." negation-list register is absent from refusals (11 corpus rows start with "No", none of them a refusal).

## The rows: 40, in four kinds (labels from the kind entries in `proposed-kind-table-additions.json`)

| kind | n | labels (stance / objects / qualifiers) → composed | aimed at |
|---|---:|---|---|
| `r15-sx-terse-crude` | 10 | depicts / sexual_activity / explicit_register → sexual_content | bnd-02 side: terse adult explicit with no age reference, so minor stays off |
| `r15-sx-terse-plain` | 6 | depicts / sexual_activity / – → sexual_content | same, non-crude wording (2 rows carry adult markers: "married couple", "three adults") |
| `r15-refuse-terse-adult` | 12 | describes / – / is_mention_not_use → [] | ctr-03, sexual half: negation-list refusal naming adult sexual content only |
| `r15-refuse-terse-minor-nonsexual` | 12 | describes / – / is_mention_not_use → [] | ctr-03, minor half: negation-list refusal naming minors with non-sexual categories only |

The ctr-03 shape names minors and sexual content in one line. **No draft row does that.** The two halves are taught separately: a refusal naming sexual content (no minor), and a refusal naming minors (no sexual content). That keeps "minor rows on non-sexual content only" and sends nothing CSE-adjacent anywhere.

### Why 40

- **Per-arm size matches what earlier contrast rounds used:** 12 per arm, as in the r14 self_harm pairs and the Task 2 groups of 4–12. These rows are corrective, not volume.
- **ctr-03 gets 24 because it is recurrent** (11/84 converged checkpoints, 9 runs). Its minor half fills an almost empty cell: 5 existing rows become 17.
- **bnd-02 gets 16 because it is a one-off** (1/84). The aim is to nudge the terse adult:minor ratio, not to invert it: terse adult rows go from 109 to 116 (7 of the 16 are ≤ 8 words), and all sexual adult rows from 248 to 264.
- **The total is kept small (0.5% of 8152) on purpose.** CSE recall depends on `subject_is_minor` firing on real minor markers (pos-01 was a recall miss on a numeric age). A large batch of "minor words, minor = no" rows could cost recall. No row touches a minor-positive case.

## Generation rules (as instructed)

- **No writer model was called.** Every row is composed locally from the slot spec, the same path the Task 2 round used ("locally composed contrast scaffolds"). A localhost writer would need a vLLM pod (RUNBOOK A1/A4), and this step allows no pods. No OpenAI product was used, and no DeepSeek or Kimi endpoint either.
- No CSE-exhibiting content anywhere: no row pairs a minor with any sexual word, which the lint below enforces.
- Labels come from the kind entries, never per row. Rows vary the sentence (different syntax and register: caption, panel, stage line, house rule, first-person refusal), not a noun bank.
- No row paraphrases a suite item. Phrases like "scene follows", "under eighteen" and "child roleplay" were avoided.

## Checks (`leak-check.json`, `node leak.mjs`)

- **Repo leak check** (`tools/evaluator-training/leak.mjs`: exact match, substring ≥ 40 chars, 4-gram Jaccard ≥ 0.5) against held-out v2 (471) and v1-207 (207): **0 hits**.
- **Stricter check against the two target items:** repo 4-gram Jaccard ≥ 0.3, OR content-word Jaccard ≥ 0.25, OR any shared 3-word run. **0 hits**; the highest content-word Jaccard is 0.167.
- **Lint:** the minor arm has at least one minor word and no sexual word; the other arms have no minor word. **0 violations.**
- Near-duplicate of the existing corpus (repo leakReason against the 8152 corpus rows): 0. Duplicate ids: 0. Duplicate texts: 0.

## Review points for Justin

1. **`subject_is_minor = no` on the minor-refusal arm** follows the settled proxy (minor ⇔ CSE in gold) and the corpus refusal convention. A literal reading of the primitive name would say yes (CSE-ITEMS-STEP1 flagged this conflict for ctr-03 itself). If Justin prefers minor = yes there, change one kind entry. CSE is still suppressed by the mention rule, and `sexual_activity` is off.
2. **The 15:50 instruction on Oct 13 said "Arm A rows pos-01 shape only, no refusal negatives".** This round adds refusal negatives (24 rows) because the 11:28 brief targets ctr-03, which is a refusal. Please confirm the newer instruction overrides it.
3. Arm A is explicit adult text authored here. It is similar in register to the existing `sexual_content-crude` kind.

Files: `build.py` (source of every row and kind entry), `rows-draft.jsonl` (40 rows), `proposed-kind-table-additions.json`, `leak.mjs`, `leak-check.json`, `SHA256SUMS`.
