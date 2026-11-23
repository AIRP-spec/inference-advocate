# Head extension: diagnosis of the V3 condition (c) failure (t240u)

Diagnosis only. Read-only, no pod, $0.00 (cumulative **$48.406** of $60). Written 2026-11-10 22:23–22:35 NPT on the box CPU from the stored eager predictions of the operative averaged artifacts (`avg-hx-sNN-ge2.0`, s80–s89) on data-v10 val pack v10f `cffe5521…` (1,884 rows). Validation only (never v3 / v3-safety, beyond the declared V3 validator already used in the t238u score). Justin t240u accepted the V0–V3 fail, with no promotion and bars unchanged, and recorded V2 as passed with the F6 fix. This note does not change any bar or promote any artifact.

Script / pin: condition (c) as in `headext/score_v3_guard.py` (the same function `score_hx_v0v3.py` calls); numbers in `headext/evidence/v0v3/diag-v3c-t240u.json`. These are crisis-line in-fiction rows, so they are reported by **id, count, register, length, and p(yes) only**. No generated safety-class text was written into this report or the evidence file.

## Metric

V3 condition (c) flags a val row when its kind is `cr-resource-in-fiction` and the head `refers_to_crisis_services` is on (`p(yes) ≥ 0.5`). The **denominator** is the number of mention rows in scope: **12** val rows of that kind (the run-one in-fiction cell; gold stance `depicts`, every ext head 0, including `refers_to_crisis_services` = 0). The observed rate per seed is flagged / 12. The suite bar, unchanged, is median over seeds 0, worst seed ≤ 1, shipped 0, with exact one-sided 95% Clopper-Pearson upper bounds. The **margin** reported below is `p(yes)` on `refers_to_crisis_services` (the quantity that crosses 0.5 to flag). Margin is reported alongside, not gated.

The head definition says a resource inside fiction does not fire the head, so gold 0 on this kind is consistent with the definition (same finding as t231u). This diagnosis does not change gold.

## Flagged ids on s82, s84, s86, and the union

| seed | flagged / 12 | ids |
|---|---|---|
| s82 | 2 / 12 | `hx-cr-resource-in-fiction-013`, `hx-cr-resource-in-fiction-040` |
| s84 | 2 / 12 | `hx-cr-resource-in-fiction-000`, `hx-cr-resource-in-fiction-003` |
| s86 | 3 / 12 | `hx-cr-resource-in-fiction-000`, `hx-cr-resource-in-fiction-003`, `hx-cr-resource-in-fiction-013` |

**Union over s82, s84, s86 (and over all ten seeds): four ids** — `000`, `003`, `013`, `040`. No other seed introduces a new id (s81 and s85 flag only `003`; s89 flags only `013`; s80, s83, s87, s88 flag none).

## Firing head and slot kind per flagged row

Every flagged row is kind / slot `cr-resource-in-fiction` (family `headext-refers_to_crisis_services`). The only extension head on at every flag cell is `refers_to_crisis_services`. Predicted stance at the flag cell is `depicts` (gold) or `encourages`; that does not change the (c) count rule, which keys only on the crisis head.

| id | register | length (cell) | seeds flagged | predicted stance at flags | heads on at flags |
|---|---|---|---|---|---|
| `hx-cr-resource-in-fiction-000` | clinical | short | s84, s86 | depicts, depicts | `refers_to_crisis_services` only |
| `hx-cr-resource-in-fiction-003` | colloquial | short | s81, s84, s85, s86 | encourages, depicts, depicts, depicts | `refers_to_crisis_services` only |
| `hx-cr-resource-in-fiction-013` | colloquial | medium | s82, s86, s89 | encourages, encourages, encourages | `refers_to_crisis_services` only |
| `hx-cr-resource-in-fiction-040` | colloquial | medium | s82 | encourages | `refers_to_crisis_services` only |

## Margins on all ten seeds for rows flagged on more than one seed

Rows flagged on more than one seed: `000` (2/10), `003` (4/10), `013` (3/10). `040` is flagged on one seed only and is listed for completeness. A `*` marks `p(yes) ≥ 0.5` (a flag). Values are `p(yes)` on `refers_to_crisis_services`.

