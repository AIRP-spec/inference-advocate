# Corpus round proposal (follow-up Task 5). Read only: no rows written

Date 2026-10-11 (NPT). **This is a proposal. No corpus row, suite item, label file, threshold or gold proxy was written or edited. No inference, no GPU, no pod.** Inputs are the per-item primitive outputs already gated on the held-out v2 suite (n = 471) for the shared-encoding model (3b run A) and for Laya.

Method = `decide/adopt/PER-PRIMITIVE.md` (settled proxies `b086cdac…`, gold logic copied verbatim, self-check that the 11 settled per-primitive rows recompute exactly from each gate JSON; it passed for all 7 checkpoints), re-run for the shared model by `decide/followup/proposal/per-primitive-shared.mjs` (the rule is in its header, written before the shared numbers were computed). Data: `proposal/PER-PRIMITIVE-SHARED.json`.

## Definitions (fixed before scoring)

- Per primitive and checkpoint on v2: **over-fires** if FP > FN; **under-fires** if FN > FP; neither if FP = FN.
- **Shared model, converged checkpoints = run A epoch 2.0 / 2.5 / 3.0 (steps 456 / 570 / 681)**, the same set the 3b declaration used for the CSE bar. (Run B has no CSE-passing converged checkpoint and was not selected.) **"Fails on every converged checkpoint" = over-fires on all three, or under-fires on all three.** A primitive that errs on all three with the direction flipping is reported separately and not listed.
- Laya comparison: selected 5766 (reference only) and converged 7688 / 9610 / 10099, same rule (this reproduces the earlier PER-PRIMITIVE.md list exactly).
- Stance rows are scored on the 122 stance-determined items only. The three CA objects are covered only by the settled composite `any(financial_crime, intrusion, weapons)`.

## Correction to the brief's number

"20–29 false fires on 5766" is the range on Laya's **converged** checkpoints (29 / 23 / 20). **5766 itself has 9** false fires on `addresses_own_nature` (FN 3).

## Side by side: what fails, shared model vs Laya (v2, cell = FP, FN)

| primitive | shared A2.0 | A2.5 | A3.0 | fails on every converged (shared) | 5766 | Laya 7688 | 9610 | 10099 | fails on every converged (Laya) |
|---|---|---|---|---|---|---|---|---|---|
| object:profanity | 4,0 | 3,0 | 3,0 | over | 2,0 | 4,0 | 3,0 | 3,0 | over |
| object:self_harm | 0,2 | 0,2 | 0,2 | **under** | 0,0 | 0,2 | 0,1 | 0,1 | under |
| object:sexual_activity | 3,1 | 4,1 | 4,1 | over | 4,1 | 5,1 | 4,1 | 6,1 | over |
| object:violence_person | 2,0 | 1,0 | 1,0 | over | 3,0 | 2,0 | 2,0 | 2,0 | over |
| qualifier:addresses_own_nature | 3,2 | 4,1 | 4,0 | over | 9,3 | 29,2 | 23,2 | 20,2 | over |
| qualifier:directed_at_user | 3,0 | 4,0 | 6,0 | over | 9,0 | 7,0 | 5,1 | 8,0 | over |
| qualifier:targets_protected_characteristic | 0,5 | 0,3 | 0,1 | **under** | 0,1 | 0,1 | 0,1 | 1,1 | not consistent |
| qualifier:untethered_to_content | 2,0 | 2,0 | 2,0 | **over** | 0,3 | 0,3 | 2,3 | 2,3 | **under** (opposite direction) |
| stance:encourages | 3,0 | 3,0 | 3,0 | **over** | 2,0 | 0,1 | 0,1 | 1,1 | not consistent |
| stance:conveys_method | 0,3 | 0,3 | 0,2 | **under** | 0,2 | 0,0 | 0,0 | 0,1 | not consistent |
| composite any(financial_crime, intrusion, weapons) | 0,2 | 0,5 | 1,2 | under | 2,4 | 2,7 | 3,4 | 2,6 | under |
| qualifier:exceeds_common_knowledge | 3,3 | 7,2 | 7,2 | not consistent (tie at 2.0) | 5,2 | 4,3 | 10,2 | 7,3 | over |
| stance:describes | 0,0 | 0,0 | 0,1 | not consistent | 0,0 | 1,0 | 1,0 | 1,0 | over |
| qualifier:asserts_interior_state | 4,2 | 1,3 | 0,4 | errs on all three, direction flips | 3,1 | 4,0 | 3,1 | 2,2 | not consistent |
| qualifier:subject_is_minor | 0,0 | 0,0 | 0,0 | not consistent | 0,0 | 0,0 | 1,0 | 1,0 | not consistent |

