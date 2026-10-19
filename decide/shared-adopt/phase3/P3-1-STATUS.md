# P3-1 status 2026-10-19: NOT STARTED (pod never booted), stopped for Justin

- 11:41Z first create attempts: RunPod SUPPLY_CONSTRAINT (no SECURE RTX 4090 in EU-RO-1, the volume's DC).
- 11:43:04Z pod hwnpm3pl732y58 created; `runtime` stayed null for 20 min (no SSH, never started; balance unchanged:
  not billed). Terminated 12:03:22Z.
- 12:03:35Z pod bwkyqzqmrr04p8 created; billing $0.90/h but `runtime` null for 15 min. Terminated 12:18:28Z
  (within the 15-min failure rule). Estimated cost ≤ $0.23.
- No training ran; no outputs; the volume was not touched. Pods: none. RunPod balance $11.65 (before late billing posts).
- Declaration (f6ca5f6) and pack (570ba304…) remain valid; rerun needs only a pod that boots.
