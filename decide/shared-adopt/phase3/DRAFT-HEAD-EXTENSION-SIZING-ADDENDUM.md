# Head-extension sizing addendum (DRAFT, UNSIGNED): the prerequisites the signed declaration lacked

> **Status: draft for Justin's signature. Nothing here runs until it is signed.** No pod, no spend, no code written
> (code comes after signature, tested before any pod). Drafted 2026-11-02 ~08:05 NPT from Justin's terms in t216u
> (2026-11-02 07:58 NPT).
>
> **Record.** The head-extension declaration (`DRAFT-HEAD-EXTENSION-DECLARATION.md`, signed t213u 01:57 NPT, commit
> `445afe4`, sha `8f136b26…`) was signed **without its prerequisites**. The pre-pod check found them missing and stopped
> (`HEAD-EXT-PREPOD-STOP-2026-11-02.md`, commit `89246117`, sha `3bd3c01f…`); Justin accepted the stop (t216u). This addendum
> **supplies** those prerequisites (stop report items 1–6 and rules 1–6). It **does not change** the signed V0–V3, C1–C4,
> N = 10 (seeds 60–69), selection or scoring bans. Where this file fills a gap the declaration left, the declaration's
> wording stands and this file adds to it. Where a term below needs a ruling, it is in §12 (open items), with a default
> that applies only if Justin signs it as written.

Pinned inputs: `EXTENSION-NY-HEADS.md` `5fdb03fe…`; `kind-label-table.json` `f24a475b…`; `vocabulary.json` `32917116…`;
data-v9 train `13c86ea7…` (7,386) / val `964c2b21…` (873); RH overlay val `a0b3b2f5…`; labeling guide `e5b7b56c…`;
composition 2a `59ddf1f6…`; split rule ADR `docs/decisions/2026-11-01-p33-validation-split-rule.md`; v3-safety eck ADR
(evaluator-suite `v3/docs/ADR-2026-11-02-v3-safety-trim-eck-deletion.md`, `1ee40eeb`); cross-side rules (evaluator-suite
`v3/labelcmp/AMENDMENT-2-CROSS-SIDE-RULES.md`).

## 1. Generator: Qwen3-30B (identity, licence, side)

| item | value |
|---|---|
| model | `Qwen/Qwen3-30B-A3B-Instruct-2507` (key `qwen3-30b-a3b-2507`; MoE, 30B total / 3B active; non-thinking only) |
| revision | `0d7cf23991f47feeb3a57ecb4c9cee8ea4a17bfe` (HF API `sha` for `main` read 2026-11-02 ~08:00 NPT = the pinned revision; lastModified 2025-09-17) |
| licence | **Apache-2.0.** Re-read this turn: card front matter `license: apache-2.0`; LICENSE at the pinned revision sha256 `05cab468…11d9`, **byte-identical** to `v3/policy/licenses/qwen3-30b-a3b-2507.LICENSE`; card README `5d25d4b4…9bb9e`, byte-identical to the pinned copy. Repo not gated. The card has no prohibited-use or acceptable-use section (searched for prohibit / acceptable use / restrict / misuse: none). |
| POLICY_VERIFIED | `role: train`, verdict `CLEAR`, no conditions (retrieved 2026-11-01). |
| proposed licence verdict for this use | **CLEAR** (generating classifier training and validation rows; no deployment of the generator). Box for Justin in the signature block. |

"Qwen3-30B" in t216u is read as this pinned Instruct-2507 checkpoint (the one already decided for the extension,
declaration §3.1), **not** the Base or Thinking-2507 variants. If Justin meant another checkpoint, that is open item 1.

**Side and its consequences (stated, not assumed).**
- Qwen is a **train-side** family (cross-side AMENDMENT-2 §3: qwen3-30b-a3b-2507 is a train-role writer). Every row it
  generates is **train-side data**: it may go into data-v10 train and data-v10 val (val is a split of the training corpus
  used for selection), and **never** into v3, v3-safety or any held-out/test set.
- **Same-family rule:** qwen3 must not label or adjudicate its own text. So the train-role trio (mistral, gemma,
  **qwen3**) is not used on these rows. Per AMENDMENT-2 §2, train-side text is checked by the **test-side pair**
  (nemotron-3-super primary, seed-oss-36b second). Here their outputs are used **only to delete rows** (eck, CSE,
  validity, §5); they never set gold (§7).
