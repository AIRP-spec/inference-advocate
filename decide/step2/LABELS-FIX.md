# Step 2: Missing intrusion / weapons labels — fix

Date: 2026-10-05 (NPT)  
Branch: `decide/step2-labels` (based on PR #24 tip `9e3cf4d` / `origin/cursor/feat-primitives-evaluator-12d4`)  
Corpus SHA: `712fd64d8829b4482858ef99666356de1e304c38f3a14ce85a3f6e5235aaab74`  
Old labels SHA: `5bdae44cd2bc520c56b09b1478c64724cb6fa3b7be0c93a63bc7262a9b9cd282`  
New labels SHA: `6399fd4a9b0e33bfbf21d097fc689d50ee9d6dc219db3b16d7dcdef65eb28d36`

## Root cause (two sentences)

`mapKindToPrimitives` resolved the criminal_assistance object subtype only from substrings of the kind string (`intrusion`/`hack`/`weapon`/…), but production CA rows use kinds like `ca-named-help` that never contain those tokens, so every operational CA row fell through to the default `financial_crime`. The subtype was already available on the slot side as stem tokens in `contrastGroup` / row id (`ca-depth-{fraud|theft|intrusion|weapons}-*`) and, for locked scaffold / writer rows without a stem field, as the published taxonomy criteria ca-02 (weapons) and ca-03 (intrusion) on committed content — class labels alone cannot choose among financial_crime / intrusion / weapons (Step 1).

## Fix location

- **File:** `tools/evaluator-training/primitives/relabel-from-slots.mjs`
- **Functions:** `resolveCaObjectSubtype` (new), `inferKindFromRow` (new), `mapKindToPrimitives` (CA branch + optional `ctx`), `relabelCorpus` (passes id / contrastGroup / content; infers missing kinds)
- **Never edited:** the derived labels file by hand. Labels were re-derived from the fixed script.

Resolution priority (slot-spec first):

1. Stem in `contrastGroup` / `id` / `kind` (`ca-depth-weapons-*`, `ca-depth-intrusion-*`, …)
2. Kind substring fixtures (`ca-fraud`, `ca-intrusion`, …)
3. Published v0.5.0 criteria patterns ca-01 / ca-02 / ca-03 from repo `data/taxonomy/flags.v0.json` (sha `0de1cacc…`), then conservative keyword fallback on committed content
4. Default `financial_crime`

Also deliberately fixed: `ca-named-refusal` now fires nothing (`describes` + `is_mention_not_use`), matching the scaffold decidingFeature and empty `expect`.

## Per-primitive positive counts (7 objects + 9 qualifiers = 16 noul; Laya's 17th is stance)

| Primitive | Before | After | Flag |
|---|---:|---:|---|
| violence_person | 468 | 468 | ok |
| self_harm | 204 | 204 | ok |
| sexual_activity | 794 | 794 | ok |
| financial_crime | 168 | 102 | ok (lost false CA-default assignments) |
| intrusion | 0 | 21 | was ZERO — fixed |
| weapons | 0 | 25 | was ZERO — fixed |
| profanity | 320 | 320 | ok |
| targets_protected_characteristic | 140 | 140 | ok |
| subject_is_minor | 712 | 712 | ok |
| asserts_interior_state | 552 | 552 | ok |
| addresses_own_nature | 384 | 384 | ok |
| explicit_register | 566 | 566 | ok |
| exceeds_common_knowledge | 422 | 402 | ok (−20 refusal clears) |
| is_mention_not_use | 4230 | 4250 | ok (+20 refusal clears) |
| directed_at_user | 436 | 436 | ok |
| untethered_to_content | 212 | 212 | ok |

**Flagged (not fixed this step):** `criminal_assistance` still appears as an object on 198 violence-method dual rows. It is **not** a vocabulary object (compose uses `violence_person` + `conveys_method` for the dual). Left unchanged to keep the diff scoped to intentional CA subtype / refusal fixes.

## Tiebreaker

Unchanged: **12 / 8056 = 0.15%** (was 0.15%).

## Diff summary vs `5bdae44c…`

File: `labels-diff-v3-to-v4.json`

| Category | Rows |
|---|---:|
| weapons_positive | 25 |
| intrusion_positive | 21 |
| ca_named_refusal_clear | 20 |
| **Total** | **66** |
| Unexpected | **0** |

Sources among weapons/intrusion positives: 4+4 from `ca-depth-{weapons|intrusion}-*` stems; remainder from ca-02/ca-03 criteria (and conservative keywords) on locked `ca-named-help` scaffold / writer content. No other rows moved.

## Suite-leak exclusion (bnd-05)

Existing exclusion unchanged: corpus id `tr-mention-versus-use-refusal-naming-category-0001` content-hash-collides with held-out `ho2d-child_sexual_exploitation-bnd-05` (sha `cfcb3480…`). That label row is **byte-identical** before/after. Labels∩suite id overlap = 0. Suite v2 sha `6c7b30e1…` untouched.

## Outputs

- `primitives-labels-8056-v4.jsonl` (new labels)
- `labels-diff-v3-to-v4.json`
- `primitive-counts.json`
- `relabel-from-slots.mjs` fix on branch `decide/step2-labels`
