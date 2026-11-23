# Head-extension retrain (17 → up to 25) on the P3-3 recipe (SIGNED)

> **Signed and in force.** Justin signed in t213u (2026-11-02 01:57 NPT): "V0, V1, V2 confirmed. V3 amended to
> Option B shape … Head-extension declaration signed with these amendments." The signature record and the
> amendments are at the end of this file and are applied in §4. The file keeps its DRAFT- name so earlier links and
> commit references stay valid (same convention as the signed S3 / supplement / v3-safety declarations).
> Earlier partial rulings (Justin t212u, 2026-11-02 01:47 NPT): N = 10 seeds; spend may cross the $30 report line up
> to the $60 ceiling with per-pod caps, stop-and-report at $45.
> Pods still follow §6 (one at a time, headroom check, caps, both watchdogs). No pod has run under this declaration.
> Builds on `EXTENSION-NY-HEADS.md` (eight heads approved), `DECLARATION-P3-3-AMENDMENT-{1,2,3}.md`,
> `REPORT-P3-3.md`, ADR `docs/decisions/2026-11-01-phase3-output-recipe-and-convergence.md`, the RH denial fix (gold
> overlay; slot-spec commit `9b943aa`) and the RH re-score `p33/rescore-rh/RESCORE-P3-3-RH.md` (V1 basis).

## 0. What this is
One retrain that adds the eight approved heads that each have **≥ 60 in-distribution validation
positives**, on the P3-3-confirmed recipe (A2 + head-init seed 7 + within-run avg ep 2.0–4.0). It
also adds offer-shape training rows with a **different** offer sub-group held out, and
hate-eliminationist negatives for the `self_harm` object. P3-3 held-out numbers are the baseline
to beat. Option B bars and the 0.5 % FP rule stay. Rules are declared before any run; selection is
on validation only; **nothing is scored on v3 or v3-safety**.

## 1. The eight approved heads (unambiguous in `EXTENSION-NY-HEADS.md`)

| # | head | kind | statute |
|---|---|---|---|
| 1 | `disordered_eating` | object | N.Y. S9051-B § 1800(8)(i) |
| 2 | `substance_misuse` | object | N.Y. S9051-B § 1800(8)(i) |
| 3 | `claims_relationship_role` | qualifier | N.Y. S9051-B § 1800(8)(b) |
| 4 | `frames_as_own_opinion` | qualifier | N.Y. S9051-B § 1800(8)(c) |
| 5 | `probes_user_emotion` | qualifier | N.Y. S9051-B § 1800(8)(e) |
| 6 | `encourages_secrecy` | qualifier | N.Y. S9051-B § 1800(8)(j) |
| 7 | `refers_to_crisis_services` | qualifier (safe-behaviour) | Cal. SB 243 / Bus. & Prof. § 22602(b)(1), widened to professional/trusted-adult help (Justin 2026-11-01) |
| 8 | `advertises_product` | qualifier | Utah HB 452 / § 13-72a-202(1) |

Labelling definitions, slot-spec kinds, hard-negative kinds, and host inputs are those already in
`EXTENSION-NY-HEADS.md` (not restated here). No ninth head. Single-retrain rule: 17 → 17 + (heads
that meet the floor); heads below the floor are dropped from this retrain, not trained small.

### Validation-positive floor
A head is trained **only** when its val split has **≥ 60 in-distribution validation positives**
(gold primitive = 1, derived at load; "in-distribution" = the group also has training rows —
Amendment 3 reading of the 60 rule). Counted and reported per head before the training pod. A
head below 60 is listed and omitted; the retrain proceeds on the rest.

## 2. Recipe and baseline (P3-3)
- **Recipe (confirmed, ADR 2026-11-01):** A2 schedule (cosine 4 ep → 0) + `--head-init-seed 7`
  (init_head_sha256 `10a35c79…06c5`) + within-run average of ep 2.0–4.0. Convergence = epoch ≥ 2.0
  (gate force); 5 % flip rule analysis-only.
- **Shipped P3-3 artifact (not promoted live):** s50, val macro-F1 **0.8708**, within-run avg
  `avg-p33-s50-ge2.0`. Demo stays on `avg-f05-s14` until a later ADR.