- **Independence doubts (flagged; open item 9):**
  1. qwen3 is the **adjudicator and third labeler** of the v3 test-side gold and labelled the v3-safety rows. Training the
     evaluator on qwen3-written text means a later v3 / v3-safety score is not fully independent of qwen3's reading of
     the same shapes. To be stated in any later error profile.
  2. The offer-shape training rows (§3.3) and the self_harm arms of the hate pairs (§3.4) are generated from the same
     shape descriptions (sh-02 offer, sh-01 encouragement) that v3-safety's `offer-shape`, `sh02-offer` and `sh01`
     families were derived from. v3-safety was declared "not from the training recipe"; after this phase the training
     recipe contains those shapes. The text-level leak check (§5 V-g) removes near-duplicates, but **shape-level overlap
     remains** and must be stated in v3-safety's error profile.
  3. The P3-3 ens5 teacher is not regenerated; new rows have no teacher targets (§8).

## 2. Groups, in-distribution and held-out (mechanical)

- **Group** (P3-3 split rule ADR §1, unchanged): `contrastGroup`, else `kind`, else `family`. Both arms of a contrast
  pair-unit move together.
- **In-distribution** for a head: the val row's group has ≥ 1 row in data-v10 **train**. **Held-out**: its group has 0
  train rows. Determined by code from the packed files, never by hand.
- **Per new head (default design):** **three or more groups carry val positives, and every one of them also has training
  rows**, so all of each head's val positives are in-distribution (≥ 2 positive kinds + 1 contrast group; see §3 tables).
  This satisfies "≥ 3 groups, one also in training" (it is ≥ 1) and the signed §1 floor (≥ 60 **in-distribution** val
  positives) at once. New heads therefore get **no held-out-group recall** in this retrain. A held-out group per head is
  the alternative in open item 3.
- **Held-out groups in this phase:** only `offer-terse` (§3.3) and the 16 P3-3 rows in `self-harm-named-method-offer`
  (that kind has 0 train rows in data-v10 under the group rule, so it stays held-out; open item 4).

## 3. Rows per head, per group, per split (targets, after all filters)

Template per head: positive kinds (P) train 80 / val 50, split evenly across the head's P kinds (remainder to the kind
listed first); contrast group (C) 30 pair-units train (60 rows) / **12 pair-units val** (24 rows); hard negatives (H)
train 60 / val 24. **Per head: train 200, val 98, val positives ≥ 62** (P 50 + C arm A 12). V2 at 12 pairs:
≥ floor(0.83 × 12) = **9 of 12** on every seed (signed rule; minimum six pairs per head met).
Cells inside each kind: register × length, registers in the fixed order **clinical, colloquial, terse** (alphabetical,
fixed now), lengths short (1–40 words), medium (41–120), long (121–250). Selection to the target is round-robin across
cells, lowest generation index within a cell (same rule as the v3-safety cap).

### 3.1 Eight heads: kinds, statute, labels (labels are slot-spec gold; existing-vocabulary primitives come from the slot spec)

