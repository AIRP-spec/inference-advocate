# Step 3: Laya on CPU, measured properly (deciding run 2026-10-05)

Times are NPT (UTC+5:45) unless marked UTC. All VPS numbers come from the Nepal VPS: Intel Xeon Gold 5418Y, 8 vCPU (2 sockets × 4 cores, 1 thread per core, VMware guest, AVX-512 VNNI, no AMX exposed), 15.9 GB RAM. The VPS also runs production, so every run used `nice -n 10`, ran one bench at a time, and waited for load average < 1.5 before starting.

## Headline
- **The old 2236 ms was fp32 PyTorch eager on CPU with 8 threads, and it used one forward call per response.** That call is a batch of 17 question-conditioned sequences, one per primitive. It did not run one call per primitive, so it does test the "one pass" claim, as far as Laya's architecture allows (see §1.2).
- **The VPS one pass per response (one `session.run` with 17 rows), all 471 items:**
  - fp32 ONNX: **2379 ms median, 2727 ms p95**.
  - int8 (dynamic) ONNX: **1209 ms median, 1463 ms p95** (1.97× faster).
- **Items over 1024 tokens: 0 of 471 (0%).** The longest state is 34 tokens and the longest padded sequence is 124 tokens. Truncation therefore has **no latency effect on the suite**. The suite's responses are very short, though. The synthetic length probe (§3.2) shows fp32 one-pass latency rising to 5.5 s at 128 state tokens, 8.8 s at 256, 17.7 s at 512 and 35 s at the 1024 cap. Without the cap, a 2048-token response takes 100 s against 35 s capped.
- **Decision rule 3 (CPU median < 1 s per response): NOT met by any variant that answers like the model.** fp32 runs at 2.38 s. int8 is 1.21 s with one pass, or 1.00 s with 17 single-row runs, which is not one pass. int8 also changes answers: 87–101 decision flips, and recall misses on v2 rise from 15 to 24–29.
- **The int8 gate:** CSE PASS, but v2 extras/misses/clean go from 35/15/31 (fp32) to 30/29/27 (batched) and 27/24/25 (per-question). A fast model that answers differently has not been measured as the same model.

## 1. Audit of the earlier CPU measurement (2236 ms median / 2649 ms p95)
### 1.1 Precision, runtime, threads
| Question | Answer | Evidence |
|---|---|---|
| Runtime | PyTorch eager (no ONNX, no torch.compile), torch 2.14.0+cpu (system), transformers 4.57.6 and laya 0.3.21 from `./pylib` | VPS `task1-2026-10-05/bench/run-cpu-bench-bounded.sh` line 3 `PYTHONPATH=./pylib OMP_NUM_THREADS=8`; laya `agent.py` lines 433-434 set `reference_compile = compile` (False by default) |
| Threads | 8 (`OMP_NUM_THREADS=8` and `torch.set_num_threads(8)`) | run script lines 3 and 5 (`--device cpu --threads 8 --stride 4 --max-sec 480`); `task1/scripts/bench_latency_bounded.py` lines 11-12 |
| Precision | **fp32**. Weights are stored as F16 safetensors (206 tensors), even though the archive name says "bf16". `Agent` loads them into fp32 parameters and leaves AMP off on CPU. CPU bf16 autocast turns on only if `LAYA_CPU_AMP=bf16` is set, and no `LAYA_*` variable is set on the VPS. | `agent.py` line 499 `self.dtype = torch.float32`; line 518 `LAYA_CPU_AMP`; my export-meta.json records param_dtypes float32, agent dtype float32, amp false |
| Checkpoint and sample | orig `ckpt-epoch-2.6-step-10160`, every 4th held-out item (n=118), 5 warm-up items, 480 s cap. Load average before the run was 5.07, still decaying from a killed earlier run. | `cpu-bench-orig.log` line 16; task1 PROGRESS 11:23 NPT |
| Code identity | VPS pylib `agent.py` sha256 cd941661… and `common.py` 9358176… are byte-identical to the laya 0.3.21 used here. `bench_latency_bounded.py` sha256 1ff3e672…. | sha256sum on both machines |

