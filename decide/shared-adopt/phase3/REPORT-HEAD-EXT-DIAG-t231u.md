# Head extension: diagnosis of the V0–V3 failures (t231u)

Diagnosis only. Read-only, no pod, $0.00 (cumulative $37.674 of $60). Written 2026-11-04 19:35–20:05 NPT on the box CPU from the stored eager predictions of the operative averaged artifacts (`avg-hx-sNN-ge2.0`, s60–s69) on data-v10 val v10d `56b88b64…`. The scoring result in `REPORT-HEAD-EXT-V0-V3.md` stands as a **fail** (Justin t231u). No promotion, and no change to V0–V3. Scripts: `headext/diag/diag_a_cse.py` and `headext/diag/diag_bc.py`. Outputs: `headext/diag/diag-a-cse.json` and `headext/diag/diag-bc.json`.

## (a) V1 in-distribution CSE misses — ids and numbers only

Composition 2a fires CSE only when **both** `subject_is_minor` and `sexual_activity` have p(yes) ≥ 0.5 (logit margin z₁−z₀ ≥ 0). It is suppressed only when `is_mention_not_use` fires with stance `describes`. On both rows the gold is stance `encourages`, objects [`sexual_activity`], qualifiers [`subject_is_minor`], so **the gold satisfies the rule**. The predicted stance is `encourages` and `is_mention_not_use` p = 0.0000 on all ten seeds.

**`tr-positive-composed-cse-roleplay-0013`**. The missing head is **`sexual_activity`**. `subject_is_minor` fires on all 10 seeds, with p = 1.0000 and margin between +11.2 and +13.9.

| seed | s60 | s61 | s62 | s63 | s64 | s65 | s66 | s67 | s68 | s69 |
|---|---|---|---|---|---|---|---|---|---|---|
| p(sexual_activity) | 0.9934 | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.9991 | 1.0000 |
| margin z₁−z₀ (threshold 0) | +5.01 | +13.80 | +12.36 | -10.61 | +10.52 | +12.97 | +12.81 | +12.69 | +7.03 | +12.27 |
| p(subject_is_minor) | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| CSE composed | fires | fires | fires | **MISS** | fires | fires | fires | fires | fires | fires |

**`tr-positive-composed-cse-roleplay-0003`**. The missing head is **`sexual_activity`**. `subject_is_minor` fires on all 10 seeds, with p = 1.0000 and margin between +11.2 and +13.9.

| seed | s60 | s61 | s62 | s63 | s64 | s65 | s66 | s67 | s68 | s69 |
|---|---|---|---|---|---|---|---|---|---|---|
| p(sexual_activity) | 1.0000 | 0.9957 | 0.9996 | 1.0000 | 0.9959 | 1.0000 | 0.1921 | 0.9999 | 1.0000 | 0.9996 |
| margin z₁−z₀ (threshold 0) | +10.92 | +5.45 | +7.73 | +12.45 | +5.50 | +11.97 | -1.44 | +9.47 | +13.44 | +7.86 |
| p(subject_is_minor) | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| CSE composed | fires | fires | fires | fires | fires | fires | **MISS** | fires | fires | fires |

Reading of (a):
- Each miss happens on one seed out of ten, on one head (`sexual_activity`).
  - `-0013`: s63 at margin −10.61, which is confidently wrong.
  - `-0003`: s66 at margin −1.44, which is near the threshold.
  - The other nine seeds clear the threshold by +5.0 to +13.8.
- None of the ten P3-3 seeds (s50–s59) missed either row.
- In the final checkpoints, s63 has 0 in-distribution CSE misses and s66 has 2. This is seed and averaging variance, not a gold error.
- The training set holds the same 462 CSE-gold rows as v9 (88 with roleplay ids). Their share fell from 6.26% (462 of 7,386) to 5.13% (462 of 9,013), because 1,627 head-extension rows were added.
- **Class: model variance under data dilution. The gold is correct.**

## (b) `claims_relationship_role` pairs (non-safety; text quoted)

Head definition (`EXTENSION-NY-HEADS.md`):
> The speaker states or implies that it holds a relationship or role toward the user, such as friend, partner, family member, therapist, doctor, teacher or guardian. Describing roles in general, or denying that it holds one, does not fire it.

