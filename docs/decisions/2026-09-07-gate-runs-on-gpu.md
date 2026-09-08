# Decision record: the gate runs on GPU, and the verdicts do not change
Date: Monday, 7 September 2026
Related: issue #1, LocalEvaluator GPU selection.

## What was tested

Every gate in this project has run on a CPU. That was never a decision. It fell out of a pod failing mid-gate months ago, and it became habit, reinforced when the AVX512 finding made a 16-core Intel droplet faster than a 128-core AMD pod.

`gate.mjs` has always had a `--gpu` flag. It was tried once, on a Blackwell card, and failed. That failure was read as "the GPU path does not work" when the actual cause was that node-llama-cpp's prebuilt binaries stop at sm_86 and Blackwell is sm_120.

This experiment put the same model on a supported GPU and asked two questions: does it work, and do the verdicts change.

## Result

Model: `airp-evaluator-0.6B-v040-step744-Q8_0.gguf`, pin `local-llm@3e5d2fd83b37+v3`, taxonomy v0.4.0.

| | droplet CPU | GPU run 1 | GPU run 2 |
|---|---|---|---|
| extra class fires | 1 | 1 | 1 |
| the row | `v0-positive-relational_hooks` | same | same |
| the extra label | `persona_claims` | same | same |
| recall misses | 0 | 0 | 0 |
| clean fires | 0 | 0 | 0 |
| per-class pass | 10 of 11 | 10 of 11 | 10 of 11 |
| mean ms per item | 347 | 77 | 74 |

**Complete agreement.** Three runs, two backends, the same failing row with the same spurious label.

The GPU is 4.5 times faster than the best CPU found, and roughly 400 times faster than the CPU on the pod that ran the GPU test, which lacks AVX512.

## What this settles

**The GPU path works on a supported card.** The A100 reports compute capability 8.0, and llama.cpp's system-info line shows `CUDA : ARCHS = 500,610,700,750,800,860`. 800 is in the list.

**Verdicts are backend-independent.** CUDA is a different kernel path than CPU and quantized inference can differ in floating point. It does not here. A pin means the same thing on either backend.

**The GPU path is deterministic.** Two consecutive runs produced identical results, down to the row id. That was the question that mattered most: a certification gate that gives different answers on the same model certifies nothing, and a speed gain would not have been worth accepting one.

## The arch list is the constraint, not the vendor

`CUDA : ARCHS = 500,610,700,750,800,860`

| card | compute capability | supported |
|---|---|---|
| A100 | 8.0 | yes |
| A6000, 3090, 4090 | 8.6 | yes |
| **H100** | **9.0** | **no** |
| **Blackwell, RTX PRO series** | **12.0** | **no** |

An H100 will fail exactly as Blackwell did, and H100s are often what is available when A100s are not. Take an A100 for any run that gates.

This list comes from node-llama-cpp's prebuilt binaries and will move when that dependency is updated. Read the system-info line rather than assuming.

## Consequence for the workflow

Gating moves onto the training pod. Three machines become one.

The old sequence was: train on a RunPod GPU, stop the run before the gate, archive the adapters, transfer them, deploy an Intel droplet, rebuild the environment, gate, transfer results back.

The new sequence is: train on an A100 and let `run-sweep.mjs` finish.

That removes the adapter transfer, the second machine, and the stage that has repeatedly broken mid-run. It also removes a real class of error: two sweeps were lost or delayed by problems in the transfer-and-regate path rather than by anything to do with the model.

The adapters should still be archived off the pod before the gate stage begins. They remain the only output that cannot be rebuilt, and pod volumes have thrown I/O errors twice.

## Consequence for recorded results

Gate reports record `hardware` and `systemInfo`. Every result to date says CPU with AVX512 at roughly 320 to 350 ms per item. Future reports will say CUDA at roughly 75 ms.

The verdicts are comparable across that boundary. **The timings are not.** Anything that documents a published pin should say which hardware class its latency figures describe.

## What this does and does not answer for issue #1

Settled: CPU and GPU produce the same verdicts, so the choice of backend is a performance decision rather than a correctness one.

Still open: `gpu` is a static boolean in `LocalEvaluatorConfig`, there is no auto-detection, and there is no try-GPU-then-fall-back-to-CPU path. A device build that selects a backend outside the arch list will fail rather than degrade, which is exactly what happened on Blackwell. The arch-list table above is the evidence that this failure mode is real and specific rather than hypothetical.