### 1.2 One pass per response, or one per primitive?
**One forward call per response.** The trace:
- `bench_latency_bounded.py` line 19 calls `agent.predict(content, qs, max_len=1024, head_max_len=256)` once per item, with all 17 questions.
- `agent.py` line 1377 aliases `predict = system_one`. Line 1318 is `system_one → predict_batch([state], questions, …)`.
- Line 1031 runs `_encode_state` on the state. Lines 775-777 build one sequence per question (`for qid in ids: … build_sequence(self.tok, state, q, …)`).
- Lines 1040-1041 call `collate_items` and then a **single** `self._forward(b)`.

**Architecture caveat, and the reason "one shared encoding" is not available.** Laya puts the question *inside* the bidirectional encoder input. Each sequence is `[CLS] <type> instructions [SEP] [MASK] opt0 [MASK] opt1 … [SEP] state [SEP]` (`common.py` line 146), and the encoder runs on every row (`common.py` line 314). The state's hidden states therefore depend on the question. A single encoding of the response that answers all 17 primitives would need retraining. The legitimate "one pass per response" is what the old bench did and what `batched` mode below does: one call with 17 rows. `collate_items` pads every row to the longest (`common.py` line 531). The median padded batch is 17 × 102 = 1734 tokens against 903 real tokens, so about 48% of the compute is padding.

**Verdict:** the old measurement tested the one-pass claim correctly and used fp32. Reproduced on the same VPS with fp32 ONNX (9610, same architecture), it gives 2376 ms median on the same every-4th subset and 2379 ms on all 471. **The 2.24 s figure was not inflated by per-primitive passes or bf16 emulation.** fp32 ONNX Runtime is no faster than torch eager on this CPU.

## 2. Protocol (this run)
- **Checkpoint:** `ckpt-epoch-2.5-step-9610`, the task1 selected retrain checkpoint. `model.safetensors` sha256 3a88d65f…, and every file was verified against its archive member. 10160 has the same architecture. Its ORT fp32 export matches torch (max|dp| 3e-5, 0 flips), and both checkpoints were within ±0.5 ms on the 4090.
- **Export:** torch 2.6.0+cpu, transformers 4.48.3, laya 0.3.21, opset 17, dynamic batch and sequence axes. The MHA fast path was disabled for export only (`aten::_transformer_encoder_layer_fwd` has no ONNX symbolic). int8 is `onnxruntime.quantization.quantize_dynamic` (QInt8 weights, per-tensor, 122 of 190 MatMuls; activations quantized dynamically at run time).
- **Runtime:** onnxruntime 1.22.1 CPUExecutionProvider, ORT_ENABLE_ALL, intra_op 8, inter_op 1, sequential execution.
- **Input encoding** reproduces `Agent._encode_state` (max_len 1024, head_max_len 256), with outputs at raw logits and T=1 (as in the task1 gate).
- **Timing:** session loaded first (fp32 load is 6.6 s; not counted). 20 warm-up items, untimed. Then all 471 held-out v2 items (suite sha 6c7b30e1…), one at a time in suite order. Per-item time is wall clock for encode + session.run + decode. p95 is nearest-rank.
- **Modes:**
  - `batched` = one run per response with 17 padded rows. **This is the one-pass measurement.**
  - `perq` = 17 single-row runs with no padding, shown for reference. It is not one pass.

## 3. Results
### 3.1 Latency per response (all 17 primitives), 471 items
| Variant | Runs per response | Median ms | p95 ms | Mean ms | Same every-4th subset as old bench (n=118) median / p95 |
|---|---|---|---|---|---|
| **VPS fp32 ONNX, one pass** | 1 (17 padded rows) | **2379** | **2727** | 2395 | 2376 / 2782 |
| **VPS int8 ONNX, one pass** | 1 (17 padded rows) | **1209** | **1463** | 1212 | 1235 / 1497 |
| VPS fp32 ONNX, per question (ref) | 17 × 1 row | 1698 | 2020 | 1708 | 1725 / 2054 |
| VPS int8 ONNX, per question (ref) | 17 × 1 row | 1003 | 1269 | 1009 | 1018 / 1293 |
| Old measurement: torch eager fp32, 10160 | 1 (17 rows) | 2236 | 2649 | | (n=118 every 4th) |
| Qwen per-primitive, Task 2 (node-llama-cpp greedy LocalEvaluator, CK-8560 Q8_0, 8 cores, 100 held-out items) | 17 prompts | 3942 | 4321 | | |
| RTX 4090, torch, 9610 (task1) | 1 | 26.8 | 28.5 | | |

