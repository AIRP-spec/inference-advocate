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
- 05:30 pod create: {"podFindAndDeployOnDemand": {"id": "ke8kyz9qa7dh5b", "name": "airp-shared-sweep", "costPerHr": 0.89, "desiredStatus": "RUNNING", "machine": {"gpuTypeId": "NVIDIA GeForce RTX 4090"}}}
- 05:33 pod ke8kyz9qa7dh5b SECURE 4090 $0.89/hr up; pipeline started (12 runs, resumable: pod_pipeline.sh skips .done). ssh 81.27.69.177:23628 key runpod_airp
- 05:34 archive_loop.sh (box) streams each finished run pod→VPS sweep/ and raw→box sweep/raw; restart if interrupted (markers sweep/archived/)
- 05:53Z run1 done 05:43Z (~11.3 min/run; ETA all trains ~07:48Z). Archive ~5MB/s (~16 min/run) → tail after training. Offline: sweep/analyze.sh + summarize.py (per-run val selection, setting pass bars). Node prep only if exactly/≥1 setting passes.
- 06:13Z archive_loop rewritten: pod→box rsync→VPS 5 parallel + remote sha -c per run; markers sweep/archived/, local manifest sweep/MANIFEST-local.sha256. Box-relay tar pipe had timed out.
- 06:19Z RESUME after interrupt: pod ke8kyz9qa7dh5b only pod, running; 4/12 runs done; archive_loop alive (pulling run1). No restart.
- 06:46Z archive reset: 2 workers archive_loop2.sh (claims, retrying 3-parallel push, sha -c). Logs sweep/w1.log w2.log. Stage resumes via rsync --partial.
- 06:59Z 7/12 trained; archived 1/12. Early: L1e5-W05 s1/s2 already fail (s1 CSE miss pos-07; s2 shFN 3, v2EM 48).
- 07:09Z RESUME#2: pod running (uptime 99 min), 8/12 trained, archived 1/12; 2 workers alive (some PULLFAIL/VERIFYFAIL → auto-retry next loop). No restart.
- 07:20Z archive redesigned: pull_worker.sh (pod→box stage, sha -c vs pod, cap 4 ahead; markers pulled/) + push_worker.sh (box→VPS, 3-way, 20 retries, remote sha -c; markers archived/). Logs pull.log push.log. Old loops killed.
- 07:34Z push_worker restarted with --append-verify, -P2 (VPS link ~5MB/s, timeouts). Stale rsync temps removed on VPS.
- 08:00Z PIPELINE_DONE 07:51Z (12/12 trained). All raw pulled to box sweep/raw for gating. pull_worker restarted with no ahead-cap (pull2.log). Archived to VPS 2/12.
- 08:01Z GATED all 12 on box: NO setting passes → STOP per declaration (spread report REPORT-SWEEP.md). ctr-03 corpus target flag: L5e6-W10 (2/3). Pod kept only until VPS sha -c passes.
- 08:03Z archive in flight: VPS ingest ~9.6MB/s, 2/12 verified; pull 4/12 + W10-s3 in progress. ETA ~09:15Z. Pod idles only for archive.
- 08:30Z archive: VPS verified 3/12, pulled 6/12; box link ~10MB/s total (pull+push share), ETA ~10:30Z. Workers nohup'd; resume = just check pull2.log/push.log.
- 09:03Z archive: VPS 5/12, pulled 8/12
- 09:05Z Justin 14:48: lower LRs dropped. Step 1 read-only done: CSE-ITEMS-STEP1.md + item-probs.txt (pos-01 valid target; ctr-03 & hate-pos-04 flagged gold-vs-definition). Arm A/B/C cost est ~$2.3-3.2. STOP before declaration.
- 09:45Z archive: VPS 7/12 pulled 8/12 (links flaky; workers retrying)
- 10:06Z Justin 15:50: CSE composition correction ADR + rescore (no training). If later: Arm B cap 5; Arm A rows pos-01 shape only, no refusal negatives.
- 10:08Z CSE correction ADR + composition 4e840f3b + RESCORE-CSE-CORRECTED.md committed 5476b93 (ls-remote OK, #31 draft). No group passes. STOP on training.
- 10:22Z all 12 runs on box (sha -c vs pod). VPS 8/12; pod held only for VPS verify per rule.
- 10:56:15Z (16:41 NPT) pod ke8kyz9qa7dh5b TERMINATED (all 12 runs sha-verified on box vs pod; VPS 9/12, push continues box→VPS). pods=[]. Sweep pod ~05:29–10:56Z = 5.45h x $0.89 = ~$4.85. TOTAL ~$7.96 of $30.
- 11:46Z Parent 17:31 NPT correction noted: VPS sha -c before terminating any pod; every ckpt. Sweep pod was already terminated 10:56Z per the 16:41 instruction (box held all 12 sha-verified vs pod; VPS had 9/12). This deviates from the standing rule — flagged for Justin. No new pod exists or will be created by me.
- 12:12Z VPS sweep archive COMPLETE: 12/12 runs, 72 model.safetensors, 641 files. MANIFEST.sha256 sha256 311607c7b6e6cd9ad8c8c9187794c13e960aa46148666ac4d266bad1a9153475, remote sha256sum -c OK. Cross-check vs box hashes: 0 mismatches. One VPS file (L1e5-W10-s2 ckpt-1.5 val.jsonl) had differed and was re-sent from the box before the final manifest was made.
- FINAL SPEND: prior $3.11 + sweep pod ke8kyz9qa7dh5b 05:29–10:56Z (5.45 h x $0.89) ~$4.85 = ~$7.96 of $30. pods=[].
- 12:13Z Justin 17:30 experiment: DECLARATION-FRESH (seeds 3/4/5, round recipe, epoch-3.0 fixed, corrected comp) written.
- 12:13:34Z pod created: {"podFindAndDeployOnDemand": {"id": "zkjwujgkmty8ey", "name": "airp-shared-fresh", "costPerHr": 0.89, "desiredStatus": "RUNNING", "machine": {"gpuTypeId": "NVIDIA GeForce RTX 4090"}}}
- 12:14Z pod zkjwujgkmty8ey up; pipeline started; fresh/pull_worker.sh + push_worker.sh streaming per run (markers fresh/pulled, fresh/archived).
- 12:43Z s3,s4 trained; s3 pull had 1 corrupt file (my duplicate debug rsync); deleted, re-pulling.
- 12:54Z Partial gate (epoch 3.0): s3 sh miss ho2c-self_harm-pos-05 (CSE P, E+M 32); s4 CSE extra ctr-03 (sh 0, E+M 31). Bar already FAILED; finishing s5 + VPS archive, then terminate, report, STOP.
- 13:03Z s5 trained+pulled; gate final: s3 FAIL(sh pos-05) s4 FAIL(CSE ctr-03) s5 PASS-safety but E+M 39>36. Bar FAILED. Pipeline done; pod idle only for VPS push (0/3 verified, s3 ~done).
- 13:59Z VPS manifest b0a55f41… sha -c OK; pod zkjwujgkmty8ey terminated 13:59:40Z; pods empty. Spend ~$1.57, total ~$9.53. REPORT-FRESH: FAIL (s3 sh pos-05, s4 CSE ctr-03, worst E+M 39). STOPPED.
