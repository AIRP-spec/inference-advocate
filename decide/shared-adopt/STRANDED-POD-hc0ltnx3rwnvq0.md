# Stranded pod hc0ltnx3rwnvq0: options (read-only check, 2026-10-15 15:59Z / 21:44 NPT)

State: `desiredStatus` EXITED, runtime none, machine `m8cbvltzlan2`, **pod-local volume 60 GB** (`/workspace`) and container disk 50 GB. The account has **no network volumes**, so the data is not on one.

**UPDATE 2026-10-15 22:14 NPT: Justin terminated hc0ltnx3rwnvq0. The following are PERMANENTLY LOST:** s9 ckpt 2.5 and 3.0; s11 ckpt 1.5, 2.0, 2.5 and 3.0 plus s11 raw output and logs, if s11 finished. Whether s11 finished is unknown.

**Checked:** `podResume` gpuCount 1 and gpuCount 0 were both refused again at 15:59Z ("not enough free GPUs on the host machine"), the same as the 4 tries on 14:15–14:43Z. RunPod will not start this pod CPU-only. A pod-local volume can't be detached, migrated or attached to another host or to a network volume; only a running pod on that machine can read it.

| option | what | est. cost | risk |
|---|---|---|---|
| 1. Keep EXITED, retry `podResume` periodically (copy-only) | When a GPU frees on m8cbvltzlan2, start the pod and rsync about 5–6 GB (6 ckpts + s11 raw/logs) to the box, or to a network volume via a second pod. Check `.done` / logs for s11, then stop. No training. | Storage about $0.40/day (60 GB x about $0.20/GB-mo idle) while waiting, plus about 10–15 min of GPU billing at $0.89/h ≈ **$0.15–0.25** once it starts | The host may stay full indefinitely. This starts a GPU-class pod (billed), but only to copy. |
| 2. Terminate | Accept the gaps. The decision is unaffected: s9 and s10 already fail the declared bar. | $0 further; stops the about $0.40/day | Permanent loss of s9 2.5/3.0 and of s11 beyond 1.0 (and s11 results) |
| 3. RunPod support ticket asking for volume recovery or host migration | Manual request. Not something I can do without approval (it's an external submission). | $0 + storage while waiting | Slow, not guaranteed |

Storage accrued so far: EXITED since 00:13:43Z on Oct 15, about 15.8 h ≈ **$0.26**. Not terminated; that's Justin's call.

## Final state (2026-10-15 22:14 NPT)
Pod terminated by Justin. **Permanently lost:**
- distill-s9 ckpt epoch 2.5 and 3.0 weights (s9's epoch-3.0 *raw logits* survive on the VPS and box, so s9 stays gateable)
- distill-s11 ckpt 1.5, 2.0, 2.5, 3.0, s11 raw outputs and s11 logs
- the pipeline.out log, and whether s11 finished training

The archived distill set is `MANIFEST-partial.sha256` `eabfe772…`: 12 ckpts, s9/s10 raw, s10 logs, 100 files, remote sha -c OK. It is final.