- Per-question single-row run in `perq` mode: fp32 79 ms median (224 ms p95), int8 44 ms median (159 ms p95).
- Encode time is about 4 ms median, and session.run is more than 99% of the time.

### 3.2 Token lengths and truncation
- **Suite:** state tokens median 12, max 34. **Items over 1024 tokens: 0 of 471 (0.0%).** No row reached max_len. Padded sequence length median 102, max 124.
- Truncation (max_len 1024, head_max_len 256) never triggers on this suite, so its latency effect here is **zero**. Latency on the suite is set by the 17 × ~100-token batch, and mostly by the question and instruction text, not the response.
- The synthetic length probe (concatenated suite contents truncated to target state lengths) times capped (1024) vs uncapped runs. Results are below, or marked pending.

**Length probe (VPS, fp32 and int8 ONNX, 9610).** Synthetic states are made of concatenated suite text cut to T state tokens. Each cell is the median of 3 timed reps after 1 warm-up, per response with all 17 primitives. fp32 ran 16:32-16:55 NPT (load 1.08 before start) and int8 ran 16:56-17:11 NPT (load 1.20 before start). Raw data: `vps/results/probe-ckpt-epoch-2.5-step-9610-{fp32,int8-dynamic}-probe.json`.

| State tokens T | Row length (min-max) | fp32 one pass, cap 1024 (default) | fp32 per question, cap 1024 | fp32 per question, no truncation | int8 one pass, cap 1024 | int8 per question, no truncation |
|---|---|---|---|---|---|---|
| ~12 (suite median) | ~55-124 | 2.38 s (suite median) | 1.70 s | same | 1.21 s | 1.00 s |
| 128 | 162-218 | 5.5 s | 3.5 s | same | 2.2 s | 1.9 s |
| 256 | 290-346 | 8.8 s | 7.7 s | same | 4.9 s | 4.1 s |
| 512 | 546-602 | 17.7 s | 16.1 s | same | 11.0 s | 9.6 s |
| 1024 | 1024 (truncated) | 35.2 s | 35.7 s | 36.6 s (rows 1058-1114) | 23.1 s | 24.6 s |
| 2048 | 1024 (truncated) | 35.4 s | 34.6 s | **100.2 s** (rows 2082-2138) | 23.0 s | **74.3 s** |

int8 is only 1.5× faster than fp32 at 1024 tokens (2.5× at 128), because dynamic quantization leaves the attention score and context matmuls in fp32, and those matmuls dominate at long lengths.

- **What this means.** Latency grows about linearly with response length: roughly 33-35 ms per state token for 17 primitives in fp32. The 1024-token cap bounds the worst case at about 35 s in fp32. Without it, a 2048-token response takes about 100 s, 2.9× the capped time, because attention cost grows quadratically. Truncation keeps the first (1024 − question prefix − 1) state tokens and drops the rest (`common.py` `build_sequence`, `truncate_left=False` by default; `head_max_len` caps only the question and options header). Content past about 900-1000 tokens is therefore never seen.
- **Caveat for rule 3.** The held-out suite's responses are very short (median 12 state tokens, max 34), so the 2.38 s / 1.21 s suite medians are a **lower bound** for real chat responses. A 256-token response already takes about 8.8 s in fp32 one-pass. No length has a median under 1 s in fp32.

## 4. Answer parity and the int8 gate (task1 gate tool unchanged, default thresholds: 0.5 yes/no, argmax stance)
Gate format is extras / recall misses / clean fires.

