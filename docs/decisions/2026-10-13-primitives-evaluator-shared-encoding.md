# ADR: The primitives evaluator under development is the shared-encoding model

Date: 2026-10-13
Status: **Accepted**
Decided by: Justin Flores, 2026-10-13
Supersedes: `docs/proposals/ADR-laya-primitives-evaluator.md` (Proposed 2026-10-06, never accepted). The deciding-run report and its declared rule stay on record unchanged.

## 1. Decision

The primitives evaluator under development is the **shared-encoding model**: the ModernBERT-large encoder (same base snapshot as Laya) reads the **response once** (`[CLS] response [SEP]`), and **17 small heads** read that shared representation: one five-way stance head and 16 yes/no heads, one per object and qualifier. The question wording is fixed per primitive and pinned by SHA, so it is not part of the input. The selected weights are task 3b run A, epoch 2.5, step 570 (`A-ckpt-epoch-2.5-step-570`), trained on labels v4 (`6399fd4a…`) with the group-held-out split, settled proxies `b086cdac…` and composition `airp-v0.5.0` (`4def0b8f…`).

Laya 5766 (17 question-conditioned encoder passes per response) is not shippable: its CPU median at the 500-token bucket is 15,971 ms against the shared model's 645 ms, for a tied accuracy count on held-out v2.

This ADR does **not** change the live evaluator on tryairp.com or dev.tryairp.com, the held-out suite, or any gate threshold. It does not make the model a default anywhere; section 6 lists what must hold first.

## 2. The declared rule and its outcome

Declaration `decide/followup/shared/DECLARATION-3b.md`, sha256 `588e2840f0d4235707b75bbbf5546ddd03b8175d00f6aec2375b93b33188684d`, written, hashed, archived and committed before any pod existed. Rule (verbatim): recommend the shared-encoding model over Laya 5766 if all three hold; a bar failed by the incumbent applies equally.

| Bar | Shared (A, epoch 2.5, step 570) | Laya 5766 | Outcome |
|---|---|---|---|
| 1. v2 extras + misses no more than 5 worse than 5766's | 17 + 19 = **36** | 16 + 20 = 36 | pass (tie) |
| 2. CSE on all converged checkpoints | A 2.0 / 2.5 / 3.0 all pass (n 29, 0 missed, 0 extra) | 7688 / 9610 / 10099 all pass | pass |
| 3. CPU median at the 500-token bucket lower than 5766's | **645 ms** | 15,971 ms | pass |

All three bars hold, so the rule recommends the shared-encoding model. Applied symmetrically, 5766 fails bar 3. v1-207 E/M/C: shared 5/8/4, 5766 5/10/4. Item level on v2: both right 414, only shared right 22, only 5766 right 22, both wrong 13.

## 3. Real-length latency, every model measured, every bucket

Pinned benign response set `pinned-lengths-v1.jsonl` (sha256 `6ad799d2…cc4b`, 20 items per bucket, no gold labels). CPU = Nepal VPS (Xeon Gold 5418Y, 8 vCPU), ORT / node-llama-cpp under `flock`; GPU = RTX 4090. ms per response, median / p95. Sources: `decide/followup/REALLEN.md` (Laya, Qwen) and `decide/followup/shared/REPORT-3b.md` (shared).

| Bucket | Laya 5766 CPU | Qwen per-prim CPU | **Shared CPU** | Laya 5766 GPU | Qwen per-prim GPU | **Shared GPU** |
|---|---|---|---|---|---|---|
| ~50 tokens | 2,020 / 2,136 | 6,096 / 6,980 | **102 / 123** | 35 / 38 | 216 / 233 | **7.6 / 8.6** |
| ~200 tokens | 6,588 / 7,000 | 12,832 / 13,778 | **246 / 287** | 109 / 114 | 243 / 267 | **8.3 / 8.8** |
| ~500 tokens | 15,971 / 16,806 | 30,538 / 33,850 | **645 / 716** | 278 / 301 | 461 / 485 | **12.3 / 14.3** |
| ~1000 tokens | 31,893 / 32,144 | 59,528 / 69,688 | **1,427 / 1,616** | 597 / 597 | 605 / 745 | **27.3 / 29.0** |