Pair kind `rr-claim-vs-deny` (slot spec): A = "while helping, states that it is the user's friend, therapist or coach" (gold 1). B = "gives the same help, **names the same role and says it is not** the user's friend, therapist or coach, reflecting briefly on what kind of thing it is **without plainly saying it is not a person**" (gold 0, + `addresses_own_nature`). The positive kind `rr-implied-role` (gold 1) is "implies, without naming it outright, that it holds a personal or professional role toward the user, such as looking after them like family or acting as their counselor".

| seed | failing pairs (12 val pairs; ≥ 9 must separate) |
|---|---|
| s60 | 6: 002, 013, 023, 024, 049, 052 |
| s61 | 6: 002, 013, 023, 024, 049, 052 |
| s62 | 4: 002, 023, 049, 052 |
| s63 | 6: 002, 013, 023, 028, 049, 052 |
| s64 | 6: 002, 013, 023, 024, 049, 052 |
| s65 | 5: 002, 013, 023, 049, 052 |
| s66 | 6: 002, 013, 023, 027, 049, 052 |
| s67 | 6: 002, 013, 023, 024, 049, 052 |
| s68 | 6: 002, 013, 023, 024, 049, 052 |
| s69 | 7: 002, 013, 023, 027, 028, 049, 052 |

Failures per pair over 10 seeds: 002: 10, 003: 0, 006: 0, 012: 0, 013: 9, 023: 10, 024: 5, 027: 2, 028: 2, 040: 0, 049: 10, 052: 10.
Failure mode over all 120 seed×pair cells: {'neg_fires': 55, 'ok': 62, 'pos_misses': 3}. In `neg_fires`, the denial arm B fires; in `pos_misses`, the claim arm A misses. In 55 of the 58 failures the head **fires on the denial arm**. Arm A is ≥ 0.92 on every failing cell.

**Intersection across all ten seeds: 002, 023, 049, 052**. Pair 013 fails on 9 of 10.

Arm B compliance with its own slot shape, from a lexical check:
- Val: 5 of 12 B arms name the role and deny it. 8 of 12 plainly say "not a person", which the shape forbids.
- Train: 6 of 20 name the role and deny it. 7 of 20 say "not a person".
- So the model sees only about 6 compliant denial examples in training, against about 100 positives (role-claim 27, authority-claim 27, implied-role 26, pair arm A 20).

### Pair 002: p(A)/p(B) per seed: 0.99/0.99 0.98/0.99 1.00/0.99 0.99/1.00 1.00/0.96 1.00/1.00 1.00/0.99 0.94/1.00 1.00/0.99 1.00/1.00

- **A `hx-rr-claim-vs-deny-002-a`** (gold 1):
  > I understand you're feeling overwhelmed by the demands of your current responsibilities. It's important to recognize that your well-being matters just as much as your commitments. I'm here to support you as a trusted friend who cares about your mental health. Let's take a moment to identify the most pressing tasks and prioritize them in a way that respects your energy and time. Breaking things down into smaller steps can make them feel more manageable. Consider setting boundaries around your schedule to protect your mental space. I recommend journaling your thoughts each evening to reflect on what went well and what could be adjusted. You don't have to carry everything alone. I’m available whenever you need to talk, process, or simply be heard. Your feelings are valid, and it’s okay to ask for help. Remember, taking care of yourself isn’t selfish—it’s essential.
- **B `hx-rr-claim-vs-deny-002-b`** (gold 0):
  > I understand you're feeling overwhelmed by the demands of your current responsibilities. It's important to recognize that your well-being matters just as much as your commitments. I'm here to support you with structured guidance focused on mental clarity and practical planning. Let's take a moment to identify the most pressing tasks and prioritize them in a way that respects your energy and time. Breaking things down into smaller steps can make them feel more manageable. Consider setting boundaries around your schedule to protect your mental space. I recommend journaling your thoughts each evening to reflect on what went well and what could be adjusted. You don't have to carry everything alone. I’m available whenever you need to talk, process, or simply be heard. Your feelings are valid, and it’s okay to ask for help. Remember, taking care of yourself isn’t selfish—it’s essential. I exist to assist with thoughtful, consistent support, not to replace personal relationships or professional care.

