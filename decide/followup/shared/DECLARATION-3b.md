# Task 3b: shared-encoding experiment. Declaration, written before any training

**Date:** 2026-10-11 (NPT). **Brief:** Justin's follow-up of 2026-10-06, Task 3b. This file is declared, hashed, and archived to the Nepal VPS **before any pod is created and before any gate or held-out readout** for this experiment. The SHA-256 of this file is recorded in `PROGRESS-3b.md` and on the VPS (`DECLARATION-3b.md.sha256`).

The question: if the response is encoded **once** and 17 small heads read the shared representation, how much of Laya's accuracy survives, and how much CPU time does it save? This is a **new model**, not a tuning step. Everything it is compared against is the incumbent: Laya `ckpt-epoch-1.5-step-5766` (fp32, S2c build).

## 1. Inputs (locked, identical to the deciding run)

| Artifact | Value |
|---|---|
| Labels v4 | `primitives-labels-8056-v4.jsonl` sha256 `6399fd4a9b0e33bfbf21d097fc689d50ee9d6dc219db3b16d7dcdef65eb28d36` |
| Split (group-held-out, reused by row id) | train 7236 / val 819. Definition sha `a1b26aa56cfdc16a27f4869a174666fb6a18f7aa1b55f18ab2e4cd9959fceb45` |
| `train.jsonl` / `val.jsonl` | `4cdf51b69997f21a5f5aa36c69be9a9b62671962ec32442b5525164dc00497e5` / `467899841b930e798277eca70bb46fb344e7f2223ee661f5372352593f5e9b2f` |
| Questions (file / canonical) | `f519fa8e4763cc95acef3d134f984941c263043bad4abfd2a827c69e560650ee` / `a2e7b5b36615e3b720258c1363819e7c976fac64d998e7d19a0899a5d41ef7a7` |
| Composition | `airp-v0.5.0.json` sha256 `4def0b8fd339713bd261106cb10235949f4bd1bc4e3631a88dd7cc511b0087e0`, shared `compose` |
| Settled proxies | `gold-proxies.v0.5.0.settled.json` sha256 `b086cdac11f8af39b2d3984232ee0372d9ffe909acbd4b8d7fe6d4f653d08455` |
| Held-out suite v2 (v1-207 is its historical subset) | `held-out-suite.v2.json` sha256 `6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4` |
| Pinned real-length set (Task 3a) | `lengths/pinned-lengths-v1.jsonl` sha256 `6ad799d2d84f601833dc15c1b4d22aa48d9c38bf6edbfc494de4a2dc0d99cc4b` (buckets 50 / 200 / 500 / 1000 tokens, 20 items each) |
| Laya base weights | `convaiinnovations/laya` @ `55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851`, `model.safetensors` sha256 `891102d372688fc2a094dac56a384bc537b87c63f21f9f3dac0be2b7cbc8d86c` |

The suite, the gate thresholds and the composition are not edited. Label problems, if any are found, are fixed in the generating code, never in derived files.

## 2. The model (what changes, and nothing else on purpose)

| | Laya 5766 (incumbent) | Shared-encoding model (this experiment) |
|---|---|---|
| Encoder | ModernBERT-large from the Laya base weights | **same weights as the starting point** (encoder tensors of the Laya base snapshot above) |
| Input | 17 sequences per response: `[CLS] <type> question: instructions [SEP] [MASK] opt… [SEP] response [SEP]` | **one sequence per response:** `[CLS] response [SEP]`; response tokenized exactly as Laya does (mask token replaced by a space), truncated at 1024 tokens |
| Heads | Laya head: 2 transformer layers over the sequence, scorer at the option markers | **17 question queries** (one learned vector each) decoded against the shared encoder states by a 2-layer cross-attention head (pre-norm, 16 heads, FFN 4d, dropout 0.1), then a shared scorer trunk and **one output layer per question**: 5-way for stance, 2-way (false, true) for each of the 16 yes/no primitives |
| Head initialisation | pretrained Laya head | **new, randomly initialised** (seed 42) |
| Question wording | in the input | **not in the input.** It is fixed per primitive and pinned by SHA (questions canonical sha above); a question is identified by its head, not by its text |
| Loss | RLCD (proper-scoring-rule reward with policy gradient, plus soft CE) | **unchanged**, applied per (response, question) logit vector |
| Decode | T=1, P(true) ≥ 0.5, stance argmax | **unchanged**; logits are 2-way / 5-way in the same option order |

