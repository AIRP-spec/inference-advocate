# STOP: head-extension rerun, G5 re-arm has no valid output for 11 units (t234u)

Written 2026-11-05 08:30 NPT. Branch plan/phase3-recipe-stability, draft PR #35.

## Commits
- 5d9e139: v10-5 spec with the F2 text, G5 time budget, gold audit recorded as disputed.
- 8d476cb: headext_g5.py (decide step) and headext_f5_dup.py, plus tests (104 pass), repinned.
- This commit: g5-decision.json, g5-rearm-manual-verdicts.json, this report.

## Generation pod
- Pod 1gx9y21h95uh5r (hx-g5-gen), RTX PRO 6000, $2.49/h, SECURE, on-demand.
- Ran 07:30–08:20 NPT, 49.6 min, cost $2.059. Archived to the VPS (13/13 sha256 OK), then terminated; pod list is empty.
- Generation spend: $2.145 + $2.059 = $4.204, under the $5.50 cap. Remaining: $1.296.
- Cumulative spend: $41.878, below $45, so no $45 note.
- Nemotron load-time confirmation: the driver gates the Nemotron serve on nemotron_may_start (at least 33 min left). The load wait runs until the deadline minus the 8-min check window (headext_g5_budget.py and test_g5_budget.py). Live run: Nemotron loaded in 12.6 min at t+47.8 and served, then labels and the v4 check finished at t+49.
- Rows: 188 jobs produced 282 rows, with 0 errors and 0 empty.
  - Seed-OSS: 282/282 labels, v4 check flagged 37 true.
  - Nemotron: 282/282 labels, v4 check flagged 23 true.
  - checker_delete: 0 for both.

## Check results per rule
- A13 (either checker flags):
  - rr-claim-vs-deny-x: 10 of 78 deleted (12.8%).
  - rr-role-denial-x: 2 of 26 deleted (7.7%).
  - No kind hit the 30% stop.
- A18 (composed self_harm, non-safety kinds): 1 deleted in cr-direct-vs-fiction and 1 in cr-resource-in-fiction-dialogue.
- A23 (safety kinds, single flag): 5 rows go to the definition check (ids only):
  - hx-cr-direct-vs-fiction-006-b, -007-b, -024-b, -034-b
  - hx-cr-resource-in-fiction-dialogue-023
  - **This check is pending and needs a human. Safety-class text is not read here.**
- Pair integrity: 10 pair units dropped (hx-cr-direct-vs-fiction-002; rr-claim-vs-deny-x 000, 005, 008, 016, 019, 021, 024, 026, 035).
- New rows kept: rr-claim-vs-deny-x 60, rr-role-denial-x 24, cr-direct-vs-fiction 108, cr-resource-in-fiction-dialogue 25.
- F1 re-arm (21 failed B arms, 2 candidates each):
  - 10 units have a valid pick (002, 003, 010, 012, 028, 029, 038, 046, 047, 048). All 10 pass F2 on a manual read.
  - **11 units have no valid candidate: 009, 011, 013, 019, 022, 023, 027, 031, 036, 049, 052.** Most candidates were flagged by one or both checkers; 3 also failed the F2 lexical gate.
  - Manual reading of the flagged candidates:
    - 013, 022, 023, 031, 049 truly take up the role ("just like a friend would be").
    - 009, 011, 019, 027, 036, 052 are mostly bare denials flagged by one checker.

## Why stop
Ruling 2 says every failing arm is regenerated. The decide step would drop these 11 units (22 rows), and that is a row cut ruling 4 forbids. Regenerating them needs another generation pod. The estimate is $3.03 against the $1.296 left, so ruling 4 means stop. Not started: the F5 duplication, pack rebuild, training pods and V0–V3. set-t234.jsonl (4067 rows, sha 626d97db…) is on the box only and is not adopted.

## Options for the owner
(a) Raise the generation cap by about $3.1 for one re-arm pod for the 11 units.
(b) Allow the 11 units to be dropped. That is a row-count cut.
(c) Allow a manual override of the single-checker flags on the bare-denial candidates. That is an A13 deviation.
In all three cases the 5 definition-check rows still need a ruling.