Reading the side by side:
- **The round is not model-specific for 8 of the 10 Laya entries.** Profanity, self_harm, sexual_activity, violence_person, addresses_own_nature, directed_at_user, untethered_to_content and the CA composite fail on every converged checkpoint of **both** models.
- **Shared-only:** `targets_protected_characteristic` (under, 5 / 3 / 1 misses, all hate-slur positives) and the stance pair `encourages` (over) / `conveys_method` (under), which are the same three violence items confused with each other.
- **Laya-only:** `exceeds_common_knowledge` (shared is over-firing at 2.5 and 3.0 with 7 FP, tied at 2.0, so it narrowly escapes the rule) and `stance:describes` (a single false fire on Laya, noise).
- **`addresses_own_nature` is much smaller on the shared model** (3 / 4 / 4 false fires, precision 0.85–0.88) than on Laya's converged checkpoints (20–29, precision 0.43–0.52). Its false-fire items on 5766 and on the shared model do **not overlap at all** (0 shared items between shared A2.5 and 5766), and Laya's converged-checkpoint false fires have 0 items in common with the shared model's stable ones. So the errors move with the model and checkpoint: the boundary is not learned in either, and only the size of the problem differs.
- **`self_harm` is the reverse:** 5766 has no miss, the shared model misses the **same two items on all three converged checkpoints**, and Laya's converged checkpoints miss 2 / 1 / 1. A selected-checkpoint comparison hides this; the shared model's recall on this object is 0.917 where 5766's is 1.00.

## Sizing rule (applied mechanically, then three stated adjustments)

Let e = the **median over the three converged checkpoints of errors in the failing direction**. Base rows: e = 1 → 4; e = 2–3 → 6; e = 4–6 → 12; e ≥ 7 → 24 (no shared entry reaches 7). A "row" is one training example in a minimal-pair set, so 6 rows is three pairs. Adjustments: (a) **safety priority ×2** (self_harm, treated like CSE: safety-critical misses outrank precision fixes); (b) **main target ×2** (`addresses_own_nature`, because its boundary moves between models as shown above); (c) the stance pair is **merged** into one set of 8 because both entries are the same three items. Nothing else is adjusted. A primitive wrong on two items gets a handful of rows, not dozens.

## Proposal (sized for the shared-encoding model)

Priority tiers: **T1 safety-critical recall** (self_harm); **T2 recall** (CA composite, `targets_protected_characteristic`); **T3 precision**. Order of authoring follows tiers.

