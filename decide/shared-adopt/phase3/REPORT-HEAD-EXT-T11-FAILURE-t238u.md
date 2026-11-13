# t238u — hx-t11 failure root cause (2026-11-10)

Recorded 2026-11-10 20:05 NPT. Pod two `hx-t11` (`sn9oxtiyzdrqsd`) terminated 12:53:51Z after a failed first pull of seed 86. Seeds 85 and 86 were later archived and checksum-verified on the Nepal VPS. Seeds 87–89 were not completed. v3 / v3-safety untouched.

## What failed

At 12:49:46Z the driver raised:

```
RuntimeError('cmd failed rc=2: ssh -i /home/box/.ssh/runpod_airp ... :: tar: Unexpected EOF in archive')
```

That command is the **pod → box** archive in `pull()`: `ssh -i runpod_airp` to the RunPod host, `cd /root/hx && tar cf - … | tar xf -` on the box. The exit status is from the **local** `tar xf` (rc=2). The stream from the pod was cut off mid-archive.

This is not the Nepal VPS path. VPS copies use `nepal_vps_servetus` to `203.134.250.85:2060` and are logged as `VPS pipe retry`. Those retries ran in the same window (12:30–13:11Z, and later on the weights queue) but on a different SSH target.

## Why it was not pod death or volume corruption

- 12:43:45Z: `RUN_DONE hx-s86` and `RUN_START hx-s87` — the pipeline was still running.
- 12:46:26Z: the driver saw those lines and started `pull(hx-s86)`.
- 12:49:46Z: first pull failed with the truncated tar (~3 min into the transfer).
- 12:53:12Z: the `finally` late-pull of `hx-s86` from the **same still-live pod** succeeded: 41 files, box `sha256sum -c` OK, VPS outputs `sha256sum -c` OK.
- 12:53:51Z: pod terminated, 3.7 min after the failure (within the 15-min rule).

A dead pod would not have served a complete late pull four minutes later. The network volume write for s86 had already printed `VOL_OK` before the failed pull, so the volume path for s86 was already verified in-pod.

## Separate issue: intermittent Nepal VPS timeouts

Box → VPS weight tars (~1.6 GB) timed out repeatedly (`Timeout, server 203.134.250.85 not responding`, retries 1–5). The VPS itself was not rebooted or terminated; short commands (ledger, `sha256sum -c` of outputs, directory listings) kept working. `hx-s86` weights eventually verified on the VPS at 14:00Z via the driver's queue. `hx-s85` weights failed in the driver after five retries (partial `keep/` left on the VPS). A later hand-push from the box-verified tree (staged dir, then swap) completed; both `SHA256SUMS` and `SHA256SUMS.weights` checked OK on the VPS at 20:05 NPT (see `evidence/g6/vps-verify-s85-s86.json`).

These VPS timeouts correlate in time with the pod-pull failure but are a different path. They do not explain the `runpod_airp` tar EOF.

## Seed 87 on the volume

`pod_pipeline_hx.sh` writes `$VOL/$R` with `VOL=/vol/<pod-name>`. A partial `hx-s87` would be under `/vol/hx-t11/hx-s87` on volume `jq8pseh4f0`. The volume is not mounted when no pod is running, so it cannot be listed from the box. The pipeline had started s87 at 12:43:45Z and was then `pkill`ed after the pull failure; any volume write for s87 would be incomplete (s87 never reached `VOL_OK` or `RUN_DONE`). The driver result recorded s87/s88/s89 as `not_started` because `pull(s86)` raised before the monitor loop set s87 to `running`. A short third pod named `hx-t12` writes `/vol/hx-t12/`, so it will not collide with leftover `/vol/hx-t11/hx-s87`. Seeds 87–89 must be retrained.

## Finding

The 12:49Z failure was a **truncated SSH tar stream on the box ↔ RunPod path** during the first `hx-s86` pull, not pod death, not a bad pack, and not Nepal VPS unavailability. The same pod later served a complete late pull. Seeds 85 and 86 are fully verified on the VPS (outputs and weights). A short third pod for 87–89 is safe on a new volume prefix, provided the VPS is reachable for archiving at launch.

## Spend (at this note)

| pod | cost | notes |
|---|---|---|
| hx-g6-gen | $0.895 | already in the t237u ledger |
| hx-t10 | $0.940 | seeds 80–84, failure:False |
| hx-t11 | $0.882 | seeds 85–86 archived; 87 cut; failure:True |
| cumulative (ledger sum + $4.75) | **$47.778** | $60 ceiling not crossed |
