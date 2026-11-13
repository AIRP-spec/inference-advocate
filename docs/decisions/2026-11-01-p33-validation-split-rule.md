# Decision record: P3-3 validation split rule for safety classes (group-held-out with in-distribution groups)

Date: Sunday, 1 November 2026 (NPT)
Status: **Accepted**, Justin Flores, 2026-11-01 08:03 NPT
Applied in: `decide/shared-adopt/phase3/DECLARATION-P3-3-AMENDMENT-2.md`, `p33/resplit_v9.py`, `p33/option_b_a2.py`.
Not a held-out suite or gate-threshold change; validation split of the training corpus only.

## Rule

1. **Groups.** A row's group is its `contrastGroup`, else its `kind`, else its `family`. Both arms of a contrast pair
   (same 4-digit id suffix within a group) move together as one pair-unit.
2. **Coverage.** For `self_harm` and `child_sexual_exploitation`, val positives (derived gold) span **≥ 3 groups**,
   **≥ 1 of which also has training rows** (in-distribution). A val positive whose group has 0 train rows is
   held-out-group.
3. **Reporting.** Recall is reported **in-distribution and held-out-group separately**, each with its exact one-sided
   95 % Clopper–Pearson bound.
4. **Gating.** While a class has **< 60 val positives**, the Option B miss rules apply to its in-distribution positives;
   at ≥ 60 they apply to all its positives. Held-out-group recall is reported with its bound.
5. **False positives** (Justin, signed): at most **0.5 % of the class's safety-negative val rows**, per safety class, with
   the one-sided 95 % CP bound printed; the hate-eliminationist contrast group is reported separately.
6. **Leakage checks** (asserted by `resplit_v9.py`): no row id on both sides; 0 exact-content duplicates across sides;
   group ids recorded per side in `p33/split-meta-v9.json`; moved val rows carry no stored class key (val classes are
   derived at load, ADR 2026-10-19-val-gold-classes-derived).

## Applied (data-v9)

Moved train→val: floor(units/4) pair-units from each of three existing train groups per class, ordered by
sha256(`airp-p33-v9`|group|index); 54 rows. Train 7,386 (`13c86ea7…3a28`), val 873 (`964c2b21…cd2d`).

| class | val pos | in-distribution groups (val rows) | held-out groups (val rows) | train pos | val neg |
|---|---:|---|---|---:|---:|
| child_sexual_exploitation | 66 | cse-act-as-undress 10, cse-numeric-age 8, cse-roleplay 8 | cse-framing-vs-enact 40 | 462 | 807 |
| self_harm | 44 | self_harm-encouragement 10, self_harm-imperative 8, self_harm-method 10 | self-harm-named-method-offer 16 | 190 | 829 |

Known caveat: the ens5 teacher soft targets were computed with the moved rows in its training data; P3-3 drops them
from the soft-target file (`p33/filter_teacher_v9.py`), but the teacher itself saw them. In-distribution val recall is
therefore weakly optimistic. Recorded in Amendment 2 §9.
