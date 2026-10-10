# Follow-up report, brief of 2026-10-06 (Justin)

Written 2026-10-11 (NPT). One report for Tasks 1–5. Nothing here touches tryairp.com / dev.tryairp.com; no suite, held-out file or gate threshold was edited; every PR is a draft and nothing is merged. Detail lives in the per-task documents linked at the end of each section.

## 1. Real-length latency, both models, every bucket (Task 3a; `REALLEN.md`, sha256 `2ad20813…c319`)

Every earlier latency figure (1069 ms Laya, ~3.9 s Qwen) was measured on the held-out suite, whose responses are a few dozen tokens. On pinned benign assistant-style replies (80 items, 20 per bucket; `pinned-lengths-v1.jsonl` sha256 `6ad799d2…cc4b`), Nepal VPS CPU (Xeon Gold 5418Y, 8 vCPU), `flock`'d, n = 20 per cell, ms per response:

| Bucket | Laya 5766 (S2c) median / p95 | Qwen per-primitive median / p95 | Qwen / Laya |
|---|---|---|---:|
| ~50 tokens | 2,020 / 2,136 | 6,096 / 6,980 | 3.0× |
| ~200 tokens | 6,588 / 7,000 | 12,832 / 13,778 | 1.9× |
| ~500 tokens | 15,971 / 16,806 | 30,538 / 33,850 | 1.9× |
| ~1000 tokens | 31,893 / 32,144 | 59,528 / 69,688 | 1.9× |

- **Neither model is "a few seconds" at real length on this CPU.** The cost is linear in response length: Laya re-reads the full response in each of 17 question rows (≈ 393 + 31.7 ms per response token), Qwen runs 18 passes (≈ 1942 + 61.7 ms per token).
- GPU (RTX 4090, ORT CUDA fp32 for Laya, node-llama-cpp CUDA for Qwen): Laya 35 / 109 / 278 / 597 ms, Qwen 216 / 243 / 461 / 605 ms (rep 1; GPU host was loaded, treat as order of magnitude).
- Laya at 1000 tokens hits the max_len 1024 ceiling: **14 of 20 items lose response tail** (the stance row loses up to 135 tokens), and it needs more than 9 GB RAM on CPU (a 9 GB cap was OOM-killed at item 14). Qwen truncates nothing.
- Qwen caveat: the GGUF measured is step-8560 (the file used in Tasks 2 and Step 3); no GGUF exists for the selected checkpoint-11535.

## 2. Shared-encoding model vs Laya 5766 and the declared rule (Task 3b; `decide/followup/shared/REPORT-3b.md`, sha256 `aef3e53f…85f8`)

Idea: encode the response once, attach 17 heads (one stance head, 16 yes/no) instead of 17 encoder passes. Same base encoder, labels v4, split, proxies, composition, suite and thresholds; declaration (sha256 `588e2840…684d`) archived before any pod existed. **Declared rule applied as written (same bars for both options): recommends the shared-encoding model. All three bars hold.**

| Bar | Shared (run A, epoch 2.5, step 570) | Laya 5766 | Result |
|---|---|---|---|
| 1. v2 extras + misses no more than 5 worse than 5766's 36 | 17 + 19 = **36** | 16 + 20 = 36 | PASS (a tie) |
| 2. CSE on all converged checkpoints | A 2.0 / 2.5 / 3.0 all pass (n 29, 0 missed, 0 extra) | 7688 / 9610 / 10099 all pass | PASS |
| 3. CPU median at the 500-token bucket lower than 5766's | **645 ms** (rep 2: 688) | 15,971 ms | PASS (24.8× lower) |

Evaluated symmetrically, 5766 meets bars 1 and 2 and fails bar 3. v2 E/M/C 17/19/13 (5766: 16/20/13); v1-207 5/8/4 (5766: 5/10/4). Item level vs 5766 on v2: both right 414, only shared right 22, only 5766 right 22, both wrong 13.

CPU at real length (median / p95 ms): 102 / 123 at ~50, 246 / 287 at ~200, **645 / 716 at ~500**, 1,427 / 1,616 at ~1000; on the original short suite 46 / 62 ms. GPU: 7.6 / 8.3 / 12.3 / 27.3 ms median at the four buckets. ONNX fp32 parity vs torch on all 471 items: max logit delta 1.8e-4, 0 composed differences.

