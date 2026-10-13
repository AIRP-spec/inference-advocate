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
- 02:48 DECLARATION-3 sha 6bdaa173 committed+pushed 6332c26, archived VPS MANIFEST-pre-pod; pack ready
- 02:48 pod create attempted
- 02:52 pod 02nqe5hbxwt3p4 SECURE 4090 $0.89/hr UP; pack pushed; pipeline started
- 02:54 base2 training ~ep0.55; first ckpt saved; GPU OK. Est ~75-90min for 3 runs+infer.
- 03:03 STOPPED pod 02nqe5hbxwt3p4 per Justin 08:47: kind-table audit before any training
- 03:05 Justin 08:47 audit: hate NOT confirmed as cause; kind-table rewrite; diff vs v4 = exactly 20 hate-vs-sh-sh. PROCEED. Prior pod terminated (base2 ckpts discarded, not archived).
- 03:07 fresh pod 2oh6ncux3wsml1 SECURE 4090 $0.89/hr; pipeline started after kind-table audit. Ledger: prior ~$0.25 discarded pod + this run.
- 03:44 PIPELINE_DONE; pulling archive
- 03:53 resume: pipeline already DONE; offline gated; pod still up; finishing archive+terminate
- 04:13 Justin 09:58: report wording (retrained not reproduced; reflexive-pair next step). Pod kept up; archive pipe continues.
- 04:35 archive MANIFEST verified; pod 2oh6ncux3wsml1 TERMINATED
- 04:35 committed+pushed; Task 5 prep done; DONE for this stop
## Ledger final: this brief ~$1.61; prior follow-up $1.5; total ~$3.11 of $30. Pods empty.
- 10:50 Justin accepted round result. Labels v5 = further-training base; future rules = per-seed / worst-seed (never mean). Recorded in DECISIONS note + ADR §8.
- 10:50+ CSE-FAILURES.md from archived gates (no new CSE rows). DECLARATION-AVG.md written BEFORE averaging/gating. Best single-round v2 E+M = 31 (round2 ep 2.5).
- 10:50–avg: DECLARATION-AVG declared/pushed/archived before gating. VPS CPU avg+infer under flock. Neither average recommended (CSE fail; v2EM 64>31; sh FN=0). Ensemble ref also CSE fail. STABILITY-SWEEP-PROPOSAL written (not run). Spend +$0; total ~$3.11/$30.
- 11:13 Justin approved full 12-run sweep. DECLARATION-SWEEP written; averaging-init note in DECISIONS + ADR.