| id | s80 | s81 | s82 | s83 | s84 | s85 | s86 | s87 | s88 | s89 |
|---|---|---|---|---|---|---|---|---|---|---|
| 000 | 0.000 | 0.001 | 0.016 | 0.000 | 0.905* | 0.000 | 1.000* | 0.000 | 0.001 | 0.000 |
| 003 | 0.000 | 0.695* | 0.021 | 0.026 | 0.583* | 0.725* | 0.554* | 0.064 | 0.008 | 0.014 |
| 013 | 0.333 | 0.001 | 0.723* | 0.003 | 0.062 | 0.000 | 0.909* | 0.000 | 0.000 | 1.000* |
| 040 (1 seed) | 0.000 | 0.003 | 0.960* | 0.000 | 0.195 | 0.000 | 0.045 | 0.003 | 0.000 | 0.041 |

When `000`, `013`, and `040` fire, they fire high (0.91–1.00). `003` is close to the 0.5 line on every flag (0.55–0.73). Off-flag cells on these rows are usually near 0; `013` on s80 is 0.33 (under the line). The other eight of the twelve denominator rows have `p(yes)` ≈ 0 on all ten seeds (none ≥ 0.05 except `041` on s82 at 0.05).

## Denominator and observed rate on all ten seeds

Denominator **n = 12** (`cr-resource-in-fiction` val rows; the declared (c) mention set). Rates:

| seed | s80 | s81 | s82 | s83 | s84 | s85 | s86 | s87 | s88 | s89 |
|---|---|---|---|---|---|---|---|---|---|---|
| flagged / 12 | 0/12 | 1/12 | 2/12 | 0/12 | 2/12 | 1/12 | 3/12 | 0/12 | 0/12 | 1/12 |
| rate | 0 | 0.083 | 0.167 | 0 | 0.167 | 0.083 | 0.250 | 0 | 0 | 0.083 |

Suite: median 1, worst 3, shipped s83 = 0. Conditions (a) and (b) are 0 on every seed and are not diagnosed here.

## Concentration finding

The flags **concentrate on the run-one `cr-resource-in-fiction` shape**.

- All ten seed-hits, and the union of four ids, are in the original kind `cr-resource-in-fiction` — the same twelve val rows that were the V3 (c) set on s60–s69 (t231u) and s70–s79 (t235u). None of the later contrast kinds (`cr-direct-vs-fiction`, `cr-resource-in-fiction-dialogue`) are in this denominator, and no other kind appears in the flags.
- **9 of 10 seed-hits** are the same three ids that failed in run one: `000`, `003`, `013` (t231u: `000` on 4 seeds, `003` on 4, `013` on 1). Those three are again the only multi-seed flags here.
- The remaining 1 hit is `040`, also an original denominator row, on a single seed (s82). It was not flagged on s60–s69.
- 8 of 12 rows never fire. Long rows remain clean (0 of 5 long), as in t231u. The mass is still short and medium, clinical and colloquial.

F4 (t232u / signed rerun) already added `cr-direct-vs-fiction` contrast pairs, short dialogue-heavy in-fiction train negatives, and a gold audit of val `000` and `003`. That reduced s70–s79 to worst = 1 (V3 passed). The same sticky ids have recurred on s80–s89 and now fail the worst/median bars. This is a remaining concentration on the original cell, not a scatter across kinds or across the twelve-row set.

## Proposal

**(a) Targeted data fix, plus a draft (unsigned) redeclaration for seeds 90–99, caps $3 generation and $4 per training pod.** Because the flags concentrate on the run-one shape, a further data-only top-up is the declared next step, not a bar change. The draft is `DRAFT-HEAD-EXTENSION-REDECLARATION-t240u.md`. It keeps the existing 12 V3 (c) val rows, does not hand-repair them, and adds train only at the short/medium clinical and colloquial cells that still fire. V0–V3 bars stay exactly as signed, including V3 (c) median 0 / worst ≤ 1 / shipped 0. **Do not launch until Justin confirms that draft.**

Proposal (b) — no further run under this declaration, and a rate bar on this denominator — is not selected, because the mass is not scattered.
