# DRAFT (UNSIGNED): head-extension retrain (17 → up to 25) on the P3-3 recipe

> **UNSIGNED. NOT IN FORCE. No generation pod, no training pod, no spend until Justin signs.**
> **Partial rulings recorded (Justin t212u, 2026-11-02 01:47 NPT):** N = 10 seeds; spend may cross
> the $30 report line up to the $60 ceiling with per-pod caps, stop-and-report at $45. **V0–V3 are
> UNCONFIRMED** (Justin asked for a one-line restatement of each before the declaration is final).
> The declaration is not signed and not final until V0–V3 are confirmed and Justin signs.
> Status: draft for signature after REPORT-P3-3 and Justin t211u (2026-11-02 01:10 NPT: "Then the
> head-extension declaration … as planned."). Builds on `EXTENSION-NY-HEADS.md` (eight heads
> approved; training deferred/conditional), `DECLARATION-P3-3-AMENDMENT-{1,2,3}.md`,
> `REPORT-P3-3.md`, ADR `docs/decisions/2026-11-01-phase3-output-recipe-and-convergence.md`, and
> the RH denial fix (gold overlay; slot-spec commit `9b943aa`).

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
V0–V3 of `EXTENSION-NY-HEADS.md` (restated below for the new heads). Self_harm offer recall is
reported against the P3-3 baseline, never used alone as a fail.

### New-head acceptance (V0–V3; **UNCONFIRMED** — Justin t212u: restate each before final)
1. **V0 integrity.** Artifact sha check; val loader asserts primitives-only gold; original data-v9
   val rows scored as their own subset.
2. **V1 no regression on the 17.** Mean macro-F1 ≥ P3-3 mean − 0.01; worst seed ≥ P3-3 worst −
   0.02; per-seed safety counts not above the P3-3 worst seed.
3. **V2 new heads.** Each trained head: mean precision ≥ 0.80 and mean recall ≥ 0.80; contrast
   pairs separate on ≥ 5 of 6 val pairs on every seed.
4. **V3 mention guard.** 0 val `describes`+`is_mention_not_use` predicted as endorses/encourages/
   conveys_method on disordered_eating or substance_misuse; 0 val `ad-professional-referral`
   predicted `advertises_product`; 0 val `cr-resource-in-fiction` predicted
   `refers_to_crisis_services`. One violation on any seed → not accepted.
5. Accepted needs V0–V3 on every seed of N (10 of 10). Else the 17-head P3-3 recipe stays; no live change.

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
- [ ] Signed: ___________________________ (Justin Flores)
- Date / time (NPT): ___________________________
- N seeds: [x] 10 (60–69) — Justin t212u 2026-11-02 01:47 NPT
- V0–V3 thresholds: **UNCONFIRMED** (t212u: restate each in one line before final)  [ ] confirm  [ ] amend: _______________
- Authorise pods past the $30 GPU report line up to $60? [x] yes, with per-pod caps as in §6; stop-and-report at $45 — Justin t212u
- Confirm eight heads as in §1 (list unambiguous): [ ] yes  [ ] other: _______________
- Pinned at signature (filled in the signature commit): EXTENSION-NY-HEADS.md sha, data-v9 train/val
  shas, composition 2a `59ddf1f6…`, init_head_sha256 `10a35c79…`, rh-denial slot-spec commit
  `9b943aa`, P3-3 report commit.
