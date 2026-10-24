# REPORT FRESH-05: distillation, seeds 12/13/14, epoch 3.0, 0.5 cutoffs

Declaration: `DECLARATION-FRESH-05.md` (cf6a9aa, sha 63373a69…), run exactly as declared. Times UTC (NPT = UTC+5:45), 2026-10-18.

## Result: PASS on all three seeds. s13 selected. Both ship gates met. Stopped for Justin; nothing published.

| Seed (epoch 3.0, 0.5 / argmax, T=1) | v2 extras / misses | E+M | CSE | self_harm misses | val composed macro-F1 |
|---|---|---|---|---|---|
| s12 | 19 / 14 | 33 | clean | 0 | 0.7624 |
| **s13** | 18 / 16 | 34 | clean | 0 | **0.8047** (selected) |
| s14 | 14 / 16 | 30 | clean | 0 | 0.7844 |

- Bar: CSE clean, 0 self_harm misses, worst-seed E+M ≤ 36. **Worst seed = 34 → PASS.**
- Selection (declared): highest val composed macro-F1 in 0.5 mode → **f05-s13 ckpt-epoch-3.0-step-690** (model.safetensors 7b9bec18…).
- Report only (secondary, val-fitted T and cutoffs; decides nothing per ADR 2026-10-15): E+M 47 / 46 / 41. Val-fitted T (stance / yes-no): s12 3.546/4.48, s13 3.396/4.264, s14 3.416/4.015.
- Gate toolchain check after the box reset: the same `analyze.sh` reproduces distill s9/s10 primary (37 / 28) before scoring f05.

## Ship gates (s13, Nepal VPS himalogic, flock /tmp/airp-vps-bench.lock, nice 10, MemoryMax=9G)

- **ONNX export** (on the VPS from the sha-verified copy; export_onnx_shared.py 5aa76605…, opset 17): `411e805e96764fd6758dd98cb4eb89922f4c16c65a9d6e472abfe1051fe3773a`. Max |Δ logit| vs torch is 2.29e-5.
- **Pins** `f05/ship/laya-shared-f05-s13-fp32.pins.json`, sha `e7cc6521c1ad54a094e858c82ffdb18e289b1b10c968e339013e4bc6918bafc5`. Settings: T=1, 0.5 on all 16 yes/no heads, stance argmax, corrected composition `airp-v0.5.0-cse-corrected.json` 4e840f3b…. Bundle files other than the ONNX (shared_config, tokenizer) have the same sha256 as A570.
- **Identity on the full 471-item set: PASS.** Python (onnxruntime 1.22.1) vs Node `evaluate()` (onnxruntime-node 1.30.0):
  - primitives 471/471, composed 471/471, decode-on-Python-logits 471/471, input feeds 471/471
  - max |Δ logit| 2.09e-4; smallest Python logit margin 0.0079 (`ho2a-simulation_obscured-pos-01`, explicit_register, P≈0.502), which is about 38× the observed drift
  - Node primitives = the gate's torch fp32 per-item record 471/471, so Node reproduces v2 18/16 and CSE clean item for item.
- **Latency: MET.** Node v22.23.2, 8 intra-op threads, n=20 per bucket, ms:
  - 500-token bucket: **median 643**, p95 727, max 741 (gate < 1000)
  - 50 / 200 / 1000-token buckets (median): 102 / 251 / 1439
  - short suite (471 items): median 46.7, p95 60.5
  - RSS 2.9 GB peak
- Note: `vps_shared_node.sh` hardcodes the old composition. The ship run used a copy, `f05/ship/vps_shared_node_f05.sh`, that adds COMP/COMPSHA/O/R overrides with a sha check. The corrected composition file was added to the VPS shared-node repo's compositions dir. The export needed `onnx`: onnx 1.19.1 was installed into `f05/ship/pylib` only, and the bench venv was not modified.

## Archive and pods

- **GPU pod z6hjcr1zogwwzj** (SECURE 4090, $0.89/h, EU-RO-1):
  - 03:34:47Z created; PIPELINE_DONE 04:13:17Z
  - volume `sha256sum -c` OK for every run (52 lines each); full volume manifest `MANIFEST-volume.sha256` (190 files, 15 GB) `96000011a2da75dd0f5c2b5e917138faf714b65cdd16ebb82b53b2014f69c653`
  - **terminated 04:18:47Z** (44.0 min, ≈ $0.65)
- **CPU pod o2npuhw80vu2dl** (cpu3c, 2 vCPU, $0.06/h) on volume rmn62wuuzx, with no GPU pod running:
  - 04:18:58Z created; tar stream volume→box→VPS 04:19:50–05:00:07Z
  - **VPS `sha256sum -c MANIFEST-volume.sha256`: 190/190 OK** (05:00:50Z), at `/root/primitives-evaluator/decide-2026-10-13/shared-adopt/f05/volume/f05/`
  - **terminated 05:01:17Z** (42.3 min, ≈ $0.04)
- Ship artefacts are on the VPS at `…/shared-adopt/f05/ship/`, in `MANIFEST-ship.sha256` (18 files, `sha256sum -c` OK) `fd19a6693ddd4d5b64e84abd2358cbe528dcf0c75141c12cfd3d290458742c67`. VPS free space afterwards: 20 G.
- **Network volume rmn62wuuzx (40 GB, EU-RO-1) kept, not deleted:** ongoing ≈ $0.07/GB/month → **≈ $2.80/month (≈ $0.09/day)** until Justin deletes it. The VPS copy is complete and verified, so deleting it loses nothing.
- No pods are running.

## Spend

- RunPod balance $14.50 before → $13.81 after (−$0.69 = GPU $0.65 + CPU $0.04 + volume so far).
- Cumulative ≈ $21.85 + $0.69 = **≈ $22.54 of $30** (≈ $7.46 left; the volume adds ≈ $0.09/day).

## Waiting on Justin

Adopt or publish f05-s13 (pins e7cc6521…, ONNX 411e805e…) into the shared-node PR, and decide whether to delete volume rmn62wuuzx. No merge or publish was done.