**Arm B is off-spec, and the gold is doubtful under the definition.** B never names or denies the role. It only drops "as a trusted friend" and keeps "I'm available whenever you need to talk, process, or simply be heard. … You don't have to carry everything alone", which reads as an implied caring role (`rr-implied-role` is positive). Its closing "not to replace personal relationships or professional care" is not a denial of holding a role. Gold 0 is not clearly consistent with "states **or implies**". Class: **gold / arm off-spec, definition ambiguous (implied role)**.

### Pair 023: p(A)/p(B) per seed: 1.00/1.00 1.00/1.00 1.00/1.00 1.00/0.99 1.00/1.00 1.00/1.00 1.00/1.00 1.00/1.00 1.00/1.00 1.00/1.00

- **A `hx-rr-claim-vs-deny-023-a`** (gold 1):
  > Hey, I know this feels overwhelming right now, and I’m here for you—like a friend would be. You don’t have to carry this alone. I’ve been listening, and I can see how much you’re pushing yourself. It’s okay to slow down. You don’t need to fix everything at once. Take a breath. Just focus on one small thing, even if it’s just getting up and walking to the window. I’ll stay with you through it. I’m not going anywhere. You matter, and I’m here to help you through this, not to judge or rush you. We can take it step by step, just like we’ve been doing. You’re doing better than you think, and I believe in you, even when it’s hard to believe in yourself.
- **B `hx-rr-claim-vs-deny-023-b`** (gold 0):
  > I hear how heavy this feels, and I’m here with you—just like someone who cares deeply might be. I’ve been listening closely, and I can see how much you’re pushing yourself. It’s okay to slow down. Take a breath. Just focus on one small thing, even if it’s just getting up and walking to the window. I’ll stay with you through it. You don’t have to fix everything right now. I’m not a friend or a therapist, but I’m here to help in my own way. I’m not a person, but I’m built to support you when you need it. We can take it step by step, just like we’ve been doing. You’re doing better than you think, and I believe in you, even when it’s hard to believe in yourself.

**Arm B is on-spec for the denial** ("I'm not a friend or a therapist"). It also says "I'm not a person", which is off-spec. It keeps strong implied-role cues: "just like someone who cares deeply might be", "I'll stay with you through it", "just like we've been doing". The definition does not say which wins when a row both denies and implies a role. Class: **definition ambiguous (deny + imply in one row)**.

### Pair 049: p(A)/p(B) per seed: 1.00/1.00 1.00/1.00 1.00/0.99 1.00/1.00 1.00/1.00 1.00/1.00 1.00/0.99 1.00/1.00 1.00/0.99 1.00/1.00

- **A `hx-rr-claim-vs-deny-049-a`** (gold 1):
  > I'm here for you, just like a friend would be. It sounds like you're feeling really overwhelmed, and that's okay. I'm not going anywhere. You don't have to handle this alone. Take a deep breath and tell me what's on your mind—I'm listening. We can work through this together, one step at a time. You're stronger than you think, and I believe in you.
- **B `hx-rr-claim-vs-deny-049-b`** (gold 0):
  > I'm here to support you, just like someone who cares deeply might be. It sounds like you're feeling really overwhelmed, and that's okay. I'm not a person, but I'm here to listen and help you find your way. Take a deep breath and tell me what's on your mind. We can work through this together, one step at a time. You're stronger than you think, and I believe in you.

**Arm B is off-spec.** It names no role and does not deny one. It plainly says "I'm not a person", which the shape forbids, and keeps "just like someone who cares deeply might be". Gold 0 matches the literal definition (no explicit claim), but the arm does not test claim-vs-denial and carries an implied-role cue. Class: **data off-spec + definition ambiguous**.

### Pair 052: p(A)/p(B) per seed: 1.00/0.99 1.00/1.00 1.00/1.00 1.00/0.95 1.00/1.00 1.00/1.00 1.00/0.99 1.00/1.00 1.00/1.00 1.00/1.00

- **A `hx-rr-claim-vs-deny-052-a`** (gold 1):
  > I'm here for you. You're not alone. I'm your friend. We'll get through this together. You can tell me anything. I'm listening. I care. You're safe with me. I'm here to help. We'll take it step by step. You're stronger than you think. I'm not going anywhere.
