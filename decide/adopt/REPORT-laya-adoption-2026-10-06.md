# Laya adoption: report (2026-10-06)

Brief: `decide/adopt/BRIEF-laya-adoption-2026-10-06.md` (sha256 `59e142801dac5b4312826162af2e28af092f8250e81a536f442812d5e7f1a6f1`). Repo AIRP-spec/inference-advocate. Times NPT (UTC+5:45). Model under discussion unless stated: Laya deciding-run retrain, selected checkpoint `ckpt-epoch-1.5-step-5766` (labels v4 `6399fd4a…`, group-held-out split), fp32. Held-out suite v2 `6c7b30e1…` (471 items), settled proxies `b086cdac…`, gate thresholds unchanged. Neither the suite nor the thresholds were edited. The live evaluator on tryairp.com / dev.tryairp.com was not touched.

Claim kept modest, as the ADR words it: neither model passes the gate. Laya's false fires roughly match the old class-trained model on this suite, and it misses more than that model did. What is new is matching it on false fires while supporting taxonomy swapping.

## 1. int8 vs fp32, and one pass per response

**int8 is not the deployment build.** It is a different model, not a faster copy of fp32. The deployment build is fp32. (`INT8-GATE.md`; dynamic int8 QInt8 MatMul/Gemm, ORT CPU, one batched `session.run`.)

| Ckpt | Role | fp32 v2 E/M/C | fp32 CSE | int8 v2 E/M/C | int8 CSE | Composed disagree int8 vs fp32 (of 471) |
|---|---|---|---|---|---|---:|
| 5766 | selected | 16/20/13 | PASS | 234/105/49 | FAIL (missed 5, extra 41) | **220** |
| 7688 | converged | 41/25/34 | PASS | 229/98/72 | FAIL | 223 |
| 9610 | converged | 35/20/24 | PASS | 258/97/56 | FAIL | 226 |
| 10099 | converged | 37/23/25 | PASS | 272/85/65 | FAIL | 234 |

At 5766, 426 of 471 items have at least one primitive flip (1166 flips in total). The worst primitives are addresses_own_nature 25%, violence_person 20% and stance 19%. The brief's bar was "within a couple of items, CSE clean", and int8 is about 220 items off with CSE failing. So the ~1.2 s int8 figure from the deciding run is not a latency for a model that answers like fp32. Disclosure: this gate ran on box ORT (AMX). The VPS showed fewer int8 flips in Step 3, but the verdict does not depend on the host.

**One pass per response: confirmed from the code that ran** (`ONE-PASS.md`, traced by SHA on the box and the VPS). Every CPU figure came from **one forward call per response**: one batch of 17 question-conditioned rows, one row per primitive. No timed path makes one call per primitive, so no re-measurement was needed. Laya puts the question inside the encoder input, so 17 rows per response is inherent to this architecture. Encoding the response once and sharing it across primitives would need a different model.

## 2. Best CPU latency (Nepal VPS, 8 vCPU, full 471 items, median / p95 per item)

**Best build that keeps 5766's answers: 1069 ms median, 1305 ms p95** (from 2313 / 3431 ms). Each change was gated alone against the previous best. **Accuracy impact: none.** Every step has 0 composed-verdict disagreements and 0 thresholded primitive flips out of 471, max|Δlogit| ≤ 4.1e-4, v2 stays 16/20/13 and v1-207 5/10/4, and CSE passes. (`CPU-SPEED.md`)

| Step | Change | Median | p95 | Disagree vs previous |
|---|---|---:|---:|---:|
| s0 | baseline, padded 17 rows, intra 8 | 2313 | 3431* | 0 vs box fp32 |
| S1 | ORT `session.intra_op.allow_spinning = 0` | 1890 | 2233 | 0 |
| S2 | padding-free **packed** export: block-diagonal attention, per-segment RoPE positions, still one `session.run` | 1130 | 1875 | 0 |
| **S2c** | packed + **cost-minimising bin cap** (layout only) | **1069** | **1305** | 0 (and 0 vs s0) |
| S3 | max_len 128, chosen from the token distribution before gating (longest row 124) | identical on this suite | | 0 |
| — | ORT transformer optimizer | no gain (0 attention fusions) | | 0, not adopted |

\* inflated by a concurrent rsync. Clean controls are about 2.25 s / 2.6–2.7 s.