| primitive | shared-model errors per converged ckpt (A2.0 / A2.5 / A3.0, FP,FN) | 5766 (FP,FN) / Laya converged 7688-9610-10099 | contrast shape (same subject, the distinction varied) | proposed rows | reasoning | safety priority flag |
|---|---|---|---|---:|---|---|
| object:self_harm | 0,2 / 0,2 / 0,2 | 0,0 / 0,2 · 0,1 · 0,1 | One self-harm subject, voice varied: an assistant that encourages or instructs toward self-harm, and one that crosses the line inside an otherwise supportive-looking frame (positives, 8 rows: 4 encouragement variants, 4 boundary-over variants) against the same subject in a supportive / recovery / crisis-resource / neutral-statistics voice (hard negatives, 4 rows). Weighted 2:1 to positives on purpose. | **12** | e = 2 → base 6, ×2 for safety. Same two items missed on all three converged checkpoints (a boundary-over item and an encouragement item, by metadata only), and 5766 does not miss, so this is a recall regression of the shared model relative to the incumbent that the rule did not measure. No false fires on any checkpoint, so negatives are limited to hard negatives that keep precision. After retraining, gate it like CSE: a named self_harm check across all converged checkpoints. | **YES (T1, like CSE)** |
| qualifier:addresses_own_nature | 3,2 / 4,1 / 4,0 | 9,3 / 29,2 · 23,2 · 20,2 | One assistant utterance about itself, with the distinction varied. Negatives (14): a plain, minimal or clean disclosure of what the assistant is or can do, and a sycophantic or boundary reply that merely says "I" without addressing its own nature. Positives (10): the same disclosure with the persona / simulation blur (clever-register persona claims). Authored as 12 pairs. | **24** | e = 4 → base 12, ×2 as the main target. Stable false fires are plain-disclosure counters and sycophancy boundary items (class metadata only); misses are persona-claim "register-clever" positives. Largest failure on Laya (20–29), smaller on the shared model (3–4), with zero item overlap between models, so the boundary needs examples, not a threshold change. | no (T3) |
| qualifier:directed_at_user | 3,0 / 4,0 / 6,0 | 9,0 / 7,0 · 5,1 · 8,0 | The same availability or offer ("here if you need anything", tool availability, denial of attachment) delivered neutrally vs with relationship-cultivating address to the user, same wording where possible. | **12** | e = 4 → 12. Stable false fires are relational_hooks counters and boundary-under items (no-cultivation, tool-availability-neutral, denial). Misses 0 on every checkpoint, so only negatives and their close positives are needed; 6 negative / 6 positive pairs. | no (T3) |
| object:sexual_activity | 3,1 / 4,1 / 4,1 | 4,1 / 5,1 · 4,1 · 6,1 | One sexual-adjacent subject with whether sexual activity is depicted or discussed varied (explicit / implicit / non-sexual mention / slur or insult with no sexual activity). | **12** (6 contingent) | e = 4 → 12. **Triage first:** two of the four false-fire items are CSE-class and hate-class items, where the settled proxy may simply not call the object (a scope question about the proxy, to settle in the generating code, not by rows). If triage says proxy scope, drop 6 rows. One stable miss on an explicit sexual_content item. | no (T3) |
| composite any(financial_crime, intrusion, weapons) | 0,2 / 0,5 / 1,2 | 2,4 / 2,7 · 3,4 · 2,6 | One criminal-assistance topic at two levels: operational specifics vs general / educational / harm-reduction level, for weapons first, then intrusion and financial crime. Positives from weapons and boundary-over items, matching negatives. | **6** | e = 2 → 6. Stable misses: a weapons positive and a criminal_assistance boundary-over item. It is a composite of three objects that are not individually assessable under the settled proxies, so the rows must be labelled per object in the generating code, weapons first. Misses outrank false fires. | no, recall-type (T2) |
| qualifier:targets_protected_characteristic | 0,5 / 0,3 / 0,1 | 0,1 / 0,1 · 0,1 · 1,1 | The same hateful claim with the targeted group named, implied or absent, and slur vs non-slur wording. | **6** | e = 3 → 6. All misses are hate-slur positives; falls 5 → 3 → 1 with training, so it may self-correct; 0 false fires. | no, recall-type (T2) |
| object:profanity | 4,0 / 3,0 / 3,0 | 2,0 / 4,0 · 3,0 · 3,0 | The same sentence where profanity is used by the assistant vs where the assistant refuses or deflects (no profane word emitted) vs where a profane word is only mentioned or quoted. | **6** | e = 3 → 6. Stable false fires are two refusal counters and one boundary-under item. Zero misses. | no (T3) |
| qualifier:untethered_to_content | 2,0 / 2,0 / 2,0 | 0,3 / 0,3 · 2,3 · 2,3 | One praise or agreement reply, tethered to specific content in the user's message vs free-floating generic praise. Two-sided on purpose: **5766 and Laya under-fire here (3 misses) while the shared model over-fires.** | **6** | e = 2 → 6 (3 pairs). Two false fires on the same two sycophancy boundary-under items. Opposite direction on Laya, hence both polarities. | no (T3) |
| stance:encourages / stance:conveys_method (one confusion) | encourages 3,0 / 3,0 / 3,0; conveys_method 0,3 / 0,3 / 0,2 | 2,0 / 0,1 · 0,1 · 1,1 and 0,2 / 0,0 · 0,0 · 0,1 | One violent-act subject, assistant posture varied: step-by-step method vs urging or cheering the user on vs depicting vs neutral description (2 rows per stance). | **8** (contingent) | Each is e = 3 (→ 6 + 6) but they are the same three violence items confused with one another, so one merged set of 8. **Triage first:** stance gold on these items comes from the class-to-stance mapping for items whose class set has two entries, so check whether it is a mapping question before authoring. | no (T3) |
| object:violence_person | 2,0 / 1,0 / 1,0 | 3,0 / 2,0 · 2,0 · 2,0 | One violent subject with the target varied: a person vs the user themself vs a group in a hate context vs property. | **4** (contingent) | e = 1 → 4. False fires are on a self-harm encouragement item and a hate item (metadata only), so likely a scope question as for sexual_activity; triage before authoring. | no (T3) |

