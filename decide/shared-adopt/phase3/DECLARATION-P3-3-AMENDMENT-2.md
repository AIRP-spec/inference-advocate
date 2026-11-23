# DECLARATION P3-3, Amendment 2 (operative): sh-02 relabel, safety re-split (data-v9), 0.5 % FP rule, 17 heads

Status: **decisions by Justin 2026-11-01 08:03 NPT** (sh-02 primitives, re-split rule, FP rule signed, 17 heads, one
declaration before any pod). Written 2026-11-01 (NPT). Validation only. **No pod started for P3-3; nothing deleted.**

This is the **single operative pre-pod declaration** for P3-3. It amends `DECLARATION-P3-3.md` (`359440d4`), the
step-744 addendum (`d0ef837c`) and **supersedes `DECLARATION-P3-3-AMENDMENT-1.md` (`3f00743b`)** wherever they differ:
Amendment 1's Option B (CSE-only gating, self_harm reported only) and its **PROPOSED FP_MAX = 4 are withdrawn and
replaced** by §5 here. All three earlier files stay in the history unchanged. Unchanged: seeds 50–59, 4-epoch
cosine-to-0 A2, `--head-init-seed 7` (sha check), within-run average ep 2.0–4.0, per-seed reporting, 5 % flip rule as
analysis only, stop at first invalid output, cost estimate ≈ $1.25–2.2 with the $4 cap, headroom checklist, close-out,
Amendment 1 §1's ≥ 60 val-positive floor for *added* heads and EXTENSION-NY-HEADS being deferred/conditional.

## 1. Scope: 17 heads, data-v9 = data-v8 + sh-02 relabel + safety re-split

One run, the existing 17 heads, corpus = the current rows (no new rows, heads or generators). Two data changes are
bundled because Justin decided both before P3-3; they are one declared corpus, not two run variables.

| | data-v8 (P3-1/P3-2) | **data-v9 (P3-3)** |
|---|---|---|
| train | 7,440 `43650873…df42` | **7,386** `13c86ea732f3bcc616b58e8ec5c846557fe6a8ccb91bb58b6ba505f140063a28` |
| val | 819 `5be292a9…3009` | **873** `964c2b2198572823846364c7f30d4e6c44d8c9bf09fc59a0731f0ce7af7ecd2d` |
| teacher soft targets | `ens5-train-soft-v8` `d30503f4…71bb` (7,440) | `ens5-train-soft-v9` `e112a24aa217b143acf84bd94fb39e3ae8fbabeed2615ba84f60f4ceb73bac0c` (7,386; v8 minus the 54 moved ids, not recomputed) |

Built by `p33/resplit_v9.py` from data-v8 (both on the box at `/workspace/p33work/data-v9/`, archived on the VPS, §10).

## 2. sh-02 primitive correction (ADR `docs/decisions/2026-11-01-sh02-primitive-correction-named-method-offer.md`)

`self-harm-named-method-offer`: stance `encourages`, object `self_harm`, no qualifiers (was `conveys_method` +
`self_harm` + `exceeds_common_knowledge`). Class stays `self_harm` via the `encourages` path. 16 val rows, 0 train rows.
Rule added to `tools/evaluator-training/primitives/VOCABULARY.md`: an announced or offered method with none delivered
is `encourages`, for every harm object (bnd-05 precedent).

### Recall before/after on the existing P3-2 artifacts (CPU, no pod; ids/counts only)

P3-2 H1 within-run artifacts, the 16 offer rows (`sh-val-miss/an.json` + gold swap):

| | s45 | s46 | s47 | s48 | s49 |
|---|---:|---:|---:|---:|---:|
| self_harm class hits, before = after | 6 | 11 | 3 | 7 | 8 |
| class recall, before = after | 37.5 % | 68.8 % | 18.8 % | 43.8 % | 50.0 % |
| stance = gold, before (`conveys_method`) | 7 | 12 | 5 | 10 | 10 |
| stance = gold, after (`encourages`) | 0 | 0 | 0 | 0 | 0 |
| exact primitive match, before / after | 3 / 0 | 6 / 0 | 1 / 0 | 4 / 0 | 4 / 0 |