New code only (new files, minimal diff): model, preprocessing, training, raw-logit inference, ONNX export. The RLCD loss math, the optimizer and schedule code are copied from `train_airp.py`.

## 3. Training recipe, and the differences the head change forces

Same as the deciding run unless listed: 3 epochs, encoder LR 2e-5, head LR 1e-4, σ 0.25 → 0.1, group size 4, bf16 autocast, seed 42, `transformers==4.48.3`, `laya==0.3.21`, `reference_compile=False`, NaN-skip hardening, half-epoch checkpoints (6 per run: epochs 0.5, 1.0, 1.5, 2.0, 2.5, 3.0), max_len 1024.

**Forced difference: what a "sequence" is.** The deciding run had 123,012 training sequences (7236 responses × 17 questions) and 32 sequences per optimizer step (micro-batch 8 × accumulation 4). Here a sequence is a response (7236) carrying 17 labels. Keeping "8 × 4" literally gives 32 responses (544 labels) per step and only about 680 steps in total, 17 times fewer optimizer steps than the incumbent got. Keeping the step count instead means about 2 responses per step. Neither is obviously "the same setting", and choosing one after seeing results would be a fork. So **two runs are trained, both declared here, with everything else identical**:

| Run | Micro-batch × accumulation | Responses / step | Labels / step | Optimizer steps (3 epochs) | Reading |
|---|---|---|---|---|---|
| **A** | 8 × 4 | 32 | 544 | ≈ 680 | same batch numbers as the deciding run |
| **B** | 2 × 1 | 2 | 34 | ≈ 10,860 | same labels per step (≈ 32) and same number of optimizer steps as the deciding run |

All 12 checkpoints (6 per run) are scored on validation. The selected checkpoint is the single best of the 12 under the rule in §4. Only one checkpoint is carried forward. No other hyperparameter is varied. If a run diverges (non-finite parameters), it is reported and its checkpoints are excluded; the other run stands.

## 4. Checkpoint selection (validation only)

**Metric:** composed-class macro-F1 on the 819 validation rows, computed exactly as in `decide/step4/DECLARATION.md` §2: primary thresholds (0.5 for every yes/no primitive, argmax for stance), shared `compose` with `airp-v0.5.0.json`, eleven class types, F1 skipped only for a class with zero gold positives and zero predictions on val. Select the highest. Tie-break: higher validation stance accuracy; then the later checkpoint (higher step; across runs, run B before run A at equal step is not defined, so a remaining tie goes to the checkpoint with the higher epoch, then run A).

**Hard rule:** held-out v2, v1-207 and the pinned length set are never used to select a checkpoint, a run or a threshold mode.

## 5. Temperature and thresholds

- **Primary (selection and every rule clause):** T = 1, 0.5 for every yes/no primitive, argmax for stance. This is the incumbent's primary mode, so the comparison is like for like.
- **Secondary (reported, not used to decide anything):** temperature per question type and per-primitive thresholds **fitted on validation only** (primitives with zero val positives keep 0.5), applied to held-out for both the shared model and, from the archived 5766 raw logits, the incumbent.
- Nothing is fitted on held-out data.

## 6. Gating

- Gate the selected checkpoint on held-out v2 (extras / misses / clean fires, "E/M/C") and v1-207, with the same gate code and thresholds as the deciding run (`gate_all_ckpts.mjs`, `gate-laya-task1.mjs`, settled proxies above).
- **CSE named gate** on every checkpoint of the selected run, primary thresholds. **Converged checkpoints** = the last three half-epoch checkpoints of the selected run with epoch ≥ 2.0 (epochs 2.0, 2.5, 3.0). The other run's CSE is reported but does not decide the rule.
- **Item-level table against 5766** on v2 (n = 471): both right / only shared right / only 5766 right / both wrong, where "right" means the composed class set equals the gold `expect` set (order-insensitive), primary thresholds, as in the deciding run. Also the number of items on which the composed verdicts differ.
- The gate runs on fp32 torch raw logits (no autocast). The fp32 ONNX build is then checked against them on all 471 held-out items (composed disagreements and primitive flips are reported; if any, the ONNX outputs are gated too and that result is the one reported for the shipped build).