| head | statute basis (from `EXTENSION-NY-HEADS.md`) | P kinds (val positives) | C group (val pairs) | H kinds (val rows) |
|---|---|---|---|---|
| `disordered_eating` (object) | N.Y. S9051-B § 1800(8)(i) ("endorsement or promotion of, or which facilitate … disordered eating"); `ny-s9051-B.txt` `50ade692…` | `ed-endorse` (endorses + ED) 25; `ed-encourage` (encourages + ED + directed_at_user) 25 | `ed-goal-vs-health` **(proposed; open item 2)**: arm A endorses/encourages + ED, arm B same stance and surface on health-directed eating/exercise, no object; 12 | `ed-mention` 8, `ed-class-refusal` 8 (both describes + ED + is_mention_not_use; **V3(a) rows, 16**), `ed-protective-describes` 4 (describes + ED), `nutrition-fact` 4 (no object) |
| `substance_misuse` (object) | § 1800(8)(i) ("unlawful drug or alcohol use, or drug or alcohol abuse") | `sub-endorse` 25; `sub-encourage` 25 | `sub-misuse-vs-prescribed` **(proposed; open item 2)**: arm A endorses/encourages + SM, arm B same stance on prescribed/lawful use as directed, no object; 12 | `sub-mention` 8, `sub-class-refusal` 8 (**V3(a) rows, 16**), `sub-harm-reduction-describes` 4, `medication-fact` 4 |
| `claims_relationship_role` | § 1800(8)(b) | `rr-role-claim` 17, `rr-authority-claim` 17, `rr-implied-role` 16 | `rr-claim-vs-deny`; 12 | `rr-role-denial` 8, `rr-roles-describes` 8, `rr-refer-to-professional` 8 |
| `frames_as_own_opinion` | § 1800(8)(c) | `op-personal-view` 25, `op-emotional-appeal` 25 | `op-own-vs-reported`; 12 | `op-reported-view` 8, `op-sourced-assessment` 8, `op-no-opinion-disclaim` 8 |
| `probes_user_emotion` | § 1800(8)(e) (the "unsolicited" part stays host input `host.emotion_content_unsolicited`) | `pe-feelings-question` 17, `pe-feelings-comment` 17, `pe-answer-to-emotional-prompt` 16 (fires the head per its definition) | `pe-probe-vs-task`; 12 | `pe-task-question` 24 |
| `encourages_secrecy` | § 1800(8)(j) | `sec-hide-chat` 17, `sec-isolate` 17, `sec-avoid-help` 16 | `sec-hide-vs-seek-help`; 12 | `sec-privacy-hygiene` 8, `sec-seek-help` 8 (also fires `refers_to_crisis_services`), `sec-mention` 8 |
| `refers_to_crisis_services` | Cal. SB 243 / Bus. & Prof. § 22602(b)(1) (`ca-sb243.txt` `6fbfcd67…`), widened to professional / trusted-adult help (Justin 2026-11-01; Utah § 13-72a-202(3), N.Y. (j)) | **real-referral cells**: `cr-hotline-referral` 10, `cr-text-line-referral` 10, `cr-emergency-referral` 10, `cr-professional-referral` 10, `cr-trusted-adult-referral` 10 | `cr-refer-vs-withhold`; 12 | **in-fiction cell** `cr-resource-in-fiction` 12 (**V3(c) rows**), `cr-resource-named-no-direction` 4, `cr-refusal-no-referral` 4, `cr-supportive-no-referral` 4 |
| `advertises_product` | Utah H.B. 452 / Utah Code § 13-72a-202(1) (`HB0452.pdf` `4a46dfa2…`) | `ad-direct-promo` 17, `ad-promo-code` 17, `ad-affiliate-style-rec` 16 — **fictional brands only** | `ad-promote-vs-mention` (same fictional product named neutrally); 12 | `ad-professional-referral` 12 (**V3(b) rows**; § 202(3), fires `refers_to_crisis_services`, not this head), `ad-neutral-mention` 4, `ad-factual-comparison` 4, `ad-self-feature-help` 4 |

Train splits follow the same proportions (P 80 over the P kinds, C 30 pair-units, H 60 over the H kinds, V3 kinds
≥ 20 train rows each). Exact per-kind and per-cell targets are written into the slot-spec file (§4) and asserted by
the pack builder; they are derived from this table by code, not chosen later.

**Head-specific rules.**
- **disordered_eating / substance_misuse:** the **only generated stances on rows carrying the object as a harm are
  `endorses` and `encourages`** (t216u). No `conveys_method` row is generated for any kind; the system prompt forbids
  method content; the eck deletion (§5) removes any that slips through. The `conveys_method` arm "from collected material
  only" is **empty in this retrain** (no collected train-role source is named; reported as empty, open item 10).
  Default reading: the `describes` rows in H (protective, mention, class refusal) are still generated, because V3(a)
  needs val `describes` + `is_mention_not_use` rows and they are not harm stances. If t216u meant that **no** generated
  row with these objects may carry `describes`, V3(a) has no rows and is NO_VALID_OUTPUT for (a): open item 1.
  These objects fire on any stance (EXTENSION definition), so `ed-*`/`sub-*` describes rows are object positives too.
  Minors: no row carries `subject_is_minor`; the minor test stays host input `host.covered_minor`.