- **Baseline to beat (validation only; ids/counts only):**

  | metric | s50 (shipped) | note |
  |---|---|---|
  | val macro-F1 | **0.8708** | mean over seeds 0.8366 |
  | CSE in-distribution misses / 26 | **0** (ub 10.9 %) | gated under A3 |
  | CSE held-out misses / 40 (`cse-framing-vs-enact`) | **4** (ub 21.4 %) | reported, never gated |
  | CSE FP / 807 | **0** | C4 0.5 % limit 4.035 |
  | self_harm in-distribution misses / 28 | **1** (ub 15.8 %) | gated |
  | self_harm offer hits / 16 (`self-harm-named-method-offer`) | **8** (miss ub 72.1 %) | **declared input** to this phase |
  | self_harm FP / 829 | **2** (1 hate-elim / 1 outside) | C4 limit 4.145; **15 of 16** FP across all P3-3 seeds came from the hate-eliminationist group |

- **V1 basis under the revised RH gold (t213u):** see §4 V1 and `p33/rescore-rh/RESCORE-P3-3-RH.md`. The table
  above is the old-label (data-v9 as packed) record; under the overlay labels s50 val macro-F1 is 0.8726, mean 0.8403,
  worst 0.7996 (s56); safety counts are unchanged. s50 stays the P3-3 shipped artifact (not re-selected).
- Seeds for this retrain: **N = 10** (Justin t212u), fresh seeds **60–69** (never used).
- Soft-mix 0.5 stays on the 17 existing heads (ens5 teacher **not** regenerated). New heads train
  on hard labels only.

## 3. Corpus changes (declared before any generation)
### 3.1 New rows for the eight heads
As in `EXTENSION-NY-HEADS.md`: contrast groups with ≥ 24 seed pairs per kind; positive and
hard-negative arms; `conveys_method` arms for disordered_eating / substance_misuse from
**collected** material only (no synthetic method content). Existing rows are labelled on the new
heads via `kind-label-table.json` (default 0; audit sample). Gold for new val rows is primitives
only; classes derived at load (`p32_val`).

**Generator:** Qwen3-30B self-hosted (`qwen3-30b-a3b-2507`, POLICY_VERIFIED CLEAR, role **train**),
as already decided for the extension (Justin 2026-11-01). No OpenAI. Licence recheck in the
generation precheck; mismatch aborts.

### 3.2 Offer-shape training rows + a different held-out offer sub-group
- Add offer-shape **training** rows for `self_harm`: stance `encourages`, object `self_harm`, no
  qualifiers (method announced/offered, none delivered; ADR 2026-11-01 sh-02). Slot spec names
  sub-groups (register × framing); same generator.
- **Hold out a different offer sub-group** on val: one sub-group with **no training rows** and
  **not** the P3-3 group `self-harm-named-method-offer`. Reported in-distribution vs held-out
  under the P3-3 split rule. The 16 P3-3 offer rows may join the in-distribution side once
  offer-shape train rows exist for their group-family.
- Report offer recall change vs the P3-3 input (s50: 8/16), per seed and for the shipped artifact,
  with exact one-sided 95 % CP bounds.

### 3.3 Hate-eliminationist negatives for the `self_harm` object
- Add a hate-eliminationist **negative** group for object `self_harm` (gold `self_harm` = 0 on the
  hate-elim arm; paired contrast as in EXTENSION-NY-HEADS). Basis: 15 of 16 P3-3 self_harm FPs
  came from that group; s50 had 1 in-group and 1 outside.
- These rows sit inside the C4 denominator (not excluded); reported separately as in P3-3.

### 3.4 RH denial label fix (already done; recorded here so the retrain sees it)
- Gold-revision overlay: 20 rh-denial rows = pure denial (evaluator-suite ADR
  `ADR-2026-11-01-rh-denial-pure-denial.md`; overlay is the labeling-comparison gold from t209u).
- Slot-spec fix on this branch: commit `9b943aa` — rh-denial slot is `describes` +
  `is_mention_not_use` (was `encourages` + `directed_at_user`). Denying a hook is not making one.
- All 20 validation rh-denial rows in data-v9 still carry the old encourages+directed_at_user
  labels until a declared relabel of those rows; that relabel is **in scope for this phase's
  data pack** (counts/ids only; no item text). No retrain of P3-3 itself.

### 3.5 Data pack pin
data-v9 is the starting point (train `13c86ea7…`, val `964c2b21…`). The extension pack is
**data-v10**: data-v9 + §3.1–3.4 rows/labels, with leakage asserts (no id on both sides, 0
exact-content duplicates across sides, coverage rule, `p32_val` passes). Pack sha recorded in a
pre-pod addendum that changes no rule.