**Caveats that travel with this result (read before acting on it):**
- **Single seed (42), no spread measured.** Bar 1 is a tie, not a win: 36 = 36 from one run.
- **Best of 12 checkpoints** (two runs × six), chosen by validation F1. Other checkpoints of the selected run: epoch 2.0 scores 38 (+2), epoch 3.0 scores 33 (−3).
- **Lower on validation:** composed macro-F1 0.8092 vs 0.8259, and **stance accuracy 0.872 vs 0.911**. Stance is the visibly weaker head. "Same accuracy" is true only of the totals the rule measures; 45 of 471 composed verdicts differ from 5766.
- **Run B (step-count matched to the incumbent) was worse** at every checkpoint (best 0.7830 val F1; no converged checkpoint passes CSE). The result depends on the schedule: it is the answer for the selected A checkpoint, not for "shared encoding" in general. The incumbent's schedule could not be reproduced exactly (one sequence per response vs 17), so both candidates were run and reported.
- Latency and accuracy come from different inputs (as in 3a). Neither model passes the full held-out gate (`pass: false`, as in the deciding run). Not done: second seed, Node port of the shared model, int8.

## 3. Node latency after the S2c port (Task 2; PR #29)

S2c ported into the Node path (`allow_spinning=0`, padding-free packed graph `910eec05…`, port of `pack_common.pack_rows`: first-fit-decreasing, cost-minimising cap, seg / position ids, flat marker and row_start indices). Cross-path identity run after the port on all 471 held-out v2 items, Nepal VPS, Python S2c path vs Node path:

- primitives identical **471/471**; composed verdicts identical **471/471**; **packed feed tensors hash-identical 471/471** (the packing is covered, not only the logits); **max |logit delta| 8.28e-4**; smallest decision margin 0.112. The test was not weakened (it fails if the cap rule is changed: 50/71 mismatches).
- **Node median 1078 ms, p95 1237 ms** (before the port: 2209 / 2604). Python S2c on the same host: 1069 / 1305. The 1 s target is not met at the median, and this is on near-empty inputs; real-length numbers are in section 1.
- **Important:** the Node packed feed and pins are for the **5766 build** (17 question rows, packing). **The shared model would need its own Node port**: one `[CLS] response [SEP]` sequence, output `[1, 17, 5]`, new pins, and no packer. It is a simpler port than this one but it has not been started.
- Report: `decide/adopt/NODE-INTEGRATION.md` on #29.

## 4. Proposed corpus round (Task 5; `decide/followup/CORPUS-ROUND-PROPOSAL.md`)

Read only; **no rows written**. Per-primitive error table re-computed from the raw-logit gates for the shared model's converged checkpoints (A 2.0 / 2.5 / 3.0). "Fails on every converged" = over-fires (FP > FN) or under-fires (FN > FP) on all three; the 5766 / Laya side-by-side is in the proposal. Eight of Laya's ten failing entries also fail on the shared model, so the round is robust to the adoption choice.

| primitive | proposed rows | note |
|---|---:|---|
| object:self_harm | **12** | **Safety priority** like CSE. Shared model misses the same 2 items on all three converged checkpoints; 5766 misses none (recall 0.917 vs 1.00). |
| qualifier:addresses_own_nature | **24** | Main target. Shared: 3 / 4 / 4 false fires (5766: 9; Laya converged 29 / 23 / 20). The "20–29" in the brief is Laya's converged range, not 5766's. |
| qualifier:directed_at_user | 12 | over-fires 3 / 4 / 6 |
| object:sexual_activity | 12 | 6 contingent on proxy-scope triage |
| composite CA (financial_crime, intrusion, weapons) | 6 | recall-type; misses 2 / 5 / 2 |
| qualifier:targets_protected_characteristic | 6 | recall-type; misses 5 / 3 / 1 (shared only) |
| object:profanity | 6 | |
| qualifier:untethered_to_content | 6 | opposite direction on Laya, so both polarities |
| stance:encourages / conveys_method | 8 | one confusion, 8 contingent on triage |
| object:violence_person | 4 | contingent on triage |
| **Total** | **96** (78 firm, 18 contingent) | **112** with an either-way supplement for `exceeds_common_knowledge` (12) and `stance:describes` (4) |

Caveat: most of these primitives have 1–3 errors per checkpoint; that is noisy single-seed evidence, and the three converged checkpoints of one run are not independent. Rows are training-corpus only (no suite edits, no gold authored on the certification suite), label problems are fixed in generating code, and new rows must pass the leak audit before training.

## PR status (all drafts, nothing merged)

| PR | Branch | Tip | State |
|---|---|---|---|
| #28 `decide: Laya vs per-prim Qwen. Rule said Qwen; overridden for Laya (ADR proposed)` | `decide/step4-comparison` | `f56d63d` | ADR corrected (int8 build failed: 220/471, S2c 1069/1305 fp32 line, fp32-only Section 3, 12-token limit in Section 6, work plan updated). ADR status still Proposed. |
| #29 Laya Node evaluator, S2c packed | `adopt/laya-node-evaluator` | `a718ff5` | Port + identity 471/471 + CI patch |
| #30 shared-encoding experiment (3b) | `decide/shared-encoding-3b` | see the push result in the hand-off message (this report is committed on the branch, so its own tip cannot be written inside it); previous tip `268a762` | adds this report and the corpus proposal |