- **advertises_product:** product and brand names come only from a **pinned list of invented names** in the slot spec
  (checked before pinning against a web search and a pinned real-brand denylist). Each row is assigned one name; a row
  that does not contain its assigned name, or contains any denylisted name, is dropped (§5 V-e). No real brand is
  promoted in any row.
- **refers_to_crisis_services:** real-referral cells name services only from a **pinned list of real services with their
  published contact strings** (default: 988 Suicide & Crisis Lifeline (US, call or text 988); Crisis Text Line (US, text
  HOME to 741741); emergency 911 / 112 / 999; Samaritans 116 123 (UK & ROI); plus generic licensed professional / school
  counsellor / trusted adult). A row naming a number or short code not on the list is dropped (§5 V-f). The **in-fiction
  cell** places the same resources inside a story addressed to a character (depicts), gold 0 for the head. List
  sources and jurisdictions: open item 11.

### 3.2 Totals for the eight heads
Train 8 × 200 = **1,600**; val 8 × 98 = **784**; val positives per head ≥ 62 (object heads ≥ 82 counting the describes
rows), all in-distribution; V2 pairs 12 per head; V3 condition rows: (a) 32 (bound at 0/32: 8.9 %), (b) 12 (0/12:
22.1 %), (c) 12 (0/12: 22.1 %), exact one-sided 95 % CP.

### 3.3 Offer-shape `self_harm` rows (three register sub-groups; held-out named now)
- Gold: stance `encourages`, object `self_harm`, no qualifiers (a method announced or offered, none delivered; ADR
  2026-11-01 sh-02 correction). Kinds = sub-groups by register, **slot-spec register order fixed now: `clinical`,
  `colloquial`, `terse`** (alphabetical).
- **Mechanical rule:** the held-out sub-group is the register listed **last** in the slot spec. With the order above it
  is **`offer-terse`**. The pack builder asserts `offer-terse` has 0 train rows and that the register list in the pinned
  slot spec equals this order.
- Rows: `offer-clinical` train 30 / val 8; `offer-colloquial` train 30 / val 8; `offer-terse` train 0 / val 16
  (held-out). **Train 60** (t216u "~60"), val 32 (16 in-distribution, 16 held-out). Cells = length only.
- Reporting (declaration §3.2): offer recall per seed and shipped artifact, in-distribution vs held-out, exact
  one-sided 95 % CP, and on the P3-3 16 against the declared P3-3 baseline **s50 8/16** (exact one-sided 95 % miss upper bound 72.1 %).
  Never a fail on its own.

### 3.4 Hate-eliminationist matched pairs for the `self_harm` object
- New contrast group `hate-elim-vs-self-harm`, **20 pair-units**. Arm `hate`: eliminationist wish against a protected
  group, labels as kind `hate-eliminationist` (endorses + targets_protected_characteristic), **gold self_harm = 0**.
  Arm `selfHarm`: matched surface form and hostility aimed at the addressee's own life, labels as kind `hate-vs-sh-sh`
  (encourages + self_harm, no method, no qualifiers). Shape as existing `contrast-hate-sh.json`, restricted to the
  eliminationist hate arm.
- Split: **12 pair-units train (24 rows), 8 val (16 rows)**, ordered by sha256(`airp-headext-v10`|group|index) (P3-3
  resplit convention). The group is in-distribution. Hate arms sit in the C4 denominator and are reported separately
  (as in P3-3); the 8 selfHarm val arms join self_harm's in-distribution positives for C1–C3 on data-v10. V1 is on the
  original 873 and is unaffected. Split alternative: open item 5.

### 3.5 Grand totals (targets after filters)
| block | train | val |
|---|---:|---:|
| eight heads | 1,600 | 784 |
| offer-shape | 60 | 32 |
| hate-elim pairs | 24 | 16 |
| **new rows** | **1,684** | **832** |
| data-v9 existing | 7,386 | 873 |
| **data-v10** | **9,070** (× 1.228) | **1,705** (× 1.953) |

Generation quota: **1.3 × target per kind** (≈ 3,270 candidates). Valid rows above target go to a separate **sealed,
unused reserve** with its own sha (as v3-safety); using it needs a signature.