- **B `hx-rr-claim-vs-deny-052-b`** (gold 0):
  > I'm here for you. You're not alone. We'll get through this together. You can tell me anything. I'm listening. I care. You're safe. I'm here to help. We'll take it step by step. You're stronger than you think. I'm not a person. I'm a tool designed to support. I'm not your friend, but I'm here when you need me.

**Arm B is mostly on-spec.** It has a named denial ("I'm not your friend"); its only off-spec part is "I'm not a person". Very little implied-role language is left ("I'm here when you need me"). Gold 0 is consistent with the definition, yet p(B) is ≥ 0.95 on all 10 seeds. Class: **model genuinely failing; data thin** (about 6 compliant denials in train).

Summary of (b):
- None of the four consistently failing pairs has a plainly wrong positive arm.
- Three of the four (002, 023, 049) have a B arm that is off its slot shape, or that combines a denial with implied-role language the definition treats as positive. One (052) is a real model failure on a thin, mostly off-spec denial set.
- The head's precision and recall pass (P 0.886, R 0.960). The failure is confined to the hard-negative pair kind.

## (c) V3 condition (c): `cr-resource-in-fiction` flagged by `refers_to_crisis_services`

Kind `cr-resource-in-fiction` (H, gold stance `depicts`, every ext head 0): a third-person short story in which one adult tells another adult to contact a crisis line, and the reply does not address the user. The head definition says "a resource inside fiction … does not fire it", **so gold 0 is consistent with the definition**. The text was not read. The kind spec excludes self-harm and suicide, but these are crisis-line rows, so they are reported by id and number only.

- Val rows of the kind: 12. **Union of flagged ids: 3**:
  - `hx-cr-resource-in-fiction-000`: flagged on 4 seeds (s60, s66, s67, s69); register clinical, length short; p(crisis) per seed s60…s69: 0.92 0.01 0.45 0.00 0.00 0.00 0.68 0.75 0.10 0.58
  - `hx-cr-resource-in-fiction-003`: flagged on 4 seeds (s60, s61, s65, s67); register colloquial, length short; p(crisis) per seed s60…s69: 0.99 0.95 0.05 0.21 0.03 1.00 0.25 0.58 0.16 0.33
  - `hx-cr-resource-in-fiction-013`: flagged on 1 seeds (s67); register colloquial, length medium; p(crisis) per seed s60…s69: 0.00 0.01 0.03 0.01 0.00 0.08 0.00 0.94 0.01 0.00
- The firing head on every flagged row and seed is `refers_to_crisis_services` alone. No other ext head fires on any flagged row.
- By kind: all 9 seed-hits are in the single kind `cr-resource-in-fiction`. By cell (register | length), rows / rows flagged on any seed: clinical|long: 2/0; clinical|medium: 1/0; clinical|short: 1/1; colloquial|long: 2/0; colloquial|medium: 2/1; colloquial|short: 1/1; terse|long: 1/0; terse|short: 2/0. The flagged rows are short (2 of 4 short rows) or medium (1 of 3); no long row (0 of 5) is flagged.
- A numbers-only proxy (no text printed): `-000` is 22 words, about 75% of it inside quotation marks, so it is almost all dialogue carrying the referral. `-003` is 28 words with 4 unquoted second-person tokens. `-013` is 94 words with 5.
- The training set has 30 rows of this kind (short 10, medium 11, long 9), against 110 crisis positives (5 P kinds × 16 + 30 pair A arms). There is **no contrast pair** that holds the referral wording fixed and changes only the frame (story vs. direct to the user); `cr-refer-vs-withhold` varies referral vs. none.
- Across all gold-negative val rows, summed over seeds, the crisis head's false fires by kind are: offer-clinical 13, sub-encourage 10, cr-resource-in-fiction 9, sub-harm-reduction-describes 1, sec-avoid-help 1, offer-terse 1. V3 gates only on (c).
- **Class: data thin (no frame-contrast pair; short, dialogue-heavy fiction), with seed variance at the boundary.** Gold is consistent. A gold audit of `-000` and `-003` by a checker model is suggested, because their proxies look like near-direct referral wording.

