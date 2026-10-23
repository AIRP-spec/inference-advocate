# decide/step4 PROGRESS

- DECLARATION committed `9127136` at 2026-10-05 09:36:52Z (15:21 NPT) BEFORE any pod start.
- Split: same group-held-out ids as Laya retrain; v4 labels. train/val sha `4cdf51b6…` / `46789984…`. Split-definition sha `a1b26aa5…`.
- Qwen SFT train-only: 123012 rows, prompt `f118809a…`, labels `6399fd4a…`, sft sha `d15c572a…`, meta sha `a2861945…`.
- Pods: Laya `iauzudzp6gtcys` RTX 4090 $0.74/hr; Qwen `6x6rfws1x4i15e` A100-80GB $1.59/hr. Prior spend $3.39; hard stop $40.

- 2026-10-05 15:28 NPT: Both trains RUNNING. Laya preprocess 123012 seq OK, training started. Qwen ~1% / 11535 steps @1.56 it/s (~2h). Watchers armed for post-infer. VPS step4 dir created. Monitor PID active.

- 2026-10-05 16:09 NPT: RESUME after interrupt. Monitor alive (PID from 09:42Z). Both pods RUNNING (~46 min). Laya train_airp progressing ~ep 0.94 / CK-1922 saved; Qwen ~32% step~3656/11535 CK-1922 saved. Watchers waiting for train exit. No restart. Est remaining: Laya ~40–60m train+infer; Qwen ~90m train + infer. Spend running_est ~$1.7 + prior $3.39 ≈ $5.1 / $40.

- 2026-10-05 16:17 NPT: Step3 CPU (VPS, one-pass batched ONNX, 471 items, 8 threads): fp32 median 2379 ms / p95 2727 ms; int8 median 1209 ms / p95 1463 ms; over_1024=0. Clause 3 (<1s) FAILS for both. Step3 still running perq mode. Trains still going: Laya ~ep1.17 CK 1922+3844; Qwen ~39% CK 1922+3844. Spend ~$5.5/$40.

- 2026-10-05 16:42 NPT: Resume check. monitor.sh + wait_trains.sh alive. Both trains progressing (no crash). Laya ~ep1.73 CK 1922/3844/5766; Qwen ~58% step~6636/11535 same CKs. Pod watchers alive. Spend ~$6.4/$40. Waiting for train completion then post-infer.