## 4. Slot specs (statute-derived, pinned separately)
- One new file, `decide/shared-adopt/phase3/headext/headext-slot-spec.json`, separate from `recipe.json`, the
  `contrast-*.json` files and the v3 specs. It holds, per kind: the statute clause it serves (§3.1 column), the
  existing-vocabulary primitives and the new-head labels it implies, deciding feature (contrast kinds), content rules,
  register order (`clinical`, `colloquial`, `terse`), length bands, per-cell targets, quotas, the fictional-brand list,
  the real-service list, sampling (temperature 0.9, max_tokens 400, thinking off) and the system-prompt file sha.
- Content rules in the spec (enforced by prompt and by §5 filters): no method content (no tool, substance, dose,
  quantity, location or step); no minor named, no sexual content, no romantic-sexual role (relationship-role rows are
  non-sexual); offer rows name availability only (sh-02 rule); fictional brands only; real services only from the list.
- Labels for every new kind are added to `kind-label-table.json` as new entries (existing entries unchanged) and
  produced by `relabel-from-slots.mjs`. The spec, system prompt and generator code shas are pinned in a pre-generation
  record (no rule change) before the generation pod.

## 5. Generated-row filters: validity bar, eck, CSE (all generated rows; deletions logged)
Applied by code to **every generated row**, in this order. Labeler outputs (test-side pair, §1) only remove rows.
| step | rule | action |
|---|---|---|
| V-a | non-empty; `finish_reason = stop` (not length-capped); word count inside the cell's band | drop (kept in archive, id + reason logged) |
| V-b **CSE** | either labeler marks `subject_is_minor` together with `sexual_activity` | **delete unviewed** from set and archive; id + trigger logged (declared exception to archive-before-terminate, same form as S3/v3-safety) |
| V-c **eck** | either labeler marks `exceeds_common_knowledge` | **delete unviewed** from set and archive; id + trigger logged; **generated rows only** (v3-safety eck ADR form). Applies to all generated rows of every kind, not only safety kinds |
| V-d stance validity | slot stance endorses/encourages and **both** labelers return `describes` + `is_mention_not_use` (generator refusal); or slot stance describes and both return endorses/encourages/conveys_method | drop, logged |
| V-e brand | `ad-*` rows: assigned fictional name present, no denylisted name | drop, logged |
| V-f referral | `cr-*` real-referral rows: every number/short code is on the pinned list | drop, logged |
| V-g leak | in-set collision (`airp_v3.inset`, keep lower id); blind leak check (hash in, ids out) against data-v9 train+val, v2 held-out suite, v3 sealed, v3-safety seal `2dc0e7d8…` and reserve `ee7a4658…` | drop colliding ids; protected checks run on the VPS (protected files exist only there) |

Either-labeler (OR) triggers make V-b/V-c conservative. Invalid labeler outputs count as "flag" for V-b/V-c (delete) and
as "no vote" for V-d. Nobody views safety-class item text at any step; the six non-safety qualifier heads' text is also
not reviewed by hand in this phase (no review sample; open item 6).

**What counts as a positive.** A row is a positive for a head when its **slot-spec gold** sets that primitive to 1
(object heads: object present at any stance; qualifier heads: qualifier present) **and** it passed V-a…V-g. The ≥ 60
floor counts such val rows whose group is in-distribution (§2), per head, from the packed file, before the training pod.

## 6. Existing rows: no model relabeling
- **No model labels any existing data-v9 row.** Existing rows' 17-head labels are unchanged, except the 20 val rh-denial
  rows, which take the signed RH gold overlay (`a0b3b2f5…`; declaration §3.4; a ruling, not a model relabel).
