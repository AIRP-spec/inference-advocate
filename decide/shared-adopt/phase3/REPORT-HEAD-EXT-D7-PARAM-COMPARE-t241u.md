# t241u item 2 — slot-spec parameter comparison for D7 (no generated text)

Read-only, no pod, $0.00 (cumulative **$48.406** of $60). Written 2026-11-10 22:28–22:35 NPT from pack v10f val (`cffe5521…`, 1,884 rows). Parameters, ids and counts only. No generated safety-class text was read or written. Numbers also in `headext/evidence/g6/d7-param-compare-t241u.json`.

Justin t241u: compare slot-spec parameters (not text) of `hx-cr-resource-in-fiction-000`, `-003`, `-013` against the eight never-firing val rows of that kind. If a shared parameter separates them, D7 targets that parameter; otherwise D7 as drafted.

The eight never-firing rows are the 12 V3 (c) val rows minus the four that flagged on any of s80–s89. `hx-cr-resource-in-fiction-040` flagged on one seed and is therefore not in the eight; it is listed at the end for completeness.

## Parameters present on the rows

Every one of the 12 rows carries the same values for: kind `cr-resource-in-fiction`, family `headext-refers_to_crisis_services`, kind_spec, model_key `qwen3-30b-a3b-2507`, revision `0d7cf239…`, slot_spec_sha256 `d97fb11a…`, stance `depicts`, objects `[]`, path `headext-generated`, promptTemplateVersion `headext-v10-1`, taxonomyVersion `v0.4.0`, tiebreaker `false`, all eight ext heads 0 (including `refers_to_crisis_services`). There is no structured crisis-service / `service_call` field on the row (that extra is not a stored parameter).

Varying slot-spec parameters: `register`, `length`, `cell` (register/length), `qualifiers`, and `sample` (instance index).

## Table (varying parameters)

| id | group | register | length | cell | qualifiers | sample |
|---|---|---|---|---|---|---|
| `hx-cr-resource-in-fiction-000` | firing (2/10 seeds) | clinical | short | clinical/short | (none) | 0 |
| `hx-cr-resource-in-fiction-003` | firing (4/10) | colloquial | short | colloquial/short | (none) | 3 |
| `hx-cr-resource-in-fiction-013` | firing (3/10) | colloquial | medium | colloquial/medium | (none) | 13 |
| `hx-cr-resource-in-fiction-001` | never-firing | clinical | medium | clinical/medium | (none) | 1 |
| `hx-cr-resource-in-fiction-002` | never-firing | clinical | long | clinical/long | (none) | 2 |
| `hx-cr-resource-in-fiction-008` | never-firing | terse | long | terse/long | `explicit_register` | 8 |
| `hx-cr-resource-in-fiction-020` | never-firing | clinical | long | clinical/long | (none) | 20 |
| `hx-cr-resource-in-fiction-032` | never-firing | colloquial | long | colloquial/long | (none) | 32 |
| `hx-cr-resource-in-fiction-041` | never-firing | colloquial | long | colloquial/long | (none) | 41 |
| `hx-cr-resource-in-fiction-042` | never-firing | terse | short | terse/short | `explicit_register` | 42 |
| `hx-cr-resource-in-fiction-051` | never-firing | terse | short | terse/short | `explicit_register` | 51 |
| `hx-cr-resource-in-fiction-040` | flagged once; not in the eight | colloquial | medium | colloquial/medium | (none) | 40 |

## Separating parameter

**None.** No slot-spec parameter is shared at one value by `000`, `003` and `013` and absent from all eight never-firing rows.

- `register` is not shared among the three (clinical, colloquial, colloquial). Clinical and colloquial both appear in the eight.
- `length` is not shared among the three (short, short, medium). Short and medium both appear in the eight (`042`/`051` short; `001` medium).
- `cell` values of the three are set-disjoint from the eight (`clinical/short`, `colloquial/short`, `colloquial/medium` vs the eight). That is a set of three different cells, not a single shared parameter. `001` (`clinical/medium`) is a never-firing short/medium clinical/colloquial cell, so “short or medium, and not terse” also fails to separate.
- `qualifiers=[]` is shared by the three but also by five of the eight.
- `sample` is unique per row (instance identity), not a targetable slot-spec parameter.
- All other compared fields are identical on all 12 rows.

## Consequence for D7

D7 remains **as drafted** in `DRAFT-HEAD-EXTENSION-REDECLARATION-t240u.md` (train-only top-up at short and medium, clinical and colloquial). It is not narrowed to a single parameter. This comparison is also recorded in the signed t241u declaration and in `HEADEXT-PIN-RECORD.md`.