**The 1-second target is not met at the accuracy-matched build.** About half of the items are under 1 s, but the median is not. The suite's responses are short (median 12 tokens), so real chat medians will be higher.

**Rejected alternative, Task 3 step 4: ModernBERT-base retrain (a new model).** Same labels v4, split, hyperparameters, validation selection rule and proxies. One RTX 4090 pod, $1.33.
- Selection picked `ckpt-epoch-2.6-step-10099`: val composed macro-F1 **0.7921**, stance 0.857. Large 5766 has 0.8259 / 0.911.
- VPS with the same S2c + spin-off recipe: **433 ms median, 505 ms p95**. That meets 1 s.
- Accuracy: **CSE named gate FAIL** on every base checkpoint. v2 is 25/19/15 against 16/20/13. Against large S2c, **45 of 471 items disagree** on the composed verdict (215 primitive flips across 154 items). The CSE miss is `ho2d-child_sexual_exploitation-pos-12`, where base drops `subject_is_minor`.
- Not a drop-in replacement. Reaching 1 s with this route trades accuracy, and the trade includes CSE.

## 3. Node integration: cross-path identity test

**Passes.** (`NODE-INTEGRATION.md`, draft PR #29.)
- Setup: `LayaLocalEvaluator` via @receptron/laya on onnxruntime-node, behind config, default off. The rule evaluator stays the fallback.
- On **all 471** held-out items on the same VPS, the Python gate path and the shipped Node path give **identical primitives and identical composed verdicts, 471/471**. Max |logit diff| is 8.3e-4, about 135× smaller than the smallest decision margin. Node reproduces 16/20/13, v1-207 5/10/4, CSE PASS item for item.
- Requirements met: modelSha256 refuse-on-mismatch, temperature/thresholds/question wording pinned by SHA in a pins file, warm-up at the end of `load()`, and composition only through the shared `compose()`.
- The CI test `laya-crosspath` checks the model-free golden-logit part everywhere. The live 71-item two-path compare runs on a self-hosted `laya-bundle` runner, which does not exist yet.

**Latency note.** Node on the VPS (fp32 5766, the padded receptron layout, ORT defaults): **2209 ms median, 2604 ms p95**. That was measured before the S1/S2c wins. To get Node near 1069 ms, the Node session needs `allow_spinning=0` and must reproduce `pack_common.pack_rows` (the packed feed, FFD packing and the S2c cap rule) exactly. That is another place for the two paths to drift, so the cross-path test must then cover the packed feed too. Not done in this phase.

## 4. Consistently failing primitives (for the next corpus round)

The rule was fixed before any number was computed: same direction (FP > FN over-fires, FN > FP under-fires) on all three converged checkpoints 7688 / 9610 / 10099, settled proxies, v2. Read-only; no rows were written. (`PER-PRIMITIVE.md`)

| primitive | direction | errors in that direction (7688 / 9610 / 10099) |
|---|---|---|
| qualifier:addresses_own_nature | over-fires | 29 / 23 / 20 (P 0.43–0.52) |
| qualifier:directed_at_user | over-fires | 7 / 5 / 8 |
| object:sexual_activity | over-fires | 5 / 4 / 6 |
| qualifier:exceeds_common_knowledge | over-fires | 4 / 10 / 7 |
| composite any(financial_crime, intrusion, weapons) | under-fires | 7 / 4 / 6 (R 0.67–0.81) |
| object:profanity | over-fires | 4 / 3 / 3 |
| qualifier:untethered_to_content | under-fires | 3 / 3 / 3 |
| object:violence_person | over-fires | 2 / 2 / 2 |
| object:self_harm | under-fires | 2 / 1 / 1 |
| stance:describes | over-fires | 1 / 1 / 1 |

The large, stable failures are addresses_own_nature and directed_at_user (over-firing), plus the CA composite and exceeds_common_knowledge. Several entries rest on 1–3 items out of about 24 gold positives. Seven primitives cannot be assessed under the settled proxies: financial_crime, intrusion and weapons individually, explicit_register, is_mention_not_use, stance:depicts and stance:endorses.

## 5. Decision record

ADR `docs/proposals/ADR-laya-primitives-evaluator.md`, **status Proposed**, on draft PR #28. It records:
- the switch to Laya and the deciding-run numbers for all three clauses;
- the override, with the rule's defect (the CPU bar was never applied to the per-primitive Qwen fallback at about 3.9 s);
- the corrected rule (every bar applies to every option);
- the modest claim;
- 1 s as a deployment target, not a switching criterion.

It will not be filed under `docs/decisions/` until Justin accepts it.

## 6. Spend and archives

**Spend this phase: $1.33.** One RTX 4090 pod (`0osdj9z2pumvx2`, 05:58:25 → 07:46:04 NPT, 1.794 h × $0.74), terminated after a verified archive. No other GPU. Tasks 1, 2, 4 and 5 used box and VPS CPU only. Budget cap $25.

Nepal VPS `himalogic`, `/root/primitives-evaluator/decide-2026-10-06/adopt/`:

| Archive | MANIFEST.sha256 entries | MANIFEST sha256 | Remote `sha256sum -c` |
|---|---:|---|---|
| `int8/` (int8 + fp32 ONNX, gates) | 98 | `b66bfff2b41ebc8933cf1438b2b8c4525d530fff0eed00248c4f7cfba0713373` | OK (2026-10-06 ~08:00)† |
| `node/` (Node bench, cross-path runs) | 40 | `117842e0d32f81c5adb6a2fde3617d210bb68c94466c5349030ce7964dc3ff66` | OK (2026-10-06 ~08:00) |
| `cpu-speed/` (ladder results, raw logits, gates, ONNX builds, scripts, logs) | 199 | `812c82b151e5530eac50e9577d790a4a6682bb5561912185dc0d7bd2609efd7a` | OK (2026-10-06 ~07:55) |
| `cpu-speed/base/` (base-retrain pod output: all 6 checkpoints, raw logits, training-meta, loss curve, pins, trainpack, labels/split/question data) | 73 | `bf6bf67904c4d0f50f12ae31f7b8b8df66f37bfd17c523f297fd886e213ea02e` | OK, before the pod was terminated |

† Re-verifying the int8 archive found two stale bookkeeping lines in its 2026-10-05 manifest: a self-listed `MANIFEST.sha256.tmp`, and `PROGRESS.md`, which was rewritten 28 s after the manifest. The 97 payload files all verified. I dropped the `.tmp` line, set `PROGRESS.md` to its current sha (`330714a8…`, identical to the box copy) and kept the original manifest as `MANIFEST.sha256.orig-20261005` (sha `4f87cbb9…`). The full check then passed.

Key model SHAs: 5766 fp32 padded ONNX `0b569403…aa8e` (the Node pin); packed (S2c) `910eec05…2696`; base 10099 packed `ac4921f2…52d4`.

## 7. Open decisions for Justin

1. **Accept or reject the ADR** (status Proposed on PR #28). If accepted, move it to `docs/decisions/2026-10-06-primitives-evaluator-laya.md`.
2. **Whether the small-count primitives size the next corpus round.** Six of the ten listed primitives fail by six or fewer items per converged checkpoint. Profanity, untethered_to_content, violence_person, self_harm and stance:describes fail by only 1–3. The pre-declared rule includes all ten. Decide whether to apply a materiality floor (for example ≥ 4 errors on every converged checkpoint) before sizing.
3. **Self-hosted CI runner for the live cross-path test.** Register a runner labelled `laya-bundle` (for example the VPS) with the 1.7 GB bundle and repository variables `AIRP_LAYA_BUNDLE_DIR` and `AIRP_LAYA_PYTHON`. Until then only the model-free half runs on GitHub-hosted CI.
4. **Optional follow-up (not decided here):** port spin-off + the packed S2c feed to the Node path, extending the cross-path test to the packed feed. Expected to bring Node from about 2.2 s toward about 1.07 s on this suite. 1 s still needs a further change that preserves accuracy (for example distilling to a smaller encoder and re-gating).

## 8. Where the work is

- Draft PR #28 (`decide/step4-comparison`): ADR, one-pass, per-primitive table, int8 gate, CPU speed (code and docs), this report.
- Node integration: draft PR #29 (`adopt/laya-node-evaluator`, stacked on #28). Its CI job is shipped as `decide/adopt/node/ci-laya-crosspath.workflow.patch` because the pushing token lacks GitHub's `workflow` scope.
- Local format-patches: `decide/adopt/patches/0001–0005` (0005 = this report) and `decide/adopt/node/patches/0001–0006`.
- Pre-existing, not caused by this work: at 261aea1, the `packages/evaluator-local` tests fail to compile (`test/prompt-v4.test.ts`), which stops root `npm test` before the tools tests.
