# Task 3b: shared-encoding experiment. Report

Date 2026-10-11 (NPT). Declaration: `DECLARATION-3b.md`, sha256 `588e2840f0d4235707b75bbbf5546ddd03b8175d00f6aec2375b93b33188684d` (written, hashed, archived to the VPS and committed to the branch before any pod existed; commit a8f89f6). All numbers below follow that declaration. No held-out, suite or threshold file was edited. Nothing touches tryairp.com / dev.tryairp.com.

## Outcome (declared rule, applied as written)

**The rule recommends the shared-encoding model over Laya 5766: all three bars hold.**

| Bar | Shared-encoding (selected A / epoch 2.5 / step 570) | Laya 5766 | Result |
|---|---|---|---|
| 1. v2 extras + misses no more than 5 worse than 5766's 36 | 17 extras + 19 misses = **36** (0 worse) | 16 + 20 = 36 | PASS |
| 2. CSE on all converged checkpoints (epoch >= 2.0 of the selected run: A 2.0 / 2.5 / 3.0) | all three **PASS** (n 29, missed 0, extra 0) | 7688, 9610, 10099 all PASS | PASS |
| 3. CPU median at the 500-token bucket lower than 5766's | **645 ms** (rep 2: 688 ms) | 15,971 ms (REALLEN.md) | PASS (25x lower) |