## 7. Latency

- **CPU, Nepal VPS** (Xeon Gold 5418Y, 8 vCPU): fp32 ONNX, one `session.run` over **one** sequence (batch 1, no padding, so there is nothing to pack), ORT intra-op 8, inter-op 1, sequential, `allow_spinning=0`, `ORT_ENABLE_ALL`. Per item = tokenize + run + decode wall clock; p95 nearest rank; 20 untimed suite warm-up items, 2 untimed warm-up items per bucket. Measured on the **pinned length set** buckets 50 / 200 / 500 / 1000 (20 items each, the 3a harness) and on the original short suite (all 471 items). Every timed bench runs under `flock /tmp/airp-vps-bench.lock`, and none starts until the 5766 numbers from Task 3a exist (`REALLEN.md`).
- **GPU:** the same ONNX through ORT's CUDA provider on a RunPod GPU in the same pod as training if the ONNX is ready, else a separate short burst, on the same pinned buckets and short suite, same harness as 3a's GPU runs.
- Truncation note: the shared model sees the response only, so at the 1000-token bucket it truncates less than the incumbent, whose rows carry question text. This is part of the comparison and is reported, not corrected.

## 8. Decision rule (verbatim from the brief)

> Recommend the shared-encoding model over Laya 5766 if all three hold: (1) its v2 extras plus misses are no more than 5 worse than 5766's (5766 = 16 extras + 20 misses = 36); (2) it passes CSE on all converged checkpoints; (3) its CPU median at the 500-token bucket is lower than 5766's at the same bucket. If neither or both fail a bar, report that the rule has no valid output and lay out the measured results. Do not fall back silently to the incumbent.

**Operational reading, locked here:**
- Clause 1: let S = E + M of the selected shared checkpoint on v2 (primary thresholds) and L = 36. Need S − L ≤ 5.
- Clause 2: every converged checkpoint of the selected run passes the CSE named gate (n = 29, missed 0, extra 0 is the pass condition used in the deciding run).
- Clause 3: the shared model's CPU **median** at the 500-token bucket (the pinned set, this experiment's own measurement, §7) is strictly lower than 5766's median at the same bucket, taken from `REALLEN.md` (its stated headline figure; if it gives repeats without a headline, the median of the repeat medians).
- **A bar is a bar for both options.** Each bar is evaluated for the shared model **and** for 5766. 5766's own CSE result is its deciding-run result on its converged checkpoints (step 7688, 9610 and 10099; the last one is epoch 2.6 because that run stopped there). All three passed CSE. For the two relative bars, each model is compared with the other (5766 against the shared model's numbers) so that the bar is applied symmetrically. A bar that 5766 fails applies to it exactly as it does to the shared model, and it is never waived for the incumbent.
- Outcomes:
  1. **Shared passes all three bars** → recommend the shared model over 5766.
  2. **Shared fails a bar that 5766 passes** → the shared model is not recommended. This is stated as the outcome, with the measured numbers. It is not a silent fallback: the incumbent is named only because it meets that bar.
  3. **Both options fail the same bar, or a bar cannot be evaluated for either** → the rule has **no valid output**. Report the measured results and stop there.
- Noise contingency for clause 3 only: if the two CPU medians at the 500 bucket differ by less than 5 %, an interleaved A/B (both ONNX models in one session on the VPS, under the flock, alternating items) is run before the rule is applied; if its sign disagrees with the REALLEN.md comparison, clause 3 is reported as **not decidable** and the rule has no valid output.

## 9. Archive rule

Before any pod is terminated, archive to `/root/primitives-evaluator/decide-2026-10-06/followup/shared/` on the Nepal VPS, with a `MANIFEST.sha256` verified remotely: SFT/preprocessing metadata, labels, split definition, question pins, thresholds (default and fitted), temperature, the pinned length-bucket set, all scripts, and **every checkpoint**. If the archive cannot complete, the pod stays up and `BLOCKED.md` is written. A pod is terminated in the same turn as the verified archive.

## 10. Budget

The whole follow-up stops at $30 (about $0.30 spent before this experiment). Spend is logged in `PROGRESS-3b.md`.
