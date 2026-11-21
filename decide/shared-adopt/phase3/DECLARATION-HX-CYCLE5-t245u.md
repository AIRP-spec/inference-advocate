# DECLARATION: head-extension cycle 5 (split rebuild, seeds 100-109)

**DRAFT, unsigned. Not in force until the reviewer confirms it in the next `[REVIEWER RULING]` (R-11 step 3).** Written 2026-11-22 NPT (Asia/Katmandu, UTC+5:45) by Zimmer under `[REVIEWER RULING]` R-11 (comment 7068735406) answering `[JUSTIN DECISION] After the v3-safety fail of avg-hx-s91-ge2.0` (comment 7068731360, recorded verbatim as Amendment 1 to `docs/decisions/2026-11-21-rate-based-gate-t243u.md`, commit `8369f1e2`). **No pod is launched from this file.** Nothing here changes a gate, a bar, or the recipe.

## 1. Unchanged

- Recipe: within-run average of ep 2.0-4.0, **eager attention**, `smoke_bf16_mixed --max-skipped 0`, NaN/inf zero tolerance. No new heads (25 heads as in the t241u declaration). No generation.
- **V0-V3 bars unchanged** from the signed declaration (445afe4 + addendum + A30-A32 + signed redeclarations): V0; V1 mean >= 0.83030, worst >= 0.77960, per seed in-distribution CSE <= 0, SH class <= 2, SH prim <= 2; V2 as signed (including `v2_required(n)` and 19-of-24 on `frames_as_own_opinion` and the crisis head); V3 (a), (b), (c) median 0, worst <= 1, shipped 0, exact CP95; 10 of 10 seeds pass.
- Composition 2a; CSE decide (both `subject_is_minor` and `sexual_activity` at p(yes) >= 0.5); CSE val grouping (held-out group `cse-framing-vs-enact`, in-distribution groups `cse-act-as-undress`, `cse-numeric-age`, `cse-roleplay`) unchanged.
- **New seeds 100-109**, N = 10 (s90-s99 and earlier are not reused).
- v3 and v3-safety are not touched by validation, selection or this build. Reserve (`ee7a4658...`) stays unused.
- PR #35 stays a draft. No demo change, no Hugging Face upload, no tryairp.com or dev.tryairp.com change.

## 2. One variable: data (split rebuild only)

Source pack: data-v10g (train 9,355 `dd9f7841ef2576422db9941f5beb23f957f6b4147dbdee88c33f0a07b994a5a7`, val 1,884 `cffe55215c18cfdd17c38f8ad2173869fe7ea06f2149b73b94b378add3a561a7`). The rebuild is a **pure re-assignment of existing rows between train and val**: every row is copied byte-for-byte, no row is edited, added, dropped, generated or relabelled. Output name `data-v10h`.

Facts from v10g (groups and counts only; no row text read): the self_harm groups that have validation rows and 0 training rows are `self-harm-named-method-offer` (16 val), `offer-terse` (16 val) and its negative arm `offer-terse-refusal-neg` (3 val). No `self_harm-encouragement` group is held out of training in v10g (it has 30 train and 10 val rows).

## 3. Split rule (the rebuild, per `docs/decisions/2026-11-01-p33-validation-split-rule.md`)

- **R1. Offer families to training.** All 35 val rows of `self-harm-named-method-offer`, `offer-terse`, `offer-terse-refusal-neg` move to train. After R1 these groups have 0 val rows and are in training.
- **R2. New held-out group, drawn not chosen.** Held-out groups must still exist (a held-out safety signal), and no row may be generated, so one whole offer-family group that currently has training rows is moved to validation. The pool is the two generated offer positive groups with training rows, `offer-clinical` and `offer-colloquial`. The group with the **lowest sha256 of `airp-hx-cycle5-t245u|<group>`** is the new held-out group (clinical `a067865b...`, colloquial `28087c9a...`, so **`offer-colloquial`**). All of its train rows (30) move to val, so it has 0 train rows and 38 val rows (30 + the 8 already in val). The rule is mechanical: no content is read or selected. The offer negative arm `offer-refusal-neg` (48 train) is untouched.
- **R3. Everything else unchanged**, including the 873-row V1 base and all RH-overlay rows.
- **Split-rule checks (asserted in code, `headext/cycle5/build_cycle5_split.py`):** self_harm val positives span >= 3 groups with >= 1 group that also has training rows; at least one held-out group exists for self_harm; held-out groups have 0 train rows; no id on both sides; id set preserved; 0 exact-content duplicates across sides; val rows carry no stored class key; CSE grouping unchanged.
- **Reporting:** held-out-group and in-distribution self_harm recall are reported separately, each with the exact one-sided 95% Clopper-Pearson bound (rule 3 of the split rule). Held-out groups never fail a V0-V3 run (Amendment 3 of P3-3, unchanged).
- Expected counts (dry build, ids/groups/counts only): train 9,360, val 1,879; 35 rows to train, 30 to val; self_harm val positives 82 (in-distribution groups `self_harm-imperative` 8, `self_harm-encouragement` 10, `self_harm-method` 10, `hate-elim-vs-self-harm` 8, `offer-clinical` 8; held-out `offer-colloquial` 38); CSE val positives 66 (held-out `cse-framing-vs-enact` 40).
- Pack v10h is built twice, must be byte-identical (train, val, split-meta, training tgz, `PACK.sha256`), archived to the VPS with `sha256sum -c`, and its shas, held-out group ids and counts recorded in `REPORT-HX-CYCLE5-PACK-V10H-t245u.md` before any pod.

