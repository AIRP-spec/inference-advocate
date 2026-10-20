# P3-1 status 2026-10-19: NOT STARTED (pod never booted), stopped for Justin

- 11:41Z first create attempts: RunPod SUPPLY_CONSTRAINT (no SECURE RTX 4090 in EU-RO-1, the volume's DC).
- 11:43:04Z pod hwnpm3pl732y58 created; `runtime` stayed null for 20 min (no SSH, never started; balance unchanged:
  not billed). Terminated 12:03:22Z.
- 12:03:35Z pod bwkyqzqmrr04p8 created; billing $0.90/h but `runtime` null for 15 min. Terminated 12:18:28Z
  (within the 15-min failure rule). Estimated cost ≤ $0.23.
- No training ran; no outputs; the volume was not touched. Pods: none. RunPod balance $11.65 (before late billing posts).
- Declaration (f6ca5f6) and pack (570ba304…) remain valid; rerun needs only a pod that boots.

## 2026-10-20 retry (Justin: retry 4090 in EU-RO-1, declaration f6ca5f6 unchanged): STOPPED at the headroom check

- 16:56:50Z stock query (GraphQL `gpuTypes … lowestPrice(secureCloud, EU-RO-1)`): stockStatus **Low**, $0.89/h.
- 16:56:57Z create attempt 1 of 3: pod `9bdygsbpj4rjui`; SSH up 16:57:14Z (RTX 4090).
- **Headroom check failed before anything ran.** The network volume (40 GB quota) holds f08 7.3G, f09 11G, f10 8.1G,
  hf-cache 2.3G ≈ 28.7 GB, so free ≈ 11 GB < the declared 16 GB minimum (needed for the 15 kept final checkpoints,
  ≈ 13 GB). Pod terminated 16:57:43Z (≈ 1 min billed, ≈ $0.02). No pack pushed, no training, volume untouched.
- VPS archive re-verified 2026-10-20: `sha256sum -c` of MANIFEST-volume-f08 (112 files), f09 (157), f10 (92) all OK
  against `…/shared-adopt/<f>/volume/<f>` on the VPS. So the volume's f08/f09/f10 dirs are fully archived; pruning
  them (as was done for f05–f07 on 2026-10-18) would free ≈ 26 GB. Not done: deleting volume data needs Justin's OK.
- Pods: none. Phase 3 spend so far ≈ $0.25 (Oct 19 ≤ $0.23 + ≈ $0.02).

## 2026-10-20 prune (Justin approved) and run start

- 17:00:25Z create attempt 2 of the run's limit: pod `x7s114lih7pjrg` (RTX 4090, EU-RO-1); SSH 17:00:59Z.
- 17:01:58Z VPS archive re-verified immediately before deletion: f08 SHA_OK 112 (manifest 5257dcc1…), f09 SHA_OK 157
  (02e56854…), f10 SHA_OK 92 (833f0163…).
- 17:02:06Z deleted `/workspace/f08`, `/workspace/f09`, `/workspace/f10` on volume rmn62wuuzx from the P3-1 pod.
  Free (40 GB quota − du): **before 12 GB, after 37 GB**. Remaining: hf-cache 2.3 GB, pack-f05.tgz.
- Pack `570ba304…` extracted, PACK.sha256 OK, schedule CPU test PASS ×3 on the pod; headroom check passed
  (volume 37 GB, container 40 GB); pipeline started 17:02:46Z.
- 18:41Z status: pipeline alive (pod x7s114lih7pjrg), 7/15 runs done (s40 A0/A1/A2, s41 A0/A1/A2, s42 A0), now p31-A1-s42 avg inference; no errors.
- 19:35Z status: pipeline alive (pod x7s114lih7pjrg), 11/15 runs done (through p31-A1-s43), now p31-A2-s43 inference; no errors. Balance $9.26.
- 19:44Z status: 13/15 runs done (p31-A0-s44 done 19:43:25Z), now training p31-A1-s44; no errors.
- 20:10Z status: 14/15 runs done (p31-A1-s44 done 19:56:59Z), last run p31-A2-s44 at cavg inference; no errors.
- 20:17Z pipeline PIPE_EXIT=0 20:10:28Z, 15/15 runs. Volume MANIFEST-volume-p31 (246aadf4…, 619 files) sha -c OK on the volume; box pull 481 OK. GPU pod TERMINATED 20:15:18Z, pods []. Safety phase (E+M masked) + selection: WINNER A2 (P3-1-SELECTION.json 2c2cf547…, 20:17:08Z); candidate avg-p31-A2-s44 (P3-1-CANDIDATE.json). Committed before E+M.