- **New heads on existing rows = 0**, except where a **kind-table rule** maps a whole existing kind. **Default rule list:
  empty** (all 8,259 existing rows are 0 on all eight heads). Candidate kinds Justin may add (counts only, data-v9):
  `clean-crisis-warm` (32 train / 0 val; spec note says "a practical human referral") → `refers_to_crisis_services`;
  `clean-redirect` (1,560 / 36), `r13-sh-crisis` (4 / 0) → same head, but their specs mix referral and refusal so a
  whole-kind rule would be wrong on some rows; `rh-hook` (0 / 20) and `relational_hooks-*` → `claims_relationship_role`;
  `persona_claims-*` / `pc-*` → `frames_as_own_opinion`. Open item 7 (including a "mask" option: exclude listed kinds
  from the new head's loss and V2 scoring instead of forcing 0).
- **Test (before any pod):** loads data-v10, asserts every existing row's eight new-head labels equal the signed rule
  list's output (0 unless the kind is listed), asserts the 17-head labels of existing rows are byte-identical to
  data-v9 except the 20 overlay rows, and fails on any other difference.

## 7. Gold and pack (data-v10)
- Gold for new rows = slot-spec primitives only; classes derived at load (`p32_val`, assertions); no stored class key.
- Built on the **box, $0**: data-v9 + §3 rows + RH overlay → `data-v10/{train,val}.jsonl`; leakage asserts (no id on
  both sides, 0 exact-content duplicates across sides, coverage rule, `p32_val` passes); per-head in-distribution val
  positive counts; V2 pair counts (≥ 6 per head); offer-terse 0 train; register order assert; V3 condition row counts.
  Protected leak checks on the VPS, $0. Pack sha recorded in a pre-training-pod record (no rule change), pushed,
  `ls-remote`, VPS archive `sha256sum -c`.

## 8. Training (signed recipe, N = 10, seeds 60–69)
- P3-3 recipe: A2 schedule, head-init seed 7, within-run average ep 2.0–4.0. 25 heads = 17 + the heads that meet the
  floor. Soft-mix 0.5 on the 17 for **existing** rows (ens5 teacher not regenerated). **New rows have no teacher targets:
  hard labels on all heads.** New heads: hard labels on all rows.
- Head init: the 17 existing head rows must be byte-identical to P3-3's `init_head_sha256 10a35c79…` init; new heads are
  initialised after, from a separate generator seeded 7. Test asserts both; the 25-head init sha is recorded for V0.

### 8.1 Do 10 seeds fit $6 and 90 minutes? **Cost yes; time no on one pod.**
P3-3 actuals (pod `7erazwt02px65i`, RTX 4090 SECURE $0.89/h, 7,386 train / 873 val): per seed 7.13, 7.25, 7.18, 7.15,
7.27, 7.40, 7.27, 7.32, 7.18, 7.13 min (mean **7.23**, from `RUN_START`/`RUN_DONE` markers); setup 3.4 min; close-out
to terminate 6 min; 81.5 GPU-min, $1.21.
Scaled to data-v10 (train × 1.228, val × 1.953), assuming 20 % of a run is val inference (8 checkpoint val passes +
final): **≈ 9.9 min/seed** (8.9 if val time is negligible, 10.4 at 30 %).

| plan | wall | GPU $ (4090 $0.89/h) | fits 90 min? | fits $6? |
|---|---:|---:|---|---|
| one pod, 10 seeds | ≈ 108 min (best case 98) | ≈ $1.61 | **no** | yes |
| **two pods, seeds 60–64 then 65–69 (default)** | ≈ 59 min each | ≈ $0.87 each, ≈ $1.75 total | yes | yes (per-pod cap $3, sum $6) |
| one pod, faster GPU (e.g. RTX PRO 6000 $2.49/h) | unmeasured | ≈ $2.5–3 if ≈ 1.6× | unknown | yes |
| one 4090 pod with a 120-min cap | ≈ 108 min | ≈ $1.61 | needs a cap change | yes |

**Default (open item 8):** two sequential 4090 pods, 5 seeds each, same image, pack and code; each pod has its own
90-min / $3 cap and both watchdogs; the second starts only after the first is archived and terminated and the headroom
check passes. Selection and V0–V3 run after both, on all 10. The split is not a training variable (seeds are
independent runs), but the two pods may land on different physical GPUs (bf16 nondeterminism), which P3-3 did not have.

## 9. Generation phase (Qwen3-30B), pods and cost
Generation and the filter labeling run on RTX PRO 6000 SECURE ($2.49/h, as v3-safety). Estimate from prior pods:
qwen3 load ≈ 5 min, ≈ 3,270 candidates ≈ 5–10 min; seed-oss-36b labeling ≈ 8 min load + ≈ 15 min (5,723 rows took a
34-min pod); nemotron-3-super ≈ 13 min load + ≈ 15 min; archive ≈ 5 min. Total ≈ 75 min on one pod: too close to 90.
**Default:** pod G1 = generate + seed-oss labels (≈ 45 min, ≈ $1.9); pod G2 = nemotron labels (≈ 35 min, ≈ $1.45).
**Phase cap $4 across G1 + G2**: G2's own cap = $4 − G1 actual, and G2 is not created if that is under its estimate.
Each pod also has the 90-min cap and both watchdogs.

## 10. Cost against the caps (GPU; balance per ledger row t215u-trim, 2026-11-02 ~07:35 NPT)
| item | cap | estimate | cumulative GPU after, at cap | after, at estimate |
|---|---:|---:|---:|---:|
| now | – | – | **$27.63** of $60 | $27.63 |
| generation phase (G1 + G2) | **$4** | ≈ $3.35 | $31.63 | ≈ $30.98 |
| pack build (box) + protected leak check (VPS) | $0 | $0 | $31.63 | ≈ $30.98 |
| training (T1 + T2, N = 10) | **$6** ($3 + $3) | ≈ $1.75 | **$37.63** | ≈ $32.73 |
| stop-and-report line | $45 | | $7.37 under | |
| ceiling | $60 | | | |
RunPod balance ≈ **$33.28** now; ≈ $23.28 left if every cap is hit (network-volume storage and billing lag come on top).
Headroom check before **every** pod: pods = [] (REST and GraphQL); cumulative GPU + this pod's cap ≤ $45 (else stop and
report); balance ≥ $10; disk/volume free ≥ 20 GB for training (P3-3 left 28 GB; 10 finals + 10 artifacts ≈ 17 GB).
One pod at a time. Cap order as sealed: $60 ceiling, stop-and-report at $45.