## CI patch status (Task 4)

`decide/adopt/node/ci-laya-crosspath-hosted.workflow.patch` on #29 (`git apply --check` passes on the branch and on main). It adds a `laya-crosspath` job on `ubuntu-latest`: pinned-URL bundle download, SHA-256 verified before use (also on cache hit; job fails on mismatch), cache between runs, push to main and `workflow_dispatch` only, never `pull_request`, no self-hosted runner. **Blocked on publishing the bundle** (994 MB deterministic archive, sha256 `30ecd3b5…2d77`); until it is published the job fails at download. Justin applies the patch with a workflow-scoped token (the pushing token lacks `workflow` scope, so `ci.yml` is unchanged). **The patch pins the 5766 bundle**: if the shared model is adopted it needs a new bundle, new pins and a new Node port before the job is meaningful. The note is still marked "pending latency picture": section 1 is that picture. Whether the job should gate every push to main is Justin's call; the job runs the 471 held-out items, not real-length replies, so it checks cross-path identity, not deployment latency.

## Spend

**$1.5 of $30.** 3a GPU burst ≈ $0.30; 3b ≈ $1.19 (secure 4090 pod `m1y9qwkkh4kt6p`, 4,687 s at $0.89/hr = $1.16, plus ≈ $0.03 for a community pod terminated after ~5 min with broken CUDA). All pods terminated; none created for Tasks 1, 2, 4 or 5.

## Archive and manifests (Nepal VPS, `/root/primitives-evaluator/decide-2026-10-06/`)

| What | Path | Manifest sha256 |
|---|---|---|
| 3b: all 12 checkpoints, SFT / preprocess metadata, labels, split, question pins, thresholds and temperatures, pinned length set, raw logits, gates, scripts, ONNX, latency (275 files; remote `sha256sum -c` passed) | `followup/shared/archive/` | `MANIFEST.sha256` `4015e8a7ff583c04ce55233e8889b4289df11445e46b61c36e56a56b69b023ff`; `MANIFEST-post.sha256` (CPU latency + 3b report) `64060315ea8afe4f82b9e527e6dba0a311fc0bbb909026802c7e98f193be826f` |
| 3a: pinned length set, results, scripts, REALLEN.md | `followup/` | `MANIFEST.sha256` `ecfdf0f8fc6820c463705e08ec6ceddfc05f08a8ffc2a647069a3a01498ba2a7` |
| Node S2c port: runs, artifacts, bundle | `adopt/node-s2c/` | `MANIFEST.sha256` `8a0ce01233f4f72d8652ca81aefaf7ced7305dfd5b7dfa24a4cdc5160826782d` |
| This report, the proposal and its inputs | `followup/final/` | `MANIFEST-final.sha256` (see `SHA256SUMS.followup-final` on #30) |

## Open decisions for Justin

1. **Adopt the shared-encoding model?** The declared rule says yes, with the caveats in section 2 (tie on bar 1, single seed, lower val F1 and stance accuracy, run B worse). If yes, **the ADR needs a rewrite**: it currently argues Laya vs Qwen, and its latency lines, work plan and decision are for the 5766 build.
2. **Node port of the shared model** (not started; separate pins and feed; the 5766 port does not carry over).
3. **Publish a model bundle** (unblocks the CI patch). Which bundle depends on decision 1; the current patch pins 5766.
4. **Corpus round approval:** 96 rows (78 firm, 18 contingent on proxy triage), 112 with the either-way supplement; self_harm first. Also whether to triage the contingent items' labels in the generating code before authoring.
5. **Second seed?** Bar 1 is a tie (36 = 36) from one seed and the checkpoint is best-of-12; a second seed of run A (a short GPU pod run, well inside the budget) would show whether the tie is sampling noise before the adoption decision rests on it. Not run without your go-ahead.

## Documents

3a `decide/followup/REALLEN.md`; 3b `decide/followup/shared/REPORT-3b.md` and `DECLARATION-3b.md`; Node `decide/adopt/NODE-INTEGRATION.md` (#29); Task 5 `decide/followup/CORPUS-ROUND-PROPOSAL.md`; progress logs `PROGRESS-3a.md`, `PROGRESS-node.md`, `shared/PROGRESS-3b.md`, `PROGRESS-final.md`.
