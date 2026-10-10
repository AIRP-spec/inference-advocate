# PROGRESS-3b (shared-encoding experiment). Times UTC (NPT = UTC+5:45). A successor can resume from this file.
Spend ledger (follow-up total cap $30): prior follow-up GPU ~$0.30 (Task 3a pod). 3b so far: $0.00.
- 18:5x UTC read pipeline: step4/laya-trainpack (train_airp.py, infer_raw.py), adopt/cpu-speed/base (orchestrate.sh, pod.py), step4/scripts offline gate (laya_raw_to_primitives.py, select-composed-f1.mjs, gate_all_ckpts.mjs).
- Design: input [CLS] state [SEP]; encoder = ModernBERT-large from Laya base (rev 55cf4c4e); 17 query heads via 2-layer cross-attention head; RLCD loss unchanged.
- NEXT: write DECLARATION-3b.md, sha256, archive to VPS followup/shared/ BEFORE any pod.
- 18:55Z POD dup4rigvhumek2 created (4090 community $0.34/hr). Pack sha 8637fe93... (pack.tgz). Code on branch decide/shared-encoding-3b (19cbd5e). DECLARATION sha 588e2840...
- 18:56Z pipeline launched on pod (pod_pipeline.sh: preprocess, run A, run B, raw infer)
- 18:58Z pod dup4rigvhumek2 had broken CUDA (torch 'CUDA unknown error' on community host), terminated after ~5 min (~$0.03). Recreating on SECURE.
- 18:58Z NEW POD m1y9qwkkh4kt6p (4090 SECURE $0.89/hr), pack sha c83ee498..., pipeline launched
- 19:03Z Run A training on cuda ok (~1.6 steps/s); run B next; then raw infer. Offline driver scripts/offline_shared.sh ready.
- 19:11Z A done (681 steps, 6 ckpts, 422 s). A ckpts pulled to box (sha == pod). VPS push at 1.8MB/s nice (3a timed benches still running; do not disturb). B training ~45 min.
- 19:36Z RESUMED after interruption. Pod m1y9qwkkh4kt6p up, run B ~step 8.7k/10854. 3a done: 5766 CPU median @500 = 15971 ms (REALLEN.md). Run A=declared same batch numbers (681 steps); run B=declared same step count (~10854); both 3 epochs, ckpt every 0.5 ep. Pulling B ckpts as they finish; pushing to VPS unthrottled (3a finished).
- 19:43Z B done (10854 steps). All 12 ckpts on box. raw infer on pod in progress; VPS push of archive/pod running.
- 19:51Z OFFLINE done: primary selected A-ckpt-epoch-2.5-step-570 (val F1 .8092). v2 E/M/C 17/19/13 (E+M=36 = 5766's 36). converged A 2.0/2.5/3.0 CSE all PASS. Launched pod_post.sh (ONNX export, parity, GPU bench).
- 20:17Z ARCHIVE verified on VPS (MANIFEST 275 files, remote sha -c exit 0 after re-sending 1 partial ckpt). POD m1y9qwkkh4kt6p TERMINATED 20:17Z, uptime 4687s x $0.89 = $1.16 (+$0.03 broken pod). 3b GPU spend ≈ $1.19. GPU latency 7.6/8.3/12.3/27.3 ms median at 50/200/500/1000 (ONNX CUDA). ONNX parity: 471 items 0 flips, max delta 1.8e-4 (CPU). Next: CPU bench on VPS (flock), report, PR.
- 20:25Z CPU bench done (645 ms @500; suite 46 ms). REPORT-3b.md written; archive post manifest verified; PR #30 draft, branch tip 0ef6864. Pod terminated 20:17Z. DONE.