**Archive and terminate (unchanged from the signed §6).** Outputs to `/root/primitives-evaluator/headext-20261102/…`
with a manifest; `sha256sum -c` on the VPS **before** terminate; CSE/eck deletions are the declared exceptions (deleted
unviewed, ids + trigger logged). Terminate within 15 min of completion or failure; confirm pods = [] via REST and
GraphQL; ledger row + STATUS-RESUME.md after each step. Weights stay on network volume `rmn62wuuzx` under the volume
manifest. VPS never rebooted.

## 11. Pre-declared rules (restated so nothing is decided after a run starts)
1. **Validity bar:** §5 V-a…V-g, applied by code, every drop logged by id and reason.
2. **Positive:** §5 last paragraph. Floor ≥ 60 in-distribution val positives per head; below it the head is dropped
   from this retrain, not trained small (signed §1).
3. **Shortfall:** per kind / cell counts below target are **reported**; no backfill across kinds, no second generation
   pass, no change of quotas, groups, floors or filters. Widening anything needs a new signature. A head that still has
   ≥ 60 in-distribution val positives and ≥ 6 val pairs trains even if some cells fell short.
4. **Selection on validation only** (data-v10 val; V1 on the original 873 under the RH overlay; signed §5).
5. **Never score on v3 or v3-safety** for selection, gating or this phase's outcome.
6. **No CSE-exhibiting content.** No head is CSE-adjacent. No slot names a minor or asks for sexual content; relationship
   roles are non-sexual; `subject_is_minor` is never a slot label; V-b deletes any CSE-triggered row unviewed. No item
   text in any commit; counts and ids only.
7. One variable per run; no rule amended after its run starts; stop if a rule has no valid output.

## 12. Code to write after signature (all tested on synthetic benign data before the generation pod)
1. `headext_slots.py` + `headext-slot-spec.json` loader/generator driver (cells, quotas, register order, brand and
   service lists, system prompt sha; refuses OpenAI and non-self-hosted URLs; same-family refusal).
2. `headext_filter.py`: V-a…V-g, OR triggers, deletion logs (ids, trigger, row sha), reserve sealing.
3. `build_data_v10.py`: pack builder, split by sha256 ordering with pair-units, overlay, all §7 asserts, kind-table
   rule test (§6).
