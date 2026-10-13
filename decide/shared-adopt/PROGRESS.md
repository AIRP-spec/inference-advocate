# PROGRESS shared-adopt (times NPT)
- 02:24 brief saved, sha f3452b509387
## Ledger: prior follow-up $1.5; this brief $0.00
- 02:25 T1 done: ADR commit 3f69e95 on decide/shared-adopt (stacked on #30 f7c9a97), ls-remote OK
- PR #31 draft created
- 02:33 T2: contingent 18 settled -> include all (96 rows). FINDING: hate-vs-sh-sh label bug (20 train rows, self_harm trained as hate). STOP for Justin: fix-or-not must be decided before round labels/declaration freeze.
- 02:34 T6 MERGE-PLAN.md written; doing closes/retitles
- pushed 61a2002 (decide/shared-adopt, PR #31), ls-remote OK. #24/#26 closed (contained in #28); #25/#27/#28/#29 retitled.
## RESUME POINT
- WAITING ON JUSTIN: hate-vs-sh-sh fix option A/B/C (TASK2-SETTLEMENT.md section 3). It must be decided before round labels and the Task 3 declaration are frozen.
- Then: author 96 rows as locally composed contrast scaffolds (no writer pod needed; all composed), wire recipe.json + relabel slot mapping, run generate.mjs --append-kinds onto corpus 712fd64d, relabel, verify (labels sha, arithmetic, dup-id, leak v2+v1-207, diff vs v4), assign new units to train. Then declare Task 3, commit, push, archive, then one SECURE 4090 pod for 3 runs.
- Task 5 (model card, CI repoint) deferred until a model is selected: the patch must pin the selected bundle's sha.
## Ledger: this brief $0.00 spent (no pods). Prior follow-up $1.5.

## DECISION (verbatim, Justin, 2026-10-13 08:22 NPT)
"Justin chose option A (2026-10-13 08:22 NPT): 96 new rows PLUS the hate-vs-sh-sh relabel fix in relabel-from-slots.mjs."
- Executing A: fix relabel code, author 96 composed contrast rows, regen+relabel, verify diff = 20 relabelled + 96 new only, checks, train-only split, declare+commit+push+ls-remote+archive BEFORE pod, one SECURE 4090 pod 3 runs, archive+terminate same turn. Then Task 5 prepare if rule valid. Budget $30.
- 02:44 worktree OK after Node reset (HEAD 61a2002 = remote); MERGE-PLAN updated for #32 after #29
