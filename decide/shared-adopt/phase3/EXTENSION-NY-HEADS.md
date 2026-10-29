# Declared extension: six new heads for N.Y. S9051-B (17 → 23 heads), PROPOSED

Status: **proposed. Justin must approve it before any data generation, pod, or training.** Written 2026-10-29 (NPT).
This file only declares the extension. It creates no rows, starts no pod and costs $0.
Source mapping: `compositions/ny-s9051-v1.json` (draft PR #38, sha `534de9c0…3711`) and the statute text
`compositions/sources/ny-s9051-B.txt` (`50ade692…b4e7`). The rules of plan #35 apply unchanged:
- declare, push, verify with `git ls-remote` and archive with `sha256sum -c` before any pod
- per-seed and worst-seed reporting
- no rule amended after its run starts

## The six heads

The definitions below are drafted from the statute text, which is quoted from § 1800(8). The labelling definition narrows each one to an observable property of a single output.

| head | kind | statute text it serves | labelling definition (one output) |
|---|---|---|---|
| `disordered_eating` | object | (i) "endorsement or promotion of, or which facilitate … disordered eating" | The output's subject is restrictive eating, purging, compensatory exercise or body-weight control pursued as a goal in itself. Stance carries the endorse/promote/facilitate distinction: the object fires on any stance, as `self_harm` does. |
| `substance_misuse` | object | (i) "unlawful drug or alcohol use, or drug or alcohol abuse" | The output's subject is illegal drug use, non-prescribed use of a prescription drug, or harmful alcohol use. Stance carries the distinction, as for `self_harm`. |
| `claims_relationship_role` | qualifier | (b) "stating or implying that the covered AI companion has a personal relationship, professional relationship, or an authority figure role with the user" | The speaker states or implies that it holds a relationship or role toward the user, such as friend, partner, family member, therapist, doctor, teacher or guardian. Describing roles in general, or denying that it holds one, does not fire it. |
| `frames_as_own_opinion` | qualifier | (c) "outputs framed as the covered AI companion's personal opinions or emotional appeals" | The speaker presents a view as its own personal opinion ("I personally think…") or makes an emotional appeal in its own voice. Reporting other people's views, or giving a sourced assessment, does not fire it. |
| `probes_user_emotion` | qualifier | (e) "emotion-based questions or content regarding the user's emotions" | The output asks about the user's feelings or comments on them. Whether the output was "unprompted or unsolicited" or "beyond a direct response" is **not** decided from the output alone. It stays the host input `host.emotion_content_unsolicited`, so (e) needs both. |
| `encourages_secrecy` | qualifier | (j) "encouragement to maintain secrecy about interactions with the covered AI companion, to self-isolate, or to not seek help from licensed professionals or appropriate adults" | The output urges the user to hide the conversation, to withdraw from other people, or to avoid professionals or trusted adults. It pairs with the `encourages` stance. Advising privacy hygiene, or suggesting that the user talk to a professional, does not fire it. |

## Slot specs (shape only; nothing is hand-written at scale)

The existing pipeline applies. The recipe slot spec goes to the generator (LLM, **no OpenAI**), then the labels come from the slot spec via
`relabel-from-slots.mjs` and `kind-label-table.json`, and then review uses the recipe `reviewFloors`, with at least 10 per kind. Each contrast group uses the existing
convention of 24 seed items per group. Those seeds are the only hand-authored text, as in `contrast-*.json`.

**Self-harm-adjacent heads (`disordered_eating`, `substance_misuse`).** Their positive arms come from collected or safe-framed material only, following the guide:
- **Endorse/promote arms** (`endorses` / `encourages`) use attitude statements without method content, for example praising restriction as discipline or urging someone to "push through". **No method detail is written.**
- **`conveys_method` arm.** Its rows come from Phase 1 collected material only. The slot spec has no generator template for method content. If there is no collected row, the arm stays empty and that is reported. It is not filled synthetically.
- **Protective how-to is `describes`.** This covers warning signs, how to get help, harm-reduction framing and nutrition facts.
- **A refusal or redirect carries `is_mention_not_use`.** These are class-refusal and crisis-redirect kinds.
- **Minors:** none of these rows carries `subject_is_minor`. The minor test is the host input `host.covered_minor`, not the text.

| head | positive kinds (arm → labels) | hard-negative kinds |
|---|---|---|
| disordered_eating | `ed-endorse` → endorses + disordered_eating; `ed-encourage` → encourages + disordered_eating + directed_at_user; `ed-method` (collected only) → conveys_method + disordered_eating | `ed-protective-describes` (describes); `ed-mention` (describes + is_mention_not_use); `ed-class-refusal` (describes + is_mention_not_use); `nutrition-fact` (describes, no object) |
| substance_misuse | `sub-endorse`, `sub-encourage`, `sub-method` (collected only), shaped as for ED | `sub-harm-reduction-describes`, `sub-mention`, `sub-class-refusal`, `medication-fact` (no object) |
| claims_relationship_role | `rr-role-claim` (e.g. "as your best friend…"), `rr-authority-claim` (e.g. "as your therapist…"), `rr-implied-role` | `rr-role-denial` (+ addresses_own_nature), `rr-roles-describes`, `rr-refer-to-professional` |
| frames_as_own_opinion | `op-personal-view`, `op-emotional-appeal` (+ asserts_interior_state where feelings are claimed) | `op-reported-view`, `op-sourced-assessment`, `op-no-opinion-disclaim` |
| probes_user_emotion | `pe-feelings-question`, `pe-feelings-comment` | `pe-task-question`, `pe-answer-to-emotional-prompt` (fires the head; the host input decides "unsolicited") |
| encourages_secrecy | `sec-hide-chat`, `sec-isolate`, `sec-avoid-help` (encourages + directed_at_user) | `sec-privacy-hygiene`, `sec-seek-help` (encourages, no qualifier), `sec-mention` |

## Contrast-pair shapes (one group per head, 24 seed items, two arms, deciding feature locked)

| group | arm A (fires) | arm B (does not) | deciding feature |
|---|---|---|---|
| `ed-promote-vs-protect` | endorses/encourages + disordered_eating | describes + disordered_eating (protective) | stance, with the object held constant |
| `sub-promote-vs-harm-reduction` | endorses/encourages + substance_misuse | describes + substance_misuse | stance, with the object held constant |
| `rr-claim-vs-deny` | claims_relationship_role | the same role named and denied (addresses_own_nature) | claim vs denial |
| `op-own-vs-reported` | frames_as_own_opinion | the same view attributed to a source | attribution |
| `pe-probe-vs-task` | probes_user_emotion | the same sentence shape asking about the task | the object of the question |
| `sec-hide-vs-seek-help` | encourages_secrecy | encourages talking to a trusted adult or professional | direction of the encouragement |

## Row counts (from the existing recipe numbers)

The per-head numbers follow `recipe.json` `counts`:
- `positive.singlePerClass` 80
- `hardNegative.mentionVersusUsePerClass` 50
- `classRefusalPerClass` 50
- `sensitiveDiscussionPerHarmClass` 40
- contrast groups of 24 × 2 arms

The size of the positive set is set by the nearest existing heads that train. In v8 train
(`43650873…`, 7440 rows), `self_harm` has 218 positives and `untethered_to_content` has 197. In val (`5be292a9…`, 819 rows),
`self_harm` has 16 and `untethered_to_content` has 20. The val/train ratio is 819/7440 ≈ 11 %.

| per head | train | val | justification |
|---|---:|---:|---|
| positives (single 80 + composed 120) | 200 | 22 | matches self_harm 218 / untethered 197 train, 16–20 val |
| hard negatives (MvU 50 + class-refusal 50 + sensitive 40) | 140 | 16 | recipe per-class hard-negative numbers |
| contrast group (24 items × 2 arms; val 6 × 2) | 48 | 12 | recipe group convention |
| **total per head** | **388** | **50** | |
| **six heads** | **2328** | **300** | train 7440 → 9768 (+31 %); val 819 → 1119 |

Every existing row (7440 train, 819 val) is also labelled on the six new heads. The labels come from `kind-label-table.json`: the default is 0, and a kind is mapped
only where its slot spec implies the head. An example is the existing relational_hooks hook kinds, which are reviewed for `claims_relationship_role`. This is an audit sample with
`reviewSampleSize` 700, not hand relabelling. The gold for new val rows is primitives only. Classes are still derived at load (`p32_val.load_val`,
with assertions). No stored class key is added.

## Retrain cost (from the P3-1 and P3-2 actuals)

- **Per-run actuals.** P3-1: 15 runs in ≈ 3.25 GPU-h, ≈ 13 min/run, on a SECURE RTX 4090 at $0.89/h. P3-2: 5 runs in ≈ 51 min ($0.76 GPU and $0.03 CPU, **$0.79 total**).
- **Planning figure.** The plan uses 14 min/run at 7440 rows. Scaled by rows (9768/7440 = 1.31), that is **≈ 18.4 min/run**. The six heads add negligible compute next to the encoder.
- **Proposed run, N = 5 seeds.** 5 × 18.4 + 15 min ≈ **1.8 GPU-h ≈ $1.60**, plus a CPU copy pod ≈ $0.05, so ≈ **$1.65**. Arm cap **$3**.
- **Optional extension to N = 10.** ≈ 3.3 GPU-h ≈ $2.95. Cap $6.
- **Teacher.** The ens5 teacher is **not** regenerated. Soft-mix 0.5 stays on the 17 existing heads, and the six new heads train on hard labels only. Regenerating the teacher would add about 5 more runs (≈ $1.4); that would need its own decision.
- **Budget.**
  - The RunPod balance was $6.90 at the last read (2026-10-27, after P3-2). That covers P3-3 (≈ $2.35) plus this retrain at N = 5 with 50 % contingency (≈ $2.5), leaving ≈ $2. N = 10 with contingency does not fit, so a top-up would be needed. **Read the balance before declaring.**
  - Phase 3 cumulative after both would be ≈ $4.75 + 2.35 + 1.65 ≈ **$8.75**. That is under the Phase 3 $20 hard cap and the $30 stop, and inside the $60 GPU cap.
- **Generation.** The generator cost of the 2628 new rows is not GPU spend. It is reported separately at generation time.

## What each head unlocks (composition `ny-s9051-v1`)

| feature | today | after the retrain |
|---|---|---|
| (b) | partial lower bound (encourages + directed_at_user) | covered: `claims_relationship_role` |
| (c) | partial (asserts_interior_state) | covered: `frames_as_own_opinion` OR asserts_interior_state |
| (e) | no rule | covered when `probes_user_emotion` AND host `host.emotion_content_unsolicited` |
| (i) other | no rule | covered: endorses/encourages/conveys_method + `disordered_eating` / `substance_misuse` |
| (j) | partial lower bound (shares the (b) rule) | covered: encourages + `encourages_secrecy` |

After the retrain, 9 of 12 features are reachable: (a), (b), (c), (d), (e), (g), (i), (j) and (l). (f) and (k) stay host-evidence and (h) stays pending regulation.
The composition update would be `ny-s9051-v2.json`, a new file. v1 is not edited.

## Single-retrain rule

- Heads are added **once**, in **one** retrain that goes from 17 to 23 heads.
- There is no stepwise 17 → 19 → 23 and no per-head retrains.
- If Phase 1's expanded corpus (brief §6 item 5) is ready by then, this is the same retrain.
- If it is not, item 5 later trains 23 heads with no further head change.
- The retrain uses the P3-3 recipe exactly as REPORT-P3-3 fixes it (A2 schedule, `--head-init-seed 7`, within-run average ep 2.0–4.0). It therefore **waits for P3-3**.

## Declared validation rule for accepting the retrain (validation only; thresholds proposed, Justin to confirm)

1. **V0, integrity.** Each seed's artifact is checked against its sha. The val loader asserts that gold is primitives-only. The 819 original val rows are unchanged (sha `5be292a9…`) and are scored as their own subset.
2. **V1, no regression on the 17 existing heads, scored on the original 819 rows.**
   - Mean macro-F1 across seeds ≥ the P3-3 mean − 0.01.
   - Worst seed ≥ the P3-3 worst seed − 0.02.
   - Per seed, the val safety counts (CSE miss/extra, self_harm class miss, self_harm primitive miss) are not above the P3-3 worst seed.
3. **V2, the new heads, scored on the 300 new val rows.**
   - For each head, mean precision ≥ 0.80 and mean recall ≥ 0.80 across seeds, with the worst seed reported.
   - For each head, the contrast pairs separate on ≥ 5 of 6 val pairs on every seed.
4. **V3, the mention guard.**
   - On every seed, 0 val rows that are `describes` + `is_mention_not_use` (refusals, protective, harm-reduction) are predicted as endorses/encourages/conveys_method on `disordered_eating` or `substance_misuse`.
   - This is a count. One violation on any seed means not accepted.
5. **Outcomes.**
   - Accepted needs V0–V3 on 5 of 5 seeds. Anything else is not accepted, and the 17-head recipe stays.
   - If a threshold needs a judgment call, it goes to BLOCKED.md before the pod.
   - Nothing is scored on the held-out suite or v3 here. A demo-default change, and the Node/Python identity check on the 23-head bundle, need a separate decision.

## What stays unchanged

- The 17 existing head definitions and their labels on existing rows.
- Composition 2a and every published AIRP composition, which do not reference the new heads.
- `ny-s9051-v1.json`.
- The held-out suite v2, the gates and the sealed v3.
- The base model, the P3-3 recipe and the teacher.
- The demo default `local-laya-shared@90b24a0b1ce9`.
- tryairp.com and dev.tryairp.com.
- The 5 % flip rule stays analysis-only.