"A bar is a bar for both options": evaluated symmetrically, 5766 meets bars 1 and 2 and **fails bar 3** (its 500-token CPU median is 24.8 times the shared model's). No bar is failed by both options, so the rule has a valid output. Caveats that go with it are in "What this does and does not show".

## What was trained (and the schedule question)

- Input `[CLS] response [SEP]`, one encoder pass, 17 heads (17 learned queries, 2-layer cross-attention decoder, per-question output layer; stance 5-way, 16 yes/no 2-way). Encoder starts from the same Laya base snapshot as 5766 (rev 55cf4c4e, weights sha 891102d3...); heads are new. Loss, noise, optimizer, LR (2e-5 / 1e-4), cosine schedule, sigma 0.25 -> 0.1, bf16, grad checkpointing, 3 epochs, checkpoint every 0.5 epoch: unchanged from `train_airp.py`.
- **The one forced difference is what a sequence is.** The deciding run trained on 123,012 sequences (7,236 responses x 17 questions) at 32 sequences per step: 3,844 steps per epoch. Here a sequence is a response (7,236) carrying 17 labels. Both runs see the same labelled data for the same 3 epochs (each label seen once per epoch), but the number of optimizer steps depends on how a "step" is defined. That is why two runs were declared before training instead of picking one afterwards:
  - **Run A** (micro-batch 8 x accumulation 4 = 32 responses per step): 227 steps per epoch, **681 steps** in total. Same batch numbers as the incumbent, but 17x fewer steps because each step carries 17x more labels (544 vs 32).
  - **Run B** (micro-batch 2 x accumulation 1): 3,618 steps per epoch, **10,854 steps**; about 34 labels per step, the same as the incumbent's 32, and the same step count as the incumbent's schedule (nominal 11,532; the archived incumbent run itself stopped at 10,099, epoch 2.6).
  - Checkpoint cadence is the same for both runs and the incumbent: every 0.5 epoch, 6 checkpoints per run (the incumbent's last is epoch 2.6, not 3.0).
  - Selection was across all 12 checkpoints by validation composed-class macro-F1 (declared). **The best checkpoint came from Run A, epoch 2.5.** Run B (the step-count-matched one) was worse on validation at every checkpoint (best 0.7830 at epoch 2.0 against A's 0.8092) and has no checkpoint at epoch >= 2.0 that passes CSE (each has 1 extra CSE item). Run B's training loss reached ~0 with reward 0.75 (saturated), i.e. it fit the training set tightly; I did not investigate further. That finding stands as measured. The incumbent's 3,844-steps-per-epoch schedule was not reproduced exactly by either run, because with one sequence per response there is no setting that matches batch size, labels per step and steps simultaneously; both candidates were run instead and are reported.
- One run per setting, seed 42, no hyperparameter search. A single seed means the 36 vs 36 tie on bar 1 carries sampling noise; nothing here measures that spread.

## Validation selection and gates (primary mode: T = 1, 0.5 / argmax)

Selected checkpoint (highest val composed-class macro-F1 of the 12, declared before gating): **A-ckpt-epoch-2.5-step-570, val macro-F1 0.8092** (stance accuracy 0.8718). For reference the incumbent's 5766 had val macro-F1 0.8259 (stance 0.9109) under the same script, so the shared model is lower on validation and equal on held-out v2 right/wrong count.

| Run / checkpoint | val composed macro-F1 | val stance acc | v2 E/M/C | v1-207 E/M/C | CSE (n29) |
|---|---:|---:|---|---|---|
| A-ckpt-epoch-0.5-step-114 | 0.6541 | 0.8791 | 35/83/9 | 11/31/3 | miss 0 extra 4 FAIL |
| A-ckpt-epoch-1.0-step-228 | 0.7564 | 0.7436 | 57/30/40 | 23/14/15 | miss 1 extra 0 FAIL |
| A-ckpt-epoch-1.5-step-342 | 0.7324 | 0.8339 | 27/22/17 | 9/6/7 | miss 1 extra 0 FAIL |
| A-ckpt-epoch-2.0-step-456 | 0.7730 | 0.8742 | 20/18/15 | 7/6/6 | miss 0 extra 0 PASS |
| A-ckpt-epoch-2.5-step-570 | 0.8092 | 0.8718 | 17/19/13 | 5/8/4 | miss 0 extra 0 PASS |
| A-ckpt-epoch-3.0-step-681 | 0.7975 | 0.8767 | 20/13/15 | 7/5/5 | miss 0 extra 0 PASS |
| B-ckpt-epoch-0.5-step-1809 | 0.6426 | 0.8462 | 73/89/26 | 28/35/13 | miss 2 extra 0 FAIL |
| B-ckpt-epoch-1.0-step-3618 | 0.6914 | 0.7753 | 74/38/57 | 37/16/28 | miss 0 extra 6 FAIL |
| B-ckpt-epoch-1.5-step-5427 | 0.6631 | 0.8718 | 69/29/54 | 34/12/28 | miss 0 extra 1 FAIL |
| B-ckpt-epoch-2.0-step-7236 | 0.7830 | 0.8803 | 38/26/31 | 18/11/14 | miss 0 extra 1 FAIL |
| B-ckpt-epoch-2.5-step-9045 | 0.7659 | 0.8816 | 36/34/24 | 15/14/9 | miss 0 extra 1 FAIL |
| B-ckpt-epoch-3.0-step-10854 | 0.7607 | 0.8816 | 40/30/28 | 15/11/10 | miss 0 extra 1 FAIL |

Reference, Laya 5766 (deciding run): v2 16/20/13, v1-207 5/10/4, CSE pass.

**Selected checkpoint: v2 E/M/C = 17/19/13 (n 471, clean n 212); v1-207 E/M/C = 5/8/4 (n 207, clean n 100); CSE pass (n 29, 0 missed, 0 extra).** Neither model passes the full held-out gate (`pass: false` for both, as in the deciding run).

**CSE across converged checkpoints (A 2.0 / 2.5 / 3.0): 3 of 3 pass.** (Run B converged checkpoints: all three FAIL, extra 1 each; reported, not decisive because B was not selected.)

### Secondary mode (temperature and thresholds fitted on validation only; reported, decides nothing)

Selected checkpoint's fits: T_stance 3.94, T_yes/no 4.50 (large; the model is over-confident before scaling); per-primitive thresholds in `offline/secondary/secondary-fits.json`. Secondary selection by val F1 would pick A epoch 1.5 (0.9004), a different checkpoint from the primary one. This is shown for completeness only.

| Run / checkpoint (secondary: val-fitted T + thresholds) | val F1 | v2 E/M/C | v1-207 E/M/C | CSE |
|---|---:|---|---|---|
| A-ckpt-epoch-0.5-step-114 | 0.7832 | 61/63/9 | 21/29/2 | miss 0 extra 4 FAIL |
| A-ckpt-epoch-1.0-step-228 | 0.8879 | 19/47/12 | 5/22/2 | miss 3 extra 0 FAIL |
| A-ckpt-epoch-1.5-step-342 | 0.9004 | 13/29/8 | 4/15/2 | miss 1 extra 0 FAIL |
| A-ckpt-epoch-2.0-step-456 | 0.8756 | 18/34/6 | 4/17/1 | miss 0 extra 0 PASS |
| A-ckpt-epoch-2.5-step-570 | 0.9002 | 14/32/8 | 4/17/2 | miss 0 extra 0 PASS |
| A-ckpt-epoch-3.0-step-681 | 0.8774 | 24/27/12 | 7/15/3 | miss 1 extra 0 FAIL |
| B-ckpt-epoch-0.5-step-1809 | 0.7539 | 52/94/6 | 18/37/4 | miss 1 extra 2 FAIL |
| B-ckpt-epoch-1.0-step-3618 | 0.4800 | 30/141/12 | 16/63/8 | miss 1 extra 5 FAIL |
| B-ckpt-epoch-1.5-step-5427 | 0.7028 | 50/83/15 | 19/39/4 | miss 7 extra 0 FAIL |
| B-ckpt-epoch-2.0-step-7236 | 0.7347 | 37/83/20 | 14/37/9 | miss 22 extra 0 FAIL |
| B-ckpt-epoch-2.5-step-9045 | 0.5963 | 21/87/11 | 6/43/2 | miss 5 extra 0 FAIL |
| B-ckpt-epoch-3.0-step-10854 | 0.7373 | 22/99/16 | 7/44/4 | miss 11 extra 0 FAIL |

## Item-level table vs Laya 5766 (v2, n = 471; "right" = composed class set equals gold `expect`)

| | items |
|---|---:|
| both right | 414 |
| only shared right | 22 |
| only 5766 right | 22 |
| both wrong | 13 |

Each model is right on 436 of 471. Composed verdicts differ on 45 items, so the two models are not interchangeable item for item even though the totals agree. Table: `offline/itemlevel-vs-5766.json`.

## ONNX (fp32, one encoder pass + 17 heads, no padding) and parity

Exported from the selected checkpoint: `shared-ckpt-epoch-2.5-step-570-fp32.onnx`, sha256 `dadee217c626ee46794cd80d6f440ce181d7d38675a0326aeab0eb473c29ab5f` (1.69 GB), input `input_ids [1, L]` (dynamic L), output `logits [1, 17, 5]`, opset 17, batch 1 so nothing is padded. CPU settings as in S2c: ORT intra 8 / inter 1 / sequential / `allow_spinning=0` / ORT_ENABLE_ALL.
- Parity vs torch fp32 on all 471 held-out items: **ORT CPU max |logit delta| 1.8e-4, 0 yes/no flips, 0 stance flips, 0 composed-verdict differences (471/471 identical; gate E/M/C 17/19/13 unchanged).** ORT CUDA (TF32) max delta 0.10, 0 flips, 0 composed differences.

## Latency (ms per response, n = 20 per bucket; per-item = tokenise + run + decode)

CPU: Nepal VPS (Xeon Gold 5418Y, 8 vCPU), under `flock /tmp/airp-vps-bench.lock`, `nice -n 10`, 9 GB cgroup, after 3a finished. Shared model rep 1 / rep 2; 5766 from REALLEN.md (rep 1).

| Bucket | Shared CPU median / p95 (r1) | r2 | Laya 5766 CPU median / p95 | Ratio (5766 / shared, r1 medians) |
|---|---|---|---|---:|
| ~50 | 102 / 123 | 96 / 117 | 2,020 / 2,136 | 19.8x |
| ~200 | 246 / 287 | 265 / 311 | 6,588 / 7,000 | 26.8x |
| ~500 | **645 / 716** | 688 / 718 | **15,971 / 16,806** | 24.8x |
| ~1000 | 1,427 / 1,616 | 1,388 / 1,632 | 31,893 / 32,144 | 22.4x |

Original short suite (all 471 held-out items, 20 warm-up): shared **46 ms median / 62 ms p95** (rep 2: 47 / 63); 5766 S2c on the same suite: 1,069 / 1,305 ms (Task 2/3 figure).

GPU (RTX 4090, same pod class as 3a, ORT CUDA fp32, same harness): shared 7.6 / 8.3 / 12.3 / 27.3 ms median at 50 / 200 / 500 / 1000 (p95 8.6 / 8.8 / 14.3 / 29.0; rep 2 7.7 / 8.7 / 12.3 / 27.3); short suite 7.0 ms median. 5766 (REALLEN.md, ORT CUDA): 35 / 109 / 278 / 597 ms. Ratios 4.6x, 13x, 23x, 22x. 3a's GPU host showed heavy tenant load; this pod's host is a different machine, so GPU ratios are indicative.

Truncation: at the ~1000-token bucket the shared model sees the response only, so it truncates at 1,022 response tokens; 6 of 20 items lose a tail (as for the incumbent, whose rows also carry question text, 14 of 20 lose a tail). 3a's CPU cost model for 5766 is about 393 + 31.7 ms per response token; the shared model is about 56 + 1.4 ms per token here. Memory was not an issue (ran under a 9 GB cap).

## What this does and does not show

- On this suite the shared model matches 5766's headline v2 count (36 = 36) and beats it on v1-207 (13 vs 15 extras + misses), while being roughly 20-27x cheaper on CPU at every length measured. It reads the response once instead of 17 times, which is the whole cost lever 3a identified.
- It is **not** equal on validation (0.8092 vs 0.8259 macro-F1; stance 0.872 vs 0.911) and the per-item agreement is 45 differing verdicts of 471, so "same accuracy" is only true of the totals the rule measures. Stance is the visibly weaker head.
- Bar 1 is a tie (0 worse against an allowance of 5) from a single seed, and the checkpoint is the best of 12 under validation F1 across two runs. The other 11 checkpoints are not all this good: of the converged checkpoints in the selected run, epoch 2.0 is 38 (+2) and epoch 3.0 is 33 (-3). Run B, the step-count-matched run, is clearly worse (best checkpoint v2 E+M 64 at epoch 2.0; none passes CSE on its converged set). The result is therefore sensitive to how training is scheduled, and the 3b answer is for the selected A checkpoint, not for "shared encoding" in general.
- The latency inputs are benign short-to-long assistant text with no gold labels, so latency and accuracy come from different inputs (as in 3a). Real replies are not guaranteed to resemble the 471-item suite's lengths; the suite's median response is a few dozen tokens.
- Not done: no interleaved A/B (the declared 5 % trigger did not apply: the gap is 25x), no second seed, no Node/TypeScript port of the shared model, no int8 build.

## Spend and archive

- GPU: pod `dup4rigvhumek2` (community 4090, broken CUDA, terminated after ~5 min, ~$0.03); pod `m1y9qwkkh4kt6p` (secure 4090, $0.89/hr, uptime 4,687 s = **$1.16**). 3b total about **$1.19**; follow-up total about $1.5 including 3a's ~$0.30 (cap $30).
- **Pod `m1y9qwkkh4kt6p` TERMINATED 2026-10-10T20:17Z after the archive passed its remote check; `pods` list empty.** No second pod was created.
- Archive on the Nepal VPS: `/root/primitives-evaluator/decide-2026-10-06/followup/shared/archive/` with `MANIFEST.sha256` (275 files: all 12 checkpoints, SFT/preprocess metadata, labels (train/val), split definition, question pins, composition, proxies, pinned length set, thresholds and temperatures (`offline/secondary/secondary-fits.json`), raw per-item logits, gates, scripts, logs, ONNX + latency results). Remote `sha256sum -c MANIFEST.sha256` exit 0 (one partially transferred checkpoint, A 1.0, was re-sent and re-verified). Not archived by design: the regenerable `preprocessed/*_items.pt` token caches (preprocess-meta is). CPU latency results and this report are archived in a second manifest (`MANIFEST-post.sha256`).
- Code: new files only in `tools/evaluator-training/laya-shared/` on branch `decide/shared-encoding-3b` (draft PR).