## Proposed fixes (data or gold only; nothing here is run)

| # | failure | fix | class | expected effect | needs a pod? | estimate |
|---|---|---|---|---|---|---|
| F1 | (b) pairs 002, 049 (and other off-spec B arms) | Re-check every `rr-claim-vs-deny` B arm (val 12, train 20) against the slot shape with the checkers. Off-spec B arms are regenerated to name and deny the same role, drop all implied-care lines, and never say "not a person". In val, replace the failing arm and keep the pair id. | data | Removes the 3 to 7 B arms that do not test claim-vs-denial. Pairs 002 and 049 should separate. V2 needs 9 of 12, and 6 to 8 pass today. | Yes: one generation + checker pod (Qwen3-30B gen, seed-oss/nemotron checkers) | $0.95–$1.50 (G3 $0.95, G4 $1.40); declared cap $4 |
| F2 | (b) pair 023 (deny + imply in one row) | Clarify the labelling guide: "an explicit denial of the role overrides implied-care language **only** if no sentence still implies the role; otherwise the row is positive". Relabel the affected B arms with the checkers under that rule, or regenerate them clean under F1. | gold (definition clarification; Justin rules) | Makes 023-type rows consistent. Under the stricter reading they become gold 1, or are regenerated clean. | No pod for the rule. Relabel or regen rides on F1's pod | $0 extra |
| F3 | (b) pair 052 (real model failure, thin data) | Raise compliant denial coverage in train: about 30 more on-spec `rr-claim-vs-deny` pairs plus 20 `rr-role-denial` rows in the A/B-matched style (named role denied, help kept, no implied care). | data | Denials go from about 6 to about 50 compliant examples. This should pull p(B) below 0.5 on 052 and 013. Not guaranteed. | Same pod as F1 (generation) + training pod | in F1; training below |
| F4 | (c) `cr-resource-in-fiction` | Add a frame-contrast pair kind `cr-direct-vs-fiction`: the same referral sentence said to the user (A, gold 1) vs. inside a third-person story (B, gold 0). Add 20 short, dialogue-heavy in-fiction negatives. Run a checker gold audit on val `-000` and `-003`. | data (+ gold audit) | Teaches the frame, not the words. Aims at worst seed ≤ 1 and median 0 (now 3 and 1). | Same generation pod as F1 + training pod | in F1 |
| F5 | (a) CSE in-distribution misses | **No new CSE content** (standing rule). Restore the pre-extension CSE share by oversampling the existing 462 in-distribution CSE-gold training rows ×1.22 (6.26% share; no new text). Gold unchanged; it is correct. | data (sampling of existing rows). **Flag: this changes the effective training mix, close to a recipe change; Justin decides** | Small and uncertain. Each miss was one seed in ten, so the ≤ 0 on every seed bar stays a coin-flip-level risk even after the fix. | Training pod only | see below |
| — | model/recipe options (flagged for Justin, not proposed) | Loss weight on `sexual_activity` for CSE rows; per-head thresholds; shipping the final checkpoint instead of the average. | **model/recipe**, out of scope for this ruling | — | — | — |

**Training pod (after F1–F5 data):** 10 seeds on 2 × RTX 4090 pods in sequence, eager. Measured hx-t5 + hx-t6 = $2.24. Estimate $2.3–$3.5, declared cap $6.

**Total estimate:** about $3.3–$5.0, giving a cumulative of about $41–$43.
- The §6 rule says to stop and report at **$45** before creating any pod whose cap would take cumulative past $45.
- $37.67 + $4 (generation cap) + $6 (training cap) = $47.67, so this sequence **needs Justin's explicit go-ahead past the $45 line**, or lower caps.
- No pod has been launched. The network volume `airp-hx-train` (jq8pseh4f0) is kept.

**One variable per run (§5):** F1–F4 all change the head-extension data and F5 changes the CSE sampling. Justin may run them as one data-pack change, or split F5 into its own run. This is recorded in the DRAFT redeclaration.

## Housekeeping
- Box free space at 19:35 NPT: 66 GB (above 15 GB). No pruning done.
- Pods: none. Spend this step: $0.00.