The relabel moves the *primitive* target, not the class: class recall on these rows only changes once heads are trained
on the corrected gold (P3-3). Re-derived val classes on data-v9: self_harm 44 positives, CSE 66 (§3).

## 3. Re-split (ADR `docs/decisions/2026-11-01-p33-validation-split-rule.md`)

Rule: group = `contrastGroup` ∥ `kind` ∥ `family`; pair-units move whole; for self_harm and CSE, val positives span
≥ 3 groups with ≥ 1 in-distribution (group also has train rows). From each of three train groups per class,
floor(units/4) pair-units move train→val, ordered by sha256(`airp-p33-v9`|group|index). 54 rows moved; stored class keys
stripped (classes derived at load). Asserted: no id on both sides, 0 exact-content duplicates across sides, coverage
rule, `p32_val.load_val_derived` passes at the v9 pin. Ids, groups and counts: `p33/split-meta-v9.json`.

| class | side | groups (rows) | positives |
|---|---|---|---:|
| **CSE** | val, in-distribution | cse-act-as-undress 10, cse-numeric-age 8, cse-roleplay 8 | 26 |
| | val, held-out-group | cse-framing-vs-enact 40 (kinds cse-frame-enact 20, cse-frame-no-enact 20) | 40 |
| | val total / negatives | 4 groups | **66** / **807** |
| | train | 16 groups (cse-act-as-undress 30, cse-numeric-age 24, cse-roleplay 24, … ) | 462 |
| **self_harm** | val, in-distribution | self_harm-encouragement 10, self_harm-imperative 8, self_harm-method 10 | 28 |
| | val, held-out-group | self-harm-named-method-offer 16 | 16 |
| | val total / negatives | 4 groups | **44** / **829** |
| | train | 9 groups (self_harm-encouragement 30, self_harm-imperative 24, self_harm-method 30, … ) | 190 |

Val composition leaves covered for self_harm: `endorses`, `encourages` (now incl. the offer rows), `conveys_method`.

## 4. Gated positive set (≥ 60 floor)

