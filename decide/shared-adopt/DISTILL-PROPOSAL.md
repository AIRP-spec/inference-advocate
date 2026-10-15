# Proposal: distil the ensemble into one model (**do not run** until Justin approves)

Triggered by ens5 and ens3f passing (REPORT-ENS, EXPLORATORY). Neither ensemble ships: 2 models take 1.29 s and 3 models 1.96 s at the 500-token bucket. The aim is one shared-encoder model (684 ms) that carries the ensemble's behaviour.

## Teacher and targets
- **Teacher: ens5** (round1, round2, fresh s3/s4/s5 at epoch 3.0). It has the larger agreement set and the better E+M (29).
- Run teacher inference on **train v5 (7332)**: per item, the mean P(yes) for every yes/no head and the mean stance distribution, T=1. These are the soft targets. Pinned by sha before training.
- The target mix is a declared choice. Proposed: **target = 0.5 x gold + 0.5 x teacher**, so the gold labels stay anchored. Because the teacher ran on its own training data, its soft targets are over-confident on train items. The proposal states this.
- Val and held-out are **never** used for teacher targets.

## Students
- Round recipe unchanged (labels v5, LR 2e-5/1e-4, no warmup, 3 epochs, sigma 0.25 to 0.1). The only change is the CE/RL target (a soft target on the existing `target` tensor; the RL reward uses the same soft target).
- **3 fresh seeds (9/10/11)**, final checkpoint epoch 3.0 fixed in advance.

## Declared rule (written and committed before any pod)
Every seed at 3.0: CSE clean, self_harm misses 0; worst-seed v2 E+M <= 36. Pass → Node identity 471/471 + VPS latency on the best-val seed. Fail → per-seed results, STOP. Also reported: per-seed agreement with ens5 on held-out primitives.

## Cost
- Teacher inference: 5 checkpoints over 7332+819 items on one 4090. About 6 min, or 0 if it runs on the Arm B pod's tail. CPU on the VPS is possible but slow (about 1 h).
- 3 student runs: about 11.5 min each, about 35 min.
- Archive: streamed per checkpoint while training runs. Expect about 20–40 min of tail for the VPS sha -c (box→VPS is about 4–5 MB/s).
- **Total about 1.2–1.5 pod-hours, about $1.10–1.35** (SECURE 4090, $0.89/h).
