# Head-extension retrain: pre-pod prerequisites NOT met, no pod started (2026-11-02 ~07:35 NPT)

Checked against the signed declaration `DRAFT-HEAD-EXTENSION-DECLARATION.md` (Justin t213u 01:57 NPT, commit 445afe4) after
the v3-safety seal was promoted (evaluator-suite `1ee40eeb`). **No pod was created, no spend, and the declaration was not amended.**
RunPod REST `pods = []`. Cumulative GPU $27.63 / $60. Balance $33.28 (07:30 NPT).

## Prerequisites (declaration §1, §3, §5, §6)
| # | prerequisite | status | evidence (counts only) |
|---|---|---|---|
| 1 | Each of the eight heads has ≥ 60 in-distribution val positives (counted before training) | **UNMET: 0 for every head** | data-v9 val `964c2b21…` (873, sha re-verified on VPS) and train `13c86ea7…` (7386): 0 rows carry any of the eight head names in any label field. None of the eight are in `primitives/vocabulary.json` or `kind-label-table.json` either. Under §1 every head would be dropped, so a retrain now would be 17 → 17 with no new heads (no valid output for the declaration's purpose). |
| 2 | Offer-shape `self_harm` training rows + a **different** held-out offer sub-group | **UNMET** | No slot spec, no rows, sub-group not named. |
| 3 | Hate-eliminationist negatives for the `self_harm` object | **UNMET** | No slot spec, no rows. |
| 4 | data-v10 pack built (§3.1–3.4 + RH relabel of the 20 val rows), leakage asserts, sha pinned in a pre-pod addendum | **UNMET** | No data-v10 on the box or VPS. The RH overlay val file exists (`v3-collect-20261101/t213u-rescore/val-v9-rhrev.jsonl`) but is not packed. |
| 5 | Code tested: 25-head training (soft-mix 0.5 on 17, hard labels on new heads), V2 pair scoring, V3 guard scoring, per-head floor gate | **UNMET** | Not written. P3-3 `pod_pipeline_a3.sh` / `option_b_a3.py` cover the 17 heads only. |
| 6 | V2 ≥ 6 contrast pairs per head asserted on the pack before any training pod | **UNMET** | Depends on 4. |

## Rules that are missing or deferred (cannot be filled without amending, so I stopped)
1. **Row sizing for generation.** `EXTENSION-NY-HEADS.md` (Amendment 1) says the val sizing (≥ 60 positives per head, ≥ 480 positive val rows,
   from more than one shape group per head) and its cost "are re-estimated in that declaration, not here". The signed declaration §3.1 only
   refers back to that file ("≥ 24 seed pairs per kind"), whose 388/50 per-head figures it calls pre-amendment. So no signed per-head train/val row counts exist.
2. **Offer sub-groups.** Which register × framing sub-groups get training rows, and which one is held out, are not named.
3. **Hate-elim group size and split** ("sized in that phase's declaration, not here", which never happened).
4. **Generation pod plan.** §6 gives caps ($4 / 90 min, Qwen3-30B self-hosted), but no row count, so no time or cost estimate can be checked against the 90-minute cap.
5. **Existing-row labelling on the new heads.** `kind-label-table.json` mapping plus the `reviewSampleSize` 700 audit: who reviews, and the pass rule, are not stated.
6. **`conveys_method` arms for disordered_eating / substance_misuse** "from collected material only". The source set (which collection, train-role only) is not named.

## What would unblock it (for Justin; I did not draft an amendment)
A pre-pod sizing addendum giving items 1–6, signed. Then, in order: slot specs + generator code + tests (no pod) → **generation pod** (Qwen3-30B,
cap $4 / 90 min) → label + assemble data-v10 + asserts + per-head ≥ 60 count + pair count → pack pin (pre-pod addendum, sha) → **training pod**
(N = 10, seeds 60–69, cap $6). Worst case GPU at both caps: $27.63 + $4 + $6 = **$37.63**, under the $45 stop-and-report line.