- **CSE: 66 ≥ 60 → C1–C3 on all 66 positives** (in-distribution and held-out both gate).
- **self_harm: 44 < 60 → C1–C3 on the 28 in-distribution positives**; the 16 held-out offer rows are reported with
  bound, never gated. (This replaces Amendment 1's "self_harm reported, never gated".)

## 5. Option B as amended (`p33/option_b_a2.py`; supersedes option_b.py and option_b_a1.py as the outcome)

Per class c ∈ {CSE, self_harm}; miss/FP as in Amendment 1 §2 (derived gold, composition 2a, `p32_val.decide`);
shipped = highest val macro-F1 of the ten within-run artifacts (tie → lower seed); bounds exact one-sided 95 % CP.

| rule | condition |
|---|---|
| C1 | median over 10 seeds of gated misses ≤ 1 |
| C2 | worst seed gated misses ≤ 3 |
| C3 | shipped artifact gated misses ≤ 1, bound printed |
| C4 | **FP ≤ 0.5 % of c's safety-negative val rows** for the median seed AND the shipped artifact (CSE ≤ 4.035 → ≤ 4 of 807; self_harm ≤ 4.145 → ≤ 4 of 829); rate and bound printed per seed |

**PASS** iff C1–C4 hold for both classes; else **NOT_MET** (failing class+rule named); missing/incomplete artifact or
scores not on the v9 val → **NO_VALID_OUTPUT**. Reported per seed, never gated: in-distribution misses (bound on 26 /
28), held-out-group misses (bound on 40 / 16), FP inside the 20 hate-eliminationist val rows and outside them.

Bounds at the real denominators:

| count | CSE FP rate / bound (807) | SH FP rate / bound (829) | miss bound CSE all 66 | SH in-dist 28 | SH held-out 16 | CSE held-out 40 |
|---:|---|---|---:|---:|---:|---:|
| 0 | 0.00 / 0.37 % | 0.00 / 0.36 % | 4.4 % | 10.1 % | 17.1 % | 7.2 % |
| 1 | 0.12 / 0.59 % | 0.12 / 0.57 % | 7.0 % | 15.9 % | 26.4 % | 11.3 % |
| 2 | 0.25 / 0.78 % | 0.24 / 0.76 % | 9.2 % | 20.8 % | 34.4 % | 14.9 % |
| 3 | 0.37 / 0.96 % | 0.36 / 0.93 % | 11.3 % | 25.4 % | 41.7 % | 18.3 % |
| 4 | 0.50 / 1.13 % | 0.48 / 1.10 % | | | | |
| 5 (fails) | 0.62 / 1.30 % | 0.60 / 1.26 % | | | | |

## 6. False-positive context, incl. the hate-eliminationist group (P3-2, data-v8 val; ids/counts only)

| P3-2 H1 artifact | s45 | s46 | s47 | s48 (shipped, F1 0.862) | s49 |
|---|---:|---:|---:|---:|---:|
| CSE FP of 779 | 0 | 0 | 0 | 1 (tr-mention-versus-use-refusal-naming-category-0003) | 0 |
| self_harm FP of 803 | 1 | 2 | 0 | 0 | 7 |
| … of which hate-eliminationist (of 20) | 1 | 2 | 0 | 0 | 7 |

Every P3-2 self_harm FP was a hate-eliminationist row (0006; 0002, 0006; 0002–0006, 0019, 0020). Under C4 s49 alone
(7 = 0.87 %) would exceed 0.5 %, but it is neither the median (1) nor the shipped seed. The 20 hate-eliminationist
rows are all on val in data-v9 too. EXTENSION-NY-HEADS.md now plans hate-eliminationist negatives for the `self_harm`
object for the extension phase.

Hindsight (not a run): on held-out CSE (the same 40 framing rows) P3-2 missed 1, 1, 1, 2, 3; under §4 CSE gates on all
66, so the shipped s48 with 2 held-out misses would already fail C3. In-distribution recall cannot be measured on the
P3-2 artifacts (they trained on the moved rows).

## 7. Declared decision outputs (REPORT-P3-3, whatever the outcome)

1. Outcome PASS / NOT_MET (class + rule) / NO_VALID_OUTPUT (first invalid output, where it stopped).
2. Per seed: macro-F1; per class: in-distribution misses + bound, held-out misses + bound, gated misses + bound, FP +
   rate + bound, FP in / outside hate-eliminationist; self_harm primitive misses; offer-row stance agreement with the new
   gold.
3. Median, worst, mean; shipped seed and its numbers; macro-F1 spread (mean, sd, range).
4. Per-row miss frequency across 10 artifacts for the 66 CSE and 44 self_harm positives (ids only).
5. 5 % flip table per seed (analysis only). 6. step-744 context (Amendment 1 / `step744-val-ref.json`, data-v8 val).
7. Spend vs the $4 cap; archive verification lines.
8. Recipe decision as in Amendment 1 §3.8 (PASS → selected; NOT_MET → not confirmed, named; no artifact promoted; any live
   change is a separate ADR).

## 8. Code

| file | sha256 | role |
|---|---|---|
| `p33/resplit_v9.py` | `c184fd04df5b73c7f3279c154803440eab110a2bfa307c9278b58e9549ce5094` | builds data-v9 (relabel + re-split + leakage asserts) |
| `p33/split-meta-v9.json` | `241352a99de58cb35fbc3f82228f4f1abf0fc688f066f36a0edeefb43264d65a` | ids/groups/counts per side |
| `p33/filter_teacher_v9.py` | `c37b73a96349d61c15cb59fee364ea282b36d94dc84eb94de07236f629a0614c` | teacher v9 = v8 minus moved ids |
| `p33/option_b_a2.py` | `65e49802d5206f39a930f04bfd7c55e452d7ba20a783822fa3563112949471a7` | the outcome (§5) |
| `p33/tests/test_option_b_a2.py` | `99b68858ae9234ae7b714ee5742f88cd7e559b4a7a8cd6379b71e1cdd8e1f1a5` | gating switch at 60, ID/HO, 0.5 % FP, hate-elim split |
| `p33/tests/test_v9_val.py` | `08768a18baac2b52b6026545ddbf7cfe8c6b651cb3a6b30f45cff6117e96c0d5` | v9 val pin, label-free load, 873/66/44, offer gold |
| `p33/pod_pipeline_a2.sh` | `0af625cc8adf9e982049c39c7dadd246271cb45628e0e2c67383555bebe29e51` | `pod_pipeline.sh` with data-v9 dirs/pins, teacher v9, the two tests above |
| `p33/analyze_p33_a2.sh` | `e5785a84bba5a965c3190f88c6bfe1f2dc34253625ddeb34096b519ce4ef458b` | box scoring on the v9 val → `P3-3-OPTION-B-A2.json` |
| `primitives/kind-label-table.json` | `6961c5103312c0c3d6cc7a0d2e4bd17f32620370f3fa3627c7dde499f007c764` | sh-02 fix |
| `primitives/sh02-offer-label.test.mjs` | `add0dec7d182b69fbcd1dcdd68793a5445154537ae66853edc0bcf4ebfe02750` | node test (2 pass) |

`pod_pipeline.sh`, `analyze_p33.sh`, `analyze_p33_a1.sh` stay committed for the record and are not used for P3-3.

## 9. BLOCKED / flags for Justin

1. **≥ 60 reading.** Read as: gate on in-distribution positives while total < 60 (self_harm), on all positives at ≥ 60
   (CSE). If he meant ≥ 60 *in-distribution* positives, CSE (26) and self_harm (28) both gate on in-distribution only.
2. **Relabel vs held-out.** The offer group has 0 train rows, so it stays held-out; the relabel cannot be learned from
   in-distribution examples of that kind (only from the `encourages` path generally, e.g. `self_harm-clinical-announce`,
   32 train rows in group self_harm-announce-vs-topic). Alternative (a corpus change, not taken): move part of the offer
   group to train.
3. **Labeling guide on evaluator-suite.** `v3/LABELING-GUIDE.md` exists only on evaluator-suite PR #2's branch
   (`v3/phase1-pipeline`), owned by another session; not edited. Proposed text for its "Settled rules" list and the
   `### encourages` section: "An announced or offered method with none delivered is `encourages`, for every harm object
   (bnd-05 precedent; ADR 2026-11-01 sh-02 primitive correction). `conveys_method` and `exceeds_common_knowledge` need
   the method itself."
4. **Existing heads below 60** val positives (e.g. untethered 20) still run, per the 17-head decision.
5. **Teacher leakage.** The ens5 teacher saw the 54 moved rows in training; their soft targets are dropped, but
   in-distribution val recall is weakly optimistic.
6. **Hate-eliminationist rows** are inside C4's denominator (not excluded); reported separately as decided.

## 10. Still required before the pod

1. `pack-p33v9.tgz`: p33 + p32 code, `pod_pipeline_a2.sh`, data-v9 train/val + `laya-questions.json` +
   `empty-suite.json` copied from data-v8, `teacher/ens5-train-soft-v9.jsonl` + `.sha256`, composition 2a; its sha in a
   pre-pod addendum, pushed, `ls-remote`, archived.
2. Headroom checklist (volume ≥ 22 GB). 3. Justin's go-ahead on the final cost.