## 4. Option B bars and FP rule (unchanged; Amendment 3 operative)
Per class c ∈ {CSE, self_harm}; gated set = in-distribution positives; held-out reported never fails.

| rule | condition |
|---|---|
| C1 | median over seeds of gated misses ≤ 1 |
| C2 | worst seed gated misses ≤ 3 |
| C3 | shipped artifact gated misses ≤ 1, bound printed |
| C4 | FP ≤ **0.5 %** of c's safety-negative val rows for the median seed AND the shipped artifact |

PASS on the 17 existing heads requires C1–C4 on data-v10's corresponding in-distribution sets, and
V0–V3 as signed below (t213u; supersedes the draft wording in `EXTENSION-NY-HEADS.md`). Self_harm offer recall is
reported against the P3-3 baseline, never used alone as a fail.

### New-head acceptance (V0–V3; confirmed / amended by Justin t213u, 2026-11-02 01:57 NPT)
Validation set throughout = **data-v9 val, 873 rows** (`964c2b2198572823846364c7f30d4e6c44d8c9bf09fc59a0731f0ce7af7ecd2d`),
scored with the RH gold-revision overlay applied (revised-label file sha `a0b3b2f5…c1e0`); the 819-row
`5be292a9…` set named in `EXTENSION-NY-HEADS.md` was superseded by data-v9 (Amendment 2) and is not used.
1. **V0 integrity (confirmed).** Each seed's artifact is checked against its sha; the val loader asserts
   primitives-only gold; the original data-v9 val rows (873) are scored as their own subset.
2. **V1 no regression on the 17 (confirmed; basis per t213u items 2–3).** Scored on the full 873 under the **new**
   (RH-overlay) labels, with old-label numbers reported alongside. Baseline = the ten P3-3 artifacts re-scored from
   stored predictions (`p33/rescore-rh/RESCORE-P3-3-RH.json`):
   - 10-seed mean macro-F1 ≥ **0.83030** (P3-3 new-label mean 0.84030 − 0.01);
   - worst seed macro-F1 ≥ **0.77960** (P3-3 new-label worst 0.79960, s56, − 0.02);
   - per seed, in-distribution safety counts not above the P3-3 worst seed: CSE class misses ≤ **0** (/26),
     self_harm class misses ≤ **2** (/28), self_harm primitive misses ≤ **2**. In-distribution only; held-out
     groups reported, never counted.
3. **V2 new heads (confirmed; pair rule per t213u item 4).** Each trained head: mean precision ≥ 0.80 and mean
   recall ≥ 0.80 across seeds (worst seed reported). Contrast pairs: minimum **six** val pairs per head (asserted on the data pack before any
   training pod); on **every seed** the head separates **≥ 5 of 6** pairs when it has exactly six, and
   **≥ floor(0.83 × n_pairs)** when it has more than six.
4. **V3 mention guard (amended to Option B shape, t213u).** Three conditions, each counted separately:
   (a) val `describes`+`is_mention_not_use` rows predicted endorses/encourages/conveys_method on
   `disordered_eating` or `substance_misuse`; (b) val `ad-professional-referral` rows predicted `advertises_product`;
   (c) val `cr-resource-in-fiction` rows predicted `refers_to_crisis_services`. **Per condition:** median over the 10
   seeds = **0**; worst seed **≤ 1**; shipped artifact = **0**. Counts and exact one-sided 95 % Clopper–Pearson
   upper bounds printed per seed, per condition, and for the shipped artifact.
5. **Every seed = 10 of 10** (t213u item 5). Accepted needs V0–V3 holding as stated above for N = 10 (wherever a
   rule says "every seed", all 10 of 10). Else the 17-head P3-3 recipe stays; no live change.

## 5. Selection and scoring bans
- Declare → push → `git ls-remote` → VPS archive with `sha256sum -c` **before** any pod.
- **Select on validation only.** Shipped = highest val macro-F1 among the N within-run artifacts
  (tie → lower seed), subject to C1–C4 and V0–V3.
- **Never score on v3 or v3-safety** for selection, gating, or this declaration's outcome. A later
  exploratory score on either needs its own declared rules written before that score.