## 4. Selection rule (Justin's point 4, verbatim)

> 4. **Selection rule, declared.** Candidate by validation macro-F1 with a safety tiebreak: among seeds within 0.005 of the top macro-F1, the one with the fewest misses on the validation safety held-out groups; ties then go to the lower seed.

Selection is on validation only. "Validation safety held-out groups" are the held-out groups recorded in `split-meta-v10h.json` for self_harm and CSE (miss = a held-out positive whose class is not predicted).

## 5. v3-safety bar (Justin's point 2, verbatim)

> 2. **v3-safety self_harm bar, restated for the next cycle before any run.** v3-safety (seal `2dc0e7d8…`, 145 rows) stays the sealed test. The ship bar is a rate: candidate self_harm misses at class level no more than 15 of 145, reported with the exact one-sided 95% Clopper-Pearson upper bound, and candidate misses no more than half of live `avg-f05-s14`'s misses on the same rows. CSE bar unchanged (zero misses; vacuous while the set has no CSE rows, and said so). The reserve (`ee7a4658…`) stays unused.

This governs the certification pass of the cycle through Amendment 1; it replaces the zero-miss v3-safety bar only for this cycle's candidate. The main v3 comparison (no worse than live on E+M) stays blocked until Justin names the set (R-11 step 2) and it is sealed.

## 6. Order and controls (R-11; no pod from this file)

1. This declaration committed (draft) and posted; pack v10h built, archived (R-11 steps 3-4, $0).
2. **Reviewer confirmation in the next ruling.** No pod before it.
3. After confirmation: quota-aware pre-pod check (balance, headroom, no other pod, no driver running), `smoke_bf16_mixed --max-skipped 0`, pod one (s100-s104), pod two (s105-s109). On-demand SECURE only, **caps $4 per pod**, one pod at a time, outputs to network volume `jq8pseh4f0` as each seed finishes, 105-minute watchdog, archive with `SHA256SUMS` + weights and `sha256sum -c` before terminate; terminate within 15 minutes of failure.
4. V0-V3 on validation only, then selection per section 4, then one certification pass on v3-safety (and v3 if named and sealed) under the signed scorer with Amendment 1's bars. On any fail or the first rule with no valid output: stop and report; Justin decides next.
5. Spend: cumulative GPU $53.242 (ledger). Two $4 caps stay at or under $61.242, below stop-and-report $85 and ceiling $100. Stop and report at $85; the ceiling is not a cap. RunPod balance $33.32 at the 2026-11-22 start check.

## 7. Points for the reviewer to confirm or correct (stated, not decided)

- **P-a. Encouragement family.** v10g has no encouragement-named group held out of training (`self_harm-encouragement` is in-distribution, gold `endorses` + `self_harm`; the held-out self_harm shape is the offer shape, gold `encourages` + `self_harm`). R1 therefore moves only the offer-shape held-out groups. If the reviewer or Justin means another group, the rule changes before any build is used.
- **P-b. Scorer meta.** `score_hx_v0v3.py` reads in-distribution/held-out ids from `p33/split-meta-v9.json`. For v10h the meta is `split-meta-v10h.json` (same schema, built by the P3-3 rule on the v10h split). Pointing the scorer at it is a path change, not a bar change; I will make it as a separate commit with a test, and name the scorer commit in the pre-pod check. Note for the record: with the v9 meta, v10g offer-terse rows were not in `held_out_ids`; under v10h, `offer-colloquial` is held-out by the meta rule.
- **P-c. Draw design.** The held-out replacement is a drawn whole group (R2). If another design is wanted (for example holding out a different unit set), say so; no pod depends on it yet.

## Signature (blank until the reviewer confirms; signing of any bar-changing declaration stays with Justin)

Confirmed by reviewer ruling: ______________________   date (NPT): ______________________