**Total proposed rows (shared-sized): 96.** Of these **18 are contingent on label/proxy triage** (sexual_activity 6, stance pair 8, violence_person 4), so the **firm total is 78**. By tier: T1 12, T2 12, T3 72 (of which 18 contingent).

Tier ordering note: self_harm gets 12 rows for two errors (6 per error), the same per-error rate as the main target, deliberately. `addresses_own_nature` gets the most rows (24) because it is the named main target, not because the shared model fails it the most.

### If Justin keeps Laya (side-by-side, same sizing rule)

The same rule applied to Laya's converged counts gives 126 rows: addresses_own_nature 24, directed_at_user 24, exceeds_common_knowledge 24, sexual_activity 12, CA composite 12, self_harm 8, profanity 6, violence_person 6, untethered_to_content 6, stance:describes 4. The shared-model list adds `targets_protected_characteristic` and the stance pair; Laya's adds `exceeds_common_knowledge` and `stance:describes`.

**Either-way supplement (not in the 96):** to make the round robust to the adoption decision, add **12 rows for `qualifier:exceeds_common_knowledge`** (same technical subject stated at a commonly known level vs a specialised level; the shared model's false fires, 3 / 7 / 7, cluster on self-harm instruction positives and a criminal-assistance register-blunt counter, by metadata) and **4 for `stance:describes`**. Both are below the rule for the shared model (tie at 2.0; one miss at 3.0), so they are judgment adds, half the rule's value for exceeds_common_knowledge (rule value 24). **Round with supplement: 112 rows (94 firm).** `qualifier:asserts_interior_state` errs on all three shared checkpoints with the direction flipping (4,2 / 1,3 / 0,4), so it is **not** listed under the rule; flagged as a watch item and given no rows.

## Caveats

- **Primitives with 1–3 errors per checkpoint are noisy single-seed evidence.** That is most of this table: self_harm (2), violence_person (1), untethered_to_content (2), composite (2–5), profanity (3), stance pair (2–3), targets_protected_characteristic (1–5), and the single-error stance:describes. One seed, one training schedule, one best-of-12 checkpoint family; the three converged checkpoints of one run are not independent, so "fails on all three" is weaker than three seeds would be. The self_harm pair of misses is the same two items on all three, which shows stability within this run, not a repeatable property of the shared-encoding approach. The row counts are sized to that: a few contrast rows, not corrections.
- The ~24 gold positives per primitive mean one item moves recall by about 4 points.
- Some listed errors may be scope or proxy questions rather than model errors (flagged contingent above). Per the standing rule, **label problems are fixed in the generating code, never in derived files**, and decided before rows are authored.
- **Held-out leakage guard.** The proposal uses only item class / family / kind metadata and the error counts. It does not copy or paraphrase suite text. The new rows are **training corpus only**: no hand-authored gold on the certification suite and no suite edit. New rows must be authored from the taxonomy definitions, and pass the existing leak audit (`LEAK-AUDIT-RESULTS.md`) against the held-out suites before they enter training, and the model be retrained and re-gated on the unchanged suite, with the single-seed spread unmeasured.
- Using the v2 error pattern to choose where to add training data means v2 is no longer a clean held-out measure of the round's effect; any claimed improvement should be confirmed on a suite built independently of this error list.
- The CSE gate and the declared decision rule are unchanged by this proposal.

## Checksums

`CORPUS-ROUND-PROPOSAL.md` and its inputs are listed in `SHA256SUMS.followup-final`. Script `proposal/per-primitive-shared.mjs` sha256 `414e33ba…ff63`, data `proposal/PER-PRIMITIVE-SHARED.json` sha256 `e3a2ca60…3fd`.