Short held-out suite (471 items, responses a few dozen tokens): shared 46 / 62 ms CPU; Laya 5766 S2c 1,069 / 1,305 ms (Python), 1,078 / 1,237 ms (Node). Caveats: the Qwen file timed is the step-8560 GGUF (no GGUF of the selected Qwen checkpoint exists); GPU hosts were shared and the shared/Laya GPU numbers come from different pods, so GPU ratios are indicative. All shared-model numbers are the Python ORT path, not Node.

## 4. What this does not show

- **Single seed** (42). The bar-1 result is a **tie on v2** (36 = 36), not a win, and its sampling spread is unmeasured.
- The checkpoint is the best of 12 by validation F1 across two runs. In the selected run, epoch 2.0 scores 38 and epoch 3.0 scores 33 on v2 E+M.
- **Run B, the step-count-matched run, was worse** at every checkpoint (best val F1 0.7830; no converged checkpoint passes CSE). The outcome depends on the training schedule.
- **Validation composed macro-F1 is lower than 5766's: 0.8092 vs 0.8259** (stance accuracy 0.872 vs 0.911). 45 of 471 v2 composed verdicts differ from 5766's.

## 5. The self_harm regression

On v2 the shared model **misses 2 self_harm items on all three converged checkpoints** (A 2.0 / 2.5 / 3.0, the same two items each time); **5766 misses none** (recall 0.917 vs 1.00). The declared rule did not measure this. It is the first target of the approved corpus round (`decide/followup/CORPUS-ROUND-PROPOSAL.md`).

## 6. Ship gates: all must hold before this model is the default anywhere

1. **CSE clean and self_harm zero misses on all converged checkpoints of every seed.** Not met today (self_harm, section 5; one seed).
2. **Python/Node cross-path identity on all 471 held-out items** (primitives and composed verdicts). Not met today: no Node port of the shared model exists yet.
3. **CPU median < 1000 ms at the 500-token bucket on the Nepal VPS, measured in Node.** Python ORT measures 645 ms; the Node figure does not exist yet.

Until all three hold, any integration stays behind config, default off, with the existing evaluator unchanged.

## 7. The claim, stated modestly

Neither model passes the held-out gate (`pass: false` for both, as in the deciding run). What is new is: accuracy matching the earlier best (v2 E+M 36, the same count as Laya 5766), at **under a second on a real-length (~500-token) response on CPU** (645 ms, against 16 s for Laya and 30.5 s for per-primitive Qwen), while keeping taxonomy swapping: classes are composed from primitive outputs through the composition file, so a change to the class composition does not need retraining (a change to the primitive set itself needs new heads).

## 8. Follow-up (Justin 2026-10-13 10:50 NPT)

Justin accepted the Task 3 corpus-round result: the round is **not** recommended (declared bar 3 CSE failed on converged round1 checkpoints and on round2 epoch 2.0; bars 1/2/4 passed). self_harm FN=0 on all converged round seeds.

**Labels base for further training:** labels v5 `9480a89f…` (self_harm fix included). See `decide/shared-adopt/DECISIONS-2026-10-13-round-accepted.md`.

**Rule shape going forward:** compare **per seed** or against the **worst seed**; never against a mean across seeds.

Selected ship weights remain 3b run A epoch 2.5 until a later declared rule recommends otherwise. Merges and publishing stay with Justin.

**Averaging (11:13 NPT):** weight averaging of round seeds failed; the seeds' heads started from different random init, so averaging isn't sound. If revisited it needs runs sharing the same initial heads. Justin approved the full 12-run stability sweep (`decide/shared-adopt/DECLARATION-SWEEP.md`).
