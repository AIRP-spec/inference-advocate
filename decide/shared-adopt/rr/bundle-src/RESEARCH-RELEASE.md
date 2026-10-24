# Research release record: avg-f05-s14-ep2.0-2.5-3.0

NON-DEFAULT RESEARCH RELEASE. Did NOT pass AIRP certification. Certification stopped under ADR 2026-10-19 after attempt 6 (FRESH-10) failed its safety gate.

Repository: AIRP-spec/inference-advocate, branch decide/shared-adopt (draft PR #31).

| item | value |
|---|---|
| decision | Justin Flores, t161u, 2026-10-19 (NPT) |
| stopping rule | ADR docs/decisions/2026-10-19-gate-revision-accuracy-on-candidate-only.md (20ef5c3) |
| clarification | docs/decisions/2026-10-19-clarification-single-checkpoint-self-harm-misses.md (95d53e5) |
| selection record | decide/shared-adopt/SELECTION-RESEARCH-RELEASE.md (4237006): avg-f05-s14 val F1 0.8021 > avg-f05-s12 0.7747 |
| training run | FRESH-05 distillation, seed 14; declaration cf6a9aa (DECLARATION-FRESH-05.md 63373a69…), report fcf74b5 |
| averaging | average_n.py 88f9cbce…, uniform 1/3 of ep2.0 (8f1a37ef…), ep2.5 (afcb23f7…), ep3.0 (d9f6c923…) |
| torch/model.safetensors | 0b09a470a1e4972a1bcdf374c58affff26ee98010a76e7539397f6904fd9fa4a |
| laya-shared.onnx | 90b24a0b1ce9b3b3ab0b47a9120c383aafa134c24ceb4b1bd79a451ac5cf8798 (opset 17, max abs logit diff vs torch 6.24e-5) |
| pins | 8ef0b322925bc45d4a17cfd17a9cbed17b75abc41ebc6e926e25904c635ca5b1 (T=1, 0.5 x 16, stance argmax, composition 2a) |
| composition 2a | 59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e |
| held-out suite | v2 82f8e720fbb1d146a93a09da86484dada04561cffd85293be435c0ed0000ad77 (471) |
| v2 result | extras 14, misses 13, clean fires 11, E+M 27; CSE 0/0 (n 29); self_harm 0 prim / 0 class |
| v1-207 | 3 / 5 / 2 |
| seed-14 converged checkpoints | ep2.0 / 2.5 / 3.0: CSE clean, self_harm 0/0 each |
| identity | Python ORT vs Node evaluate(), 471/471 prims, composed, decode, feeds; max abs logit diff 2.04e-4 |
| Node vs torch-CPU gate record | 471/471 identical primitives |
| Node latency, 500-token bucket | median 677 ms, p95 808 ms (< 1000 ms), Nepal VPS Xeon Gold 5418Y 8 vCPU |
| observed spread, averaged models | n 9, mean v2 E+M 31.78, SD 3.77, range 27-37 |

temperature.json is omitted on purpose: no temperature is used by the pins (T=1), and no val-fitted temperature was computed for this average.
