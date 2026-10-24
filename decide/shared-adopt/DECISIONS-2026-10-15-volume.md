# Decision note: archive rule change, RunPod network volume first (Justin, approved 2026-10-15)

Recorded 2026-10-15 21:40 NPT brief. Supersedes the "stream to the VPS before terminate" part of the standing archive rule for future pods.

1. Checkpoints are written to a **RunPod network volume**. A **checksum-verified copy on that volume** satisfies the archive rule for terminating the GPU pod.
2. The **VPS copy runs afterwards from the volume, with no GPU pod running**. The VPS remote `sha256sum -c` is still required; it just no longer gates termination.
3. **Before any pod starts**, confirm free space on the network volume and on the VPS, with headroom for the full run, and log both numbers.
4. If any step fails while a GPU is billing, **terminate within 15 minutes once the volume copy is verified**, and report.

Context: the distillation pod `hc0ltnx3rwnvq0` ran about 11.5 h idle (about $10) after the VPS disk filled. Its pod-local volume is now stranded on a host with no free GPU.