- 2026-10-05 16:58 NPT: Healthy. Laya ep≈2.15 CK-7688 (ep2.0); Qwen ~71% + CK-7688. Monitors+pull waiters alive. Est remaining train Laya ~25–35m, Qwen ~35–40m then post-infer. Spend ~$7.09/$40.
- 2026-10-05 17:01 NPT: finish_laya PID 546741 + finish_qwen PID 546742 detached. Fixed finish_laya terminate-confirm syntax. Suite uploaded to Qwen. Spend ~$7.22/$40. Waiting on trains→post-infer→archive→kill per pod.
- 2026-10-05 17:03 NPT: Laya ep≈2.27 CK≤7688; Qwen ~75% (~32m train left). Finishers+monitor alive. VPS step4 dir OK; archive deps OK. Multi-ckpt gate wrapper ready. Spend ~$7.3/$40.
- 2026-10-05 17:13 NPT: Laya ep≈2.53 CK-9610 (ep2.5) saved; Qwen ~83% (~22m train). Finishers alive. Spend ~$7.69/$40.
- 2026-10-05 17:18 NPT: Laya FULL_TRAIN_EXIT seen. Post-infer should start via laya-watch; finish_laya waiting to archive+terminate.
- 2026-10-05 17:18 NPT: Laya FULL_TRAIN_EXIT:0; 6 CKs through ep2.6-step-10099. post-infer (infer_raw) RUNNING. finish_laya will archive+terminate when POST_INFER_DONE. Qwen ~87% train.
- 2026-10-05 17:35 NPT: Qwen train COMPLETE (6 LoRA CKs incl 11535). setup-and-train tripped after success (no TRAIN_END). Marked done + kicked merge_gguf_infer. Laya pull 4.4G OK, VPS upload in progress.
- 2026-10-05 17:36 NPT: Laya extract on box (4.8G). VPS archive upload in progress. Started offline Laya raw→prims/select/gate. Qwen: compiling node-llama-cpp CUDA then merge_gguf. Spend ~$8.6/$40.
- 2026-10-05 17:38 NPT: Laya SELECTED ckpt-epoch-1.5-step-5766 (val macro-F1 0.8259). Gate v2 E/M/C=16/20/13; CSE pass on all converged (7688/9610/10099). Fast tarball archive to VPS in flight then terminate. Qwen CUDA compile ~40%+.
- 2026-10-05 17:50 NPT: Qwen pod IDLE (GPU 0%, no merge). Restarted run_post_infer.sh (build nlc if needed → merge_gguf → greedy). Laya scp ~3.6/4.4G to VPS.
- 2026-10-05 17:50 NPT: Qwen merge LIVE (EXPORT ck-3844 GGUF writing; nlc CUDA already built). finish_qwen2 armed. Laya scp ~3.8/4.4G. Spend ~$9.1/$40.
- 2026-10-05 17:53 NPT: Laya MANIFEST fixed+verified; TERMINATED iauzudzp6gtcys. up=9032s cost=$1.86. Path: /root/primitives-evaluator/decide-2026-10-05/step4/laya-pod
- 2026-10-05 17:54 NPT: Fixed Qwen greedy failure root cause (node-llama-cpp not resolvable from /workspace/decide-step4; added symlink+NODE_PATH+cwd). Restarted merge. finish_qwen3 armed (no auto-restart). Laya TERMINATED $1.86. Only Qwen billing.
- 2026-10-05 17:59 NPT: Greedy API fixed (passTokens). Smoke OK (~0.25s/item). Full merge restarted with skip-if-done. Laya TERMINATED $1.86. Only Qwen billing.
- 2026-10-05 18:05 NPT: Qwen checkpoint-3844 FULL greedy DONE (val+heldout). Pipeline healthy. Remaining 5 CKs + latency then archive+terminate. Laya already dead.
- 2026-10-05 18:05 NPT: Qwen ck-3844 val DONE (819); heldout ~225/471 @~0.24s/item. GPU busy. finish_qwen3 waiting. Est ~40–50m for remaining 5 CKs+latency. Spend ~$9.6/$40 (Laya $1.86 closed).
- 2026-10-05 18:07 NPT: Qwen DONE ck-3844; EXPORT ck-5766 started. finish_qwen3+all-wait alive. Est ~35–45m to ALL_INFER then archive+terminate.
- 2026-10-05 18:14 NPT: Qwen DONE count progressing (see chunk2 log). finish_qwen3 alive.
- 2026-10-05 18:24 NPT: Qwen DONE 3/6 (3844,5766,7688); INFER 9610. ~2 CKs+latency left (~15–20m). Spend ~$10.1/$40. Laya closed $1.86.
- 2026-10-05 18:40 NPT: Resume. Qwen DONE 5/6; INFER ck-11535 in progress (GPU 75%). finish_qwen3 alive. Spend ~$5.23 running + $5.25 closed ≈ $10.5/$40.
- 2026-10-05 18:44 NPT: Qwen all 6 CKs DONE. Latency pass likely running; finish_qwen3 will pull/archive/terminate on ALL_INFER_DONE.
- 2026-10-05 18:44 NPT: Pulled Qwen primitives for all 6 CKs (latency still building on pod). Starting offline select/gate.
- 2026-10-05 18:48 NPT: Resume chunk. Qwen post-infer ALIVE (47m); latency phase (infer running, GPU?); finish_qwen3 waiting. 6/6 prims already on box. Spend ~$5.4 running + $5.25 closed ≈ $10.7/$40. Report draft ready (recommend stay Qwen; Δ=-19; CSE pass; CPU 2379ms FAIL).
- 2026-10-05 18:52 NPT: Latency phase mid-flight (LE ~471 items done ~13:02Z; scored modes likely running silently — task2 scored ~2.9s/item → ~20–40m). finish_qwen3 alive. Cost ~$5.53 running. Will wait ALL_INFER then archive+terminate.
- 2026-10-05 19:12 NPT: Latency scored modes still running (node 26m+, CPU 35m; GPU ~5%). Est ~15–20m to ALL_INFER then archive. Cost ~$6.08. Decision already locked (stay Qwen; clause 3 fail).
- 2026-10-05 19:34 NPT: PRIORITY terminate. ALL_INFER_DONE+PULL_OK (279M local). finish_qwen3 stuck on VPS scp; pod idle ~$6.64. Terminating NOW then finish archive off-pod.
- 2026-10-05 19:36 NPT: Qwen pod TERMINATED (API confirm empty). up=15092s cost=$6.67. Local tarball 279M; VPS scp still in flight (finish_qwen3).
- 2026-10-05 19:41 NPT: Qwen MANIFEST verified on VPS step4/qwen-pod (279M tgz OK). Pod already TERMINATED. Cost $6.67. Next: finalize report + draft PR.
- 2026-10-05 19:43 NPT: COMPLETE. Pod terminated $6.67. MANIFEST OK. Draft PR #28. ls-remote tip 80c604b MATCH. Recommend stay Qwen (Δ=-19 PASS, CSE PASS, CPU 2379ms FAIL).