4. 25-head training changes (`train_shared.py` / pipeline): hard-label new rows, soft-mix only where teacher targets
   exist, head-init invariance test, per-head floor gate, two-pod seed split.
5. `score_v2_pairs.py`: per-head pair separation with the 6 / floor(0.83 n) rule, every seed.
6. `score_v3_guard.py`: conditions (a)(b)(c), median / worst / shipped, exact one-sided CP bounds.
Benign fixtures only (e.g. weather and recipe text, invented brands); no safety text in tests.

## 13. Open items for Justin (defaults apply only if signed as written)
1. **ED / substance stances.** Default: harm-stance rows generated only as endorses / encourages; `describes` rows
   (protective, mention, class refusal) still generated (needed for V3(a)). Alternative: no `describes` rows with these
   objects → V3(a) has no rows. Also confirm the generator is `Qwen3-30B-A3B-Instruct-2507 @0d7cf239`.
2. **V2 pairs for the two object heads.** The approved `ed-promote-vs-protect` / `sub-promote-vs-harm-reduction` pairs
   hold the object constant, so an object head is 1 on both arms and can never separate them (V2 would fail by
   construction). Default: object-deciding groups `ed-goal-vs-health` / `sub-misuse-vs-prescribed`; the protect / harm-
   reduction rows move to H. Alternative: score V2 for these heads on the composed (i) predicate instead.
3. **Held-out group per new head?** Default none (all three groups in-distribution). Alternative: one extra val-only
   group per head (≈ 16 val rows each, ≈ +128 val rows, ≈ +$0.15 generation).
4. **Offer.** Default reading of "~60": 60 train rows in clinical + colloquial; `offer-terse` val-only (16) is the
   held-out sub-group; the P3-3 16 stay held-out (their kind has no train rows). Confirm, or say if the 60 includes val.
5. **Hate pairs split** 12 train / 8 val pair-units (default) vs all 20 in val.
6. **Review sample.** Default: no hand review of generated text (filters only). The recipe's `reviewFloors` (≥ 10 per
   kind) could apply to the six non-safety qualifier heads, reviewed by Zimmer, if you want it.
7. **Kind-table rules for existing rows.** Default: empty list. Add `clean-crisis-warm` → `refers_to_crisis_services`?
   Use "mask" instead of 0 for mixed kinds (`clean-redirect`, `rh-hook`, `relational_hooks-*`, `persona_claims-*`)?
8. **Training pods.** 10 seeds do not fit one 90-min 4090 pod (≈ 108 min). Default: two pods (60–64, 65–69), $3 cap
   each. Alternatives: one pod with a 120-min cap, or a faster GPU (unmeasured, GPU-type change vs P3-3).
9. **Independence.** Accept that qwen3 (v3 adjudicator / v3-safety labeler) writes training text and that offer / sh
   shapes now appear in both training and v3-safety; to be stated in both error profiles.
10. **`conveys_method` arm for ED / substance:** empty in this retrain (no collected source named). Confirm.
11. **Real-service list** (§3.1): confirm the services and jurisdictions.
12. **Labelers for the filters:** test-side pair nemotron-3-super + seed-oss-36b, OR rule, delete-only (default);
    generation phase as two pods under one $4 cap.

## Signature
- [ ] Signed: Justin Flores — date / time (NPT): ________
- [ ] Generator `Qwen/Qwen3-30B-A3B-Instruct-2507 @0d7cf23991f4…` licence verdict: [ ] CLEAR (Apache-2.0; card has no
  prohibited-use list; training-data generation only, no deployment) [ ] other: ____
- [ ] Rows and groups as §3 (or amended): ____
- [ ] Held-out offer sub-group = last register in slot-spec order `clinical, colloquial, terse` → `offer-terse`
- [ ] Open items 1–12: defaults accepted / amended: ____
- [ ] Training pod plan: [ ] two pods × 5 seeds ($3 + $3) [ ] other: ____
- [ ] Caps: generation phase $4; pack $0; training $6; per pod 90 min, both watchdogs; stop-and-report $45
- Order after signature: code + tests (no pod) → pre-generation pin record → G1 (→ G2) → filters + pack + asserts →
  pack pin record → T1 → T2 → REPORT-HEAD-EXT.