| 9610 variant | max\|Δp\| vs torch fp32 | Decision flips (of 471×17) | v2 | v1-207 | CSE named gate |
|---|---|---|---|---|---|
| torch fp32 CPU (reference) | 0 | 0 | 35/15/31 | 15/7/13 | PASS |
| task1 pod bf16 GPU (reproduced) | 0.82 (max\|Δlogit\| 15.6) | 3 | 36/15/32 | 16/7/14 | PASS |
| VPS ORT fp32, one pass | 5.0e-5 (max\|Δlogit\| 0.005) | **0** | 35/15/31 | 15/7/13 | PASS |
| VPS ORT fp32, per question | 5.0e-5 (0.005) | 0 | 35/15/31 | 15/7/13 | PASS |
| **VPS ORT int8, one pass** | 1.00 (max\|Δlogit\| 18.8) | **101 over 90 items** | **30/29/27** | 13/10/11 | PASS |
| VPS ORT int8, per question | 1.00 (18.8) | 87 over 76 items | 27/24/25 | 13/11/12 | PASS |

- The task1 gate's overall v2/v1-207 `pass` field is false for every row, including the torch fp32 reference. Read the counts, not that flag. The bf16 row reproduces task1's reported 9610 counts exactly (36/15/32, 16/7/14).
- **int8 one-pass flips by primitive:** is_mention_not_use 28, stance 19, explicit_register 18, addresses_own_nature 9, financial_crime 8, targets_protected 5, exceeds_common_knowledge 4, all others ≤ 2.
- Extras plus misses on v2 are 59 for int8 one-pass and 51 for int8 per-question, against 50 for fp32. Recall misses rise from 15 to 29 and 24. Many flips are confident, e.g. p ≈ 1 going to ~1e-8.
- In one-pass mode, int8 outputs also depend on batch composition, because the dynamic activation scale is computed over the padded batch.
- **10160 check:** torch fp32 = ORT fp32 (box) = pod bf16, all 29/18/19 on v2 and 10/9/7 on v1-207, CSE PASS. No int8 gate was run for 10160.
- **int8 depends on the hardware.** The same int8 file flips 462 of 2550 decisions on the box CPU (AMX) on the first 150 items, against 28 on the VPS. An int8 build would answer differently on users' machines depending on their CPU. A per-channel int8 variant was built (sha e972945d…) but not run on the VPS.

**Gate verdict for int8:** it passes CSE, but it is a different classifier. Recall misses nearly double, so it cannot borrow fp32's gate results. Even if it were adopted, its one-pass median (1.21 s) is still above 1 s.

## 5. What this means for decision rule 3
"Laya's CPU median is under 1 second per response on the Nepal VPS": **not met.**
- fp32, the model as gated: 2.38 s median.
- int8 one pass: 1.21 s, and it answers differently.
- int8 with 17 single-row runs: 1.003 s. That is still not under 1 s, it is not one pass, and it answers differently.

The suite medians are a lower bound, because suite responses average only about 12 tokens. Longer real responses cost proportionally more (§3.2).

Laya is still about 1.7× faster than Qwen per-primitive on the same CPU in fp32 (2.38 s vs 3.94 s), and about 3.3× faster in int8. Getting under 1 s would need work outside Step 3's scope:
- Removing padding (per-question runs already save 29%).
- Shortening the 17 instruction prefixes, which dominate the tokens.
- An architecture that encodes the response once.
- Quantization-aware training, so int8 keeps fp32's answers.

## 6. Disclosures
- The box copy of `task1-retrain-checkpoints.tar` is truncated (sha a5d40bec… against the recorded 385ef23d…). The VPS copy verified, and the weights came from it. The truncated file was left in place.
- No per-file weight manifests had been recorded before, only archive SHAs. I wrote them now: `ckpt/*.files.sha256`.
- On first import, transformers 4.48.3 in the VPS venv created a 1-byte `/root/.cache/huggingface/hub/version.txt`. It is harmless and was left in place. Later runs used `HF_HOME=cpu-bench/hf-home`.
- The checkpoint's shipped temperatures are not applied (raw logits, T=1), the same as the task1 gate.
- The Qwen CPU number is Task 2's measurement (100 items) and was not re-measured in this step.
