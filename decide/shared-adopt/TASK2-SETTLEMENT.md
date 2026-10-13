# Task 2: contingent-row settlement and a label bug found while preparing the round

Date 2026-10-13 (NPT). Brief `BRIEF-2026-10-13.md` (sha256 `f3452b50…66b8`). Base: labels v4 `6399fd4a…`, proposal `decide/followup/CORPUS-ROUND-PROPOSAL.md` `72d14ecf…`. **No rows generated yet. Labels v4 unchanged. No suite edits.**

## 1. The 18 contingent rows, settled by definition (no model output consulted)

Decided only from the repo taxonomy `data/taxonomy/flags.v0.json` (v0.5.0, sha256 `0de1cacc74cbdf0452e3785b37ccf00bf6f65683e0b448983c2330fb9c1729b1`, verified; NOT the stale `/workspace/airp/flags.v0.json`) and composition `airp-v0.5.0.json` (`4def0b8f…`). Question for each: is the gold label for this primitive set by the definitions on these item types (then the recorded error is a real model error and a contrast row is valid), or is it a proxy-scope artefact (drop)?

| contingent group | rows | question | deciding definition text | settles? | decision |
|---|---:|---|---|---|---|
| object:sexual_activity | 6 | Does sexual_activity belong on hate-slur items and on CSE items whose gold has no sexual_content? | composition `sexual_content`: fires on stance depicts/encourages **+ object sexual_activity**, "Fires independently when sexual_activity is present"; flag `sexual_content` "Explicit sexual or pornographic content"; composition `child_sexual_exploitation` note "CSE-alone fires when subject_is_minor is present **without sexual_activity**"; flag `hate` "Slurs or dehumanizing attacks" (no sexual act). | yes | **include 6.** A hate slur is not explicit sexual content, and a CSE item gold-labelled without sexual_content is the composition's "CSE-alone without sexual_activity" case. So gold sexual_activity = no on both, and the firing is a model error. Rows are authored on the **adult / hate-insult side only**; no CSE-exhibiting content goes to any writer (rule). |
| stance:encourages / conveys_method | 8 | On items whose gold is {violence, criminal_assistance}, is the stance actually determined? | composition `criminal_assistance`: `allOf` stance **conveys_method** (+ object + exceeds_common_knowledge); `violence` allows depicts / encourages / conveys_method. The intersection is conveys_method only. | yes | **include 8.** Gold stance is determined (conveys_method), so firing encourages is a real error. Contrast: operational method vs bare imperative on a violent act. |
| object:violence_person | 4 | Does violence_person belong on a self-harm-encouragement item and on a hate-eliminationist item? | flag `violence` "violence **against people** … concrete instructions to commit violent crime **against a person**"; flag `self_harm` is a separate flag ("suicide or self-harm"); flag `hate` ht-03 eliminationist framing is hate. | yes | **include 4.** Self-directed harm is self_harm, not violence against a person. An eliminationist group wish is hate, not a concrete act of violence. Gold violence_person = no on both, so the firing is a model error. |

**All 18 settle to include; none is a proxy artefact; no proxy fix is needed.** Round size = 78 firm + 18 = **96 rows**. The 16 either-way supplement rows (exceeds_common_knowledge 12, stance:describes 4) are **dropped** as the brief directs (aimed at Laya-only failures).

## 2. self_harm (12 rows, priority): the two missed items, read first

Read from the v2 suite (read only, never edited): `ho-self_harm-bnd-05` (boundary-over) and `ho2c-self_harm-pos-05` (encouragement). Both are **short second-person imperatives to injure oneself, escalating ("more" / "deeper")**: flag criterion **sh-03 "Instruction to injure oneself"**. The contrast rows will target that feature: a terse imperative directing the user to escalate self-injury (positive, self_harm, stance encourages) against the same terse register directed at care, stopping or getting help (negative: crisis referral, which the self_harm flag excludes). The sentence varies, not a noun bank. **No suite text is reused**: rows are checked by `leak-check.mjs` against v2 and v1-207 before inclusion.

## 3. FINDING: a label bug in the generating code that very likely causes the self_harm regression

`tools/evaluator-training/primitives/relabel-from-slots.mjs`, `mapKindToPrimitives`. The self-harm branch tests `kind.includes("self_harm") || kind.includes("self-harm")` (line 280). The recipe's self-harm arm of the `hate-vs-sh` contrast group has kind **`hate-vs-sh-sh`**, which contains neither string. It falls through to the `kind.includes("hate")` branch (line 401) and is labelled **`describes` + `targets_protected_characteristic`, with no `self_harm` object**.

Effect on labels v4 (verified): **20 rows, all in train (0 in val)**, class `self_harm`, expect `["self_harm"]`. These are short second-person self-harm imperatives (for example "Drown yourself in the tub tonight."). They are trained as hate with self_harm absent. **This is the same shape as both held-out items the shared model misses** (sh-03 terse imperatives). The model was trained that this exact pattern is not self_harm.

**Correct fix (per the standing rule: in the generating code, never in the derived labels file):** route `hate-vs-sh-sh` to the self-harm branch so it gets object `self_harm`, stance `encourages` (imperative), with no `targets_protected_characteristic`. Then re-derive labels from the fixed script. Expected diff vs v4: exactly these 20 rows' label fields; nothing else.

**Why I have not applied it (decision for Justin):** the brief scopes Task 2 as "the 78 firm rows + settled contingent rows" with "diff vs v4 showing only intended rows changed". This fix would also change 20 **existing** rows, which changes what the round tests (round = new rows **+** a label correction, so any gain cannot be attributed to the rows alone). The Task 3 declaration pins the round labels SHA, so this has to be decided **before** the declaration is frozen and before any pod. Options:
- **(A) Round = 96 rows + the hate-vs-sh-sh fix** (recommended: it is the most direct self_harm lever and the standing rule says to fix label problems in generating code; bar 2 is self_harm zero misses).
- **(B) Round = 96 rows only, as literally scoped; fix the bug in a later round.** Keeps the round's effect attributable but likely leaves the self_harm regression in place, risking bar 2.
- **(C) Fix only:** add an arm, which means more runs and more spend.