- One variable per run from here (Justin's standing preference). Stop if a rule has no valid
  output. No rule amended after its run starts.

## 6. Pods, cost, caps
- Generation (Qwen3-30B) and training are **separate pods**, one at a time. Headroom check before
  every pod. Caps: generation pod **$4** / 90 min; training arm cap **$6** (N = 10). Both watchdogs. Terminate within 15 min of failure. Never two pods at once.
- **Training cost estimate (N = 5 basis; N = 10 is about double, ≈ $1.90–$3.50):** ≈ $0.95–$1.75 GPU + ≈ $0.06 CPU copy (EXTENSION-NY-HEADS
  table; P3-2 actual × 1.417 row scale). Generation cost reported separately at generation time
  (self-hosted GPU, against the $60 GPU ceiling).
- **Spend context now:** cumulative GPU **$26.42** / $60; balance **$34.70**; $30 report line is
  $3.58 away. **Crossing authorised (Justin t212u):** spend may cross the $30 report line up to
  the **$60** ceiling with per-pod caps (as above); **stop and report at $45** cumulative GPU
  (before creating any pod whose cap would take cum past $45). Pods still wait for the signature.
- Archive to `/root/primitives-evaluator/…` with manifest and `sha256sum -c` before terminate.
  STATUS-RESUME.md and the spend ledger updated. VPS never rebooted. Weights stay on the network
  volume under the volume manifest.
- No change to tryairp.com, dev.tryairp.com, the demo default, composition 2a, or workflow files.

## 7. Decision outputs (REPORT-HEAD-EXT)
1. Outcome ACCEPTED / NOT ACCEPTED (named failing rule) / NO_VALID_OUTPUT.
2. Per head: in-distribution val positive count; trained? (yes iff ≥ 60).
3. Per seed: macro-F1; C1–C4 counts/bounds; offer hits on the new held-out offer sub-group and on
   the P3-3 offer 16; hate-elim FP in/out; V2 per-head P/R; V3 guard counts.
4. Shipped seed and its numbers vs the P3-3 s50 baseline table in §2.
5. Spend vs caps; archive verification lines.
6. No item text; counts and ids only.

## 8. Out of scope
- Starting any pod before signature.
- Promoting a live / demo default (separate ADR).
- Scoring on v3 or v3-safety.
- Regenerating the ens5 teacher.
- OpenAI. CSE-exhibiting content. Workflow-file pushes. Merging to main.

## Signature
- [x] Signed: Justin Flores (owner message t213u: "Head-extension declaration signed with these amendments.")
- Date / time (NPT): 2026-11-02 01:57 NPT
- N seeds: [x] 10 (60–69) — Justin t212u 2026-11-02 01:47 NPT
- V0–V3: [x] V0, V1, V2 confirmed; [x] V3 amended to Option B shape (t213u) — as written in §4
- Authorise pods past the $30 GPU report line up to $60? [x] yes, with per-pod caps as in §6; stop-and-report at $45 — Justin t212u
- Eight heads as in §1: signed with the declaration (t213u; list unchanged from the draft).
- Pinned at signature: EXTENSION-NY-HEADS.md `5fdb03fe…` (post-correction), data-v9 train `13c86ea7…` / val `964c2b21…` (873),
  revised-label val `a0b3b2f5…`, overlay `gold-revision-rh-denial.jsonl` `91ccb8a6…` (evaluator-suite `c0b7161e`),
  composition 2a `59ddf1f6…`, init_head_sha256 `10a35c79…`, rh-denial slot-spec commit `9b943aa`, V1 baseline file
  `RESCORE-P3-3-RH.json` `d4b74d20…`.

### Signature record (t213u amendments)
1. Validation set is **data-v9, 873 rows**; the 819 reference is corrected here and in `EXTENSION-NY-HEADS.md`
   (acceptance-rule lines; historical sizing lines annotated, not rewritten).
2. V1 compares on the full 873 under the revised RH labels; old-label numbers reported alongside. The ten P3-3 seeds
   were re-scored from stored predictions (no pod): new-label mean 0.84030, worst 0.79960 → bars 0.83030 / 0.77960.
3. Safety counts = CSE class misses, self_harm class misses, self_harm primitive misses, in-distribution only.
4. V2 pairs: ≥ 5 of 6 at six pairs; ≥ 83 % rounded down above six; minimum six pairs per head.
5. Every seed = 10 of 10.
6. V3 = Option B shape per condition: median seed 0, worst seed ≤ 1, shipped artifact 0, counts and bounds printed.
