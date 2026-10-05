# Task 1: Laya Re-Gate with Methodology Fixed — Report

**Date:** 2026-10-05 (NPT)  
**Branch:** `cursor/task1-laya-regate-methodology-fixed-eb65`  
**Commit (this report's tooling):** `72207b90b5a3a585b60d2597911fd96c8b444694`  
**Pod:** `jbosjzujr94hu3` (RTX 4090 SECURE, $0.74/hr) — terminate after archive  

---

## 1. Input SHA verification

| Input | SHA-256 (prefix…) | Status |
|---|---|---|
| Labels `primitives-labels-8056-v3-merged.jsonl` | `5bdae44c…cd282` | OK |
| Corpus `corpus.jsonl` (8056 rows) | `712fd64d…aab74` | OK |
| Composition `airp-v0.5.0.json` | `4def0b8f…` | OK |
| Held-out suite v2 | `6c7b30e1…` | OK |
| Gate historicalSubset v1-207 | `f577129b…` | OK (matches gate.json) |
| Archive `airp-laya-20260929-bf16-complete.tgz` | `5d775b06…` | OK (box + VPS + pod) |
| Gold proxies `gold-proxies.v0.5.0.json` | `c601c183…` | OK (unchanged) |
| Old train / val | `474c8a60…` / `dcb44431…` | OK |
| Trainpack tgz | `7be07962…` | OK |

---

## 2. Gold proxies (derivation + disagreements)

**File:** `tools/evaluator-training/primitives/gold-proxies.v0.5.0.json`  
**SHA:** `c601c183eeebe537cb6f80c5f33826803d892f0563e0b9d3cb645d1d0ede6c51`  
Derived from composition `airp-v0.5.0.json` + taxonomy `flags.v0.json` via `derive-gold-proxies.mjs`. **Not modified this run.**

### Proxy vs Qwen per-atom audit (`per-atom-precision-converged.json`)

Report, do not choose (brief):

| Primitive | Proxy file (`expectIncludes`) | Proxy gold n (v2 suite) | Qwen audit goldYes | Notes |
|---|---|---|---|---|
| `violence_person` | `criminal_assistance`, `violence` | 45 | 24 | Audit used violence-only |
| `financial_crime` | `criminal_assistance` | 31 | 21 | Audit note: "CA without violence (weak)" |
| `intrusion` / `weapons` | present in proxy | (CA-linked) | audit rows have null tp/fp | Audit has no usable gold |
| `is_mention_not_use` | **absent from proxy file** | — | present in audit | Proxy file has no entry |
| `explicit_register` | **absent from proxy file** | — | present in audit | Proxy file has no entry |
| stance primitives | present in proxy | — | **absent from audit** | |

### `exceeds_common_knowledge` caveat

Proxy expects `criminal_assistance`. Self-harm method items that carry eck in the corpus therefore count as false positives under this proxy for both Laya and Qwen. Intentional for cross-architecture consistency.

---

## 3. Split audit (1b)

**Method:** random-row within strata (stance + 3 rare qualifiers). Built by `/workspace/airp-laya-8056/build_split.py` (Python), **not** by repo `split-train-val.mjs`. `split-meta.json` records the stratification.

**Contrast-group leakage:** 223/805 val rows carry a `contrastGroup`; all 64 of those groups also have members in train. All 805 val kinds also appear in train. 0 exact content duplicates, 0 id overlap.

**Val excluded from training: yes.** `preprocess_airp.py` builds `train_items` only from `train.jsonl` (log: 7250×17 = 123250 sequences). Val used only by `fit_thresholds`.

**Cloud-agent bugs (fixed/documented):**
- `audit-split-method.mjs` inferred method from a version string, not evidence.
- `split-by-group.mjs` read `contrastGroup` from the labels file (absent there; only in corpus), fell back to `kind`, took 10% of group *count* not rows, and did not exclude the bnd-05 collision.

---

## 4. Step 10,160 (1g)

**Neither early stopping nor a planned 2.6 stop.**

Evidence from archived `laya-train.log` + `training-meta.json`:
- Config: epochs=3, steps_per_epoch=3852 → skip-free end ≈ 11,556 optimizer steps.
- Log: `=== Epoch block 3/3 … | ep≈2.638 ===` then `FULL_TRAIN_EXIT:0`. All 3 data-pass blocks finished.
- Final `skips=5581` (~12% of ~46,221 micro-batches). Skips do not advance grad-accumulation → ~3,387 opt steps per data pass → global_steps=10160.
- Checkpoint name `2.6` = `round(epoch_f, 1)`, not a configured stop. Half-epoch names are in optimizer-step space.
- Related: 30,986/40,636 loss_curve points are exactly 0.0 (±30 logit clamp saturation). Archived T=1.2 placeholders on ckpts 1–5; val-fitted T on 10160.

`RUN.md` previously claimed "Planned checkpoint at 2.6 epochs" — **corrected** in commit `72207b9`.

---

## 5. Original six — gate results (1a/1c)

Condition 2 = archived thresholds (identical across all 6; `intrusion`/`weapons` thr=0.0 because zero label positives).  
Supplementary **2b** = per-checkpoint own-val refit via trainpack `search_threshold`; zero-val-positive primitives keep 0.5 (PRE-DECLARATIONS A1).

Val macro-F1@0.5 (primitives with val positives) selects **`ckpt-epoch-2.6-step-10160`** (0.9479; stance acc 0.9727). Tie-break rule unused.

Archived-decision consistency from fresh raw logits: **7536/7536** noul decisions + 471/471 stance for every checkpoint.

Held-out ModernBERT state tokens: max=34, **over_1024=0**, no truncated sequences (max_seq_len=124).

### Table (extras / recallMisses / cleanFires)

| Ckpt | v2 default | v2 fitted | v2 2b | v1-207 default | v1-207 fitted | v1-207 2b | CSE d/f/2b (n/miss/extra) |
|---|---|---|---|---|---|---|---|
| 1926 | 38/19/21 | 50/11/25 | 35/22/20 | 10/8/7 | 16/5/11 | 8/10/6 | 29/0/0 ; 29/0/0 ; 29/0/0 |
| 3852 | 51/14/29 | 66/12/28 | 39/15/18 | 19/6/13 | 23/5/12 | 13/7/7 | 29/0/4 ; 29/0/3 ; 29/0/2 |
| 5778 | 37/22/26 | 45/21/27 | 35/21/22 | 14/11/12 | 14/11/12 | 15/10/12 | 29/0/3 ; 29/0/3 ; 29/0/1 |
| 7704 | 32/20/24 | 45/18/31 | 35/18/23 | 13/8/11 | 16/8/13 | 16/9/12 | 29/0/1 ; 29/0/1 ; 29/0/1 |
| 9630 | 31/20/21 | 39/16/24 | 30/19/20 | 12/10/9 | 13/8/10 | 12/9/9 | 29/0/0 ; 29/0/0 ; 29/0/0 |
| 10160 | **29/18/19** | 38/14/23 | 32/15/21 | 10/9/7 | 12/8/9 | 11/9/8 | 29/0/0 ; 29/0/0 ; 29/0/0 |

Default thresholds → fewer extras, more recall misses at every checkpoint (fitted overfits val). 2b (own-val) sits between default and the copied archived-fitted set.

**CSE across checkpoints (default):** P, F, F, F, P, P — flips → "one draw, not a pass" per brief.

### Val ECE (mean over noul with gold; confidence=max(p,1−p); 10 bins; T=1)

| Ckpt | val macro-F1@0.5 | stance acc | mean noul ECE (val T1) | mean noul ECE (held-out T1) | T_choice / T_noul (val fit) |
|---|---|---|---|---|---|
| 1926 | 0.8381 | 0.9379 | 0.0163 | 0.0253 | 4.899 / 4.870 |
| 3852 | 0.8522 | 0.9528 | 0.0132 | 0.0293 | 4.239 / 4.068 |
| 5778 | 0.9031 | 0.9516 | 0.0092 | 0.0253 | 4.259 / 4.001 |
| 7704 | 0.9353 | 0.9615 | 0.0070 | 0.0254 | 3.960 / 3.659 |
| 9630 | 0.9434 | 0.9702 | 0.0056 | 0.0246 | 3.814 / 3.475 |
| 10160 | **0.9479** | **0.9727** | 0.0056 | 0.0249 | 3.732 / 3.462 |

Per-primitive P/R and Qwen-audit-variant rows are in each `gate-*-*.json` under `perPrimitive` / `perPrimitiveQwenAuditVariant`.

---

## 6. Group-held-out retrain split (1d / Amendment B)

Hill-climb from 200 seeded starts (random-greedy infeasible). Winner: start 99, objective 0.2249.

| Split | n | SHA |
|---|---|---|
| train | 7236 | `0c39e5f4…` |
| val | 819 | `3d223a33…` |

40 units; **0 contrast groups on both sides.** Disclosed residuals: 128 val rows share a kind with train; 685/819 val rows come from contrast groups; all 16 `ca-depth-*` groups landed in val.

Retrain settings match original (bf16, σ=0.25, 3 epochs, bs=8, accum=4, lr 2e-5/1e-4, max_len=1024). Sequences=123012, steps/epoch=3845.

### Retrain results (1d), gated under PRE-DECLARATIONS 1e + Amendment A

Training: `FULL_TRAIN_EXIT:0`, wall 5,503 s, global_steps 10,099 (steps_per_epoch 3,845). Log ends `Epoch block 3/3 … ep≈2.627`. Final **nonfinite skips = 5,736** (original run: 5,581), so it ends early in optimizer steps for the same reason as the original 10,160. Checkpoints: 1922, 3844, 5766, 7688, 9610, 10099. The trainer's quick-fit noul temperature is `nan` again. Raw-logit inference used T=1, so this does not affect any number below.

Conditions:
- "default" = 0.5 per primitive, stance by argmax.
- "2b/fitted" = the checkpoint's own-val refit with trainpack `search_threshold`, using the new 819-row group val. Primitives with zero val positives keep 0.5.

There is no archived threshold set for the retrain.

Val macro-F1@0.5 (14 primitives with val positives) selects **`ckpt-epoch-2.5-step-9610`** (0.8025; stance acc 0.8913). 10099 is 0.8018 / 0.8938, so the selection rests on a 0.0007 margin.

| Ckpt | val macro-F1 | stance acc | v2 default | v2 2b | v1-207 default | v1-207 2b | CSE default ; 2b |
|---|---|---|---|---|---|---|---|
| 1922 | 0.6091 | 0.8205 | 74/46/42 | 19/71/10 | 29/17/20 | 10/27/6 | 29/0/0 ; 29/0/0 |
| 3844 | 0.6860 | 0.8303 | 28/33/20 | 28/39/15 | 12/13/9 | 13/19/8 | 29/0/0 ; 29/0/0 |
| 5766 | 0.7471 | 0.8217 | 43/17/35 | 22/64/19 | 19/6/16 | 9/28/8 | 29/0/0 ; 29/0/0 |
| 7688 | 0.7399 | 0.8730 | 41/19/35 | 18/55/15 | 18/9/16 | 9/28/8 | 29/0/0 ; 29/0/0 |
| **9610** | **0.8025** | 0.8913 | **36/15/32** | 21/38/16 | 16/7/14 | 11/21/8 | 29/0/0 ; 29/0/0 |
| 10099 | 0.8018 | 0.8938 | 35/17/31 | 18/47/15 | 14/8/12 | 7/22/6 | 29/0/0 ; **29/2/0** |

(extras / recall misses / clean fires; CSE n/missed/extra.) Every checkpoint fails the v2 gate in both runs and under every condition.

What the retrain shows:
- **Val drops** from 0.948 to about 0.80 macro-F1, and stance accuracy from 0.973 to 0.891, once contrast groups cannot leak. The original val was optimistic.
- **Held-out changes little at default thresholds.**
  - Selected retrain: v2 36/15/32. Original 10160: 29/18/19.
  - The retrain has more extras and clean fires and slightly fewer recall misses.
  - The held-out suite never overlapped the training corpus, so it was not inflated by the leak.
- **2b thresholds fitted on the group val generalise badly.** Recall misses jump (38–71 on v2). That fits a val distribution dominated by contrast groups (685/819 rows, all 16 `ca-depth-*` groups) that differs from held-out. Per 1c, this is evidence against val-fitted thresholds.

### CSE across converged checkpoints (both runs)

"Converged" here means the last three checkpoints of each run (epoch ≥ 2.0), mirroring the Qwen comparison's three converged checkpoints. This is a reporting choice; it is not pre-declared and is not used for selection. All checkpoints are listed above.

| Run | Converged ckpts | default | archived-fitted | 2b |
|---|---|---|---|---|
| Original | 7704 / 9630 / 10160 | F (29/0/1) / P / P | F / P / P | F / P / P |
| Retrain | 7688 / 9610 / 10099 | P / P / P | n/a | P / P / F (29/0/2 missed) |

- **Original:** CSE flips (P F F F P P over all six at default). By the brief's rule it is one draw, not a pass.
- **Retrain:** passes at default on all six checkpoints. Under 2b, 10099 misses 2 CSE items, so CSE is not stable across threshold procedures either.

### Calibration (ECE)

Ten bins; confidence = max(p, 1−p) for noul and max softmax for stance. Each cell is the mean over noul primitives that have gold.
- Val gold = labels.
- Held-out gold = proxies (stance has no held-out gold).
- Tfit is fitted on that run's own val.

| Run / ckpt | val noul ECE T1 / Tfit | val stance ECE T1 / Tfit | held-out noul ECE T1 / Tfit | T_choice / T_noul |
|---|---|---|---|---|
| orig 1926 | 0.0163 / 0.0120 | 0.0557 / 0.0058 | 0.0253 / 0.0187 | 4.90 / 4.87 |
| orig 3852 | 0.0132 / 0.0093 | 0.0492 / 0.0114 | 0.0293 / 0.0217 | 4.24 / 4.07 |
| orig 5778 | 0.0092 / 0.0068 | 0.0460 / 0.0065 | 0.0253 / 0.0177 | 4.26 / 4.00 |
| orig 7704 | 0.0070 / 0.0064 | 0.0360 / 0.0059 | 0.0254 / 0.0196 | 3.96 / 3.66 |
| orig 9630 | 0.0056 / 0.0050 | 0.0286 / 0.0042 | 0.0246 / 0.0196 | 3.81 / 3.48 |
| **orig 10160** | 0.0056 / 0.0053 | 0.0266 / 0.0021 | 0.0249 / 0.0200 | 3.73 / 3.46 |
| retrain 1922 | 0.0536 / 0.0489 | 0.1672 / 0.0379 | 0.0337 / 0.0273 | 6.36 / 6.26 |
| retrain 3844 | 0.0370 / 0.0388 | 0.1292 / 0.0395 | 0.0247 / 0.0213 | 5.10 / 5.61 |
| retrain 5766 | 0.0430 / 0.0454 | 0.1653 / 0.0097 | 0.0261 / 0.0234 | 6.11 / 5.85 |
| retrain 7688 | 0.0386 / 0.0377 | 0.1250 / 0.0073 | 0.0262 / 0.0213 | 5.55 / 5.56 |
| **retrain 9610** | 0.0349 / 0.0400 | 0.1101 / 0.0133 | 0.0240 / 0.0199 | 5.32 / 5.34 |
| retrain 10099 | 0.0342 / 0.0384 | 0.1049 / 0.0348 | 0.0233 / 0.0202 | 5.17 / 5.24 |

Raw logits are badly over-confident: fitted temperatures are 3.5–6.4, consistent with the ±30 clamp saturation and exact-zero losses. The original run's val ECE looks excellent only because its val leaked. On held-out, both runs sit near 0.024 (T1) and 0.020 (Tfit).

### Latency (1f)

Each measurement is one `Agent.predict` call per item (17 questions, max_len 1024, head_max_len 256), in-process, one item at a time.

| Host | Checkpoint | n | median ms/item | p95 ms/item |
|---|---|---|---|---|
| RTX 4090 (pod, idle after training), torch 2.4.1 | retrain 9610 (selected) | 471 | 26.8 | 28.5 |
| RTX 4090 | other retrain ckpts (1922…10099) | 471 each | 26.7–27.3 | 27.9–29.3 |
| RTX 4090 | orig 10160 | 471 | 26.3 | 27.5 |
| nepal-vps Xeon Gold 5418Y, 8 threads, torch 2.14 cpu | orig 10160 | 118 (every 4th item, 5 warm-up) | 2236 | 2649 |

- The VPS CPU run was **bounded** (480 s cap). An earlier unbounded run over all 471 items (~2.2 s/item) was stopped at ~18 min so Task 2's CPU bench was not blocked.
- The VPS was otherwise idle; the only runnable processes were the existing node sites/daemon at <1% CPU.
- Retrain checkpoints have the same architecture and size, so CPU latency carries over. The 4090 numbers confirm this: all checkpoints fall within ±0.5 ms.

### Tokens / truncation

All 471 held-out items are ≤ 34 ModernBERT state tokens, so **0 are over 1024** and 0 sequences are truncated (max sequence length 124 including the question header). Handling of longer states is described in section 7.

## 7. Truncation handling

`laya.common.build_sequence`: with default `truncate_left=False`, string states keep the **head** and drop the **tail** (`state_ids[:room]` where `room = max_len − question_header − 1`). List states can left-truncate. Held-out suite: 0 items over 1024 ModernBERT state tokens.

---

## 8. Code fixes this run

| File | Issue | Fix |
|---|---|---|
| `gate-laya-task1.mjs` | Placeholder; no inference/compose; `await import` in non-async fn | Real gate over probs JSONL + shared compose/score |
| `analyze_laya_task1.py` | (new) | Offline val macro-F1, 2b thr, ECE, probs, consistency |
| `RUN.md` | Claimed planned 2.6 stop | Corrected to nonfinite-skip explanation |
| `laya.test.mjs` | Mock-only compose identity | Added real shared-compose identity test |

---

## 9. Brief question 1 (Laya side): does Laya beat, match, or trail per-primitive Qwen?

This is from the Laya side only; Task 2 owns the Qwen re-measurement. The Qwen reference below is `per-atom-precision-converged.json` (CK-8560/10700/12840), scored on held-out v2 with the same proxies except the two disputed atoms.

- **Accuracy: Laya trails or at best matches.**
  - Selected Laya checkpoints, default thresholds, are close to Qwen on most shared-proxy atoms:
    - subject_is_minor: 0.94–1.00 P / 1.00 R (Qwen 1.00/1.00)
    - sexual_activity: 0.90–0.92 / 0.98–1.00 (Qwen 0.94/0.98)
    - self_harm: 0.96 / 0.92 (Qwen 1.00/0.92)
    - targets_protected: 0.90–0.93 / 1.00 (Qwen 0.90/0.96)
    - directed_at_user: 0.73–0.77 / 1.00 (Qwen 0.71/1.00)
  - Laya is clearly worse in three places:
    - **intrusion and weapons never fire** (0 recall). They have zero positives in all 8,056 labels, so Laya cannot learn them; the original "fitted" run hid this by setting their threshold to 0.0.
    - violence_person recall is only 0.53 against the CA|violence proxy (45 gold). Against the audit's violence-only proxy it is 0.96/1.00, the same as Qwen.
    - Stance is weak: describes P 0.23, endorses P 0.18–0.21.
  - At the item level, every Laya checkpoint fails the v2 gate in both runs (best v2 default 29/18/19).
  - **Remeasurement needed:** with the leak removed, the selected retrain checkpoint is v2 36/15/32. The Task 2 Qwen numbers are needed for the item-level comparison.
- **Latency: Laya wins clearly.** 26.8 ms median / 28.5 ms p95 per item for all 17 primitives on a 4090, and 2.24 s / 2.65 s on the 8-vCPU VPS CPU. The Qwen comparison figures come from Task 2.
- **Calibration: Laya matches only after temperature scaling.**
  - Raw Laya probabilities are badly over-confident (T ≈ 3.5–6.4).
  - After val temperature fitting, held-out noul ECE is ~0.020 for both runs.
  - Val-fitted thresholds (archived or 2b) do not transfer to held-out, and the 2b refit on the group val makes recall far worse.
  - The Qwen ECE figure is Task 2's.

Net, from the Laya side: Laya is much faster and calibratable after temperature scaling, but it trails on accuracy. The structural causes are intrusion and weapons having no training positives, weak stance, and an item-level gate that still fails. A comparable Qwen item-level number from Task 2 is needed before calling it "trails" rather than "matches on per-atom P/R".

## 10. Spend / pods / archive

- Pod `jbosjzujr94hu3` (airp-task1-laya, RTX 4090 SECURE, $0.74/hr) started ~10:31 NPT. No second pod.
- Archive on nepal-vps under `/root/primitives-evaluator/task1-2026-10-05/`:
  - `task1-orig-results.tgz` (SHA `6cfcf260…`) — orig gates, analysis, raw logits, split-group
  - `task1-retrain-results.tgz` (SHA `ac8c358c…`) — retrain gates, analysis, raw logits, training-meta, retrain log
  - `task1-pod-outputs.tgz` (SHA `3fcd008f…` on pod; verified on VPS) — bench JSONs, logs, loss_curve
  - `task1-retrain-checkpoints.tar` (SHA `385ef23d…` on pod) — six retrain checkpoint dirs
  - `bench/bench-cpu-orig-ckpt-epoch-2.6-step-10160.json` — VPS CPU latency
  - `ckpt-orig/ckpt-epoch-2.6-step-10160/` — orig selected checkpoint for CPU bench
- Terminated at ~12:36 NPT after archive SHAs verified. Uptime 7,472 s (2.076 h) × $0.74 = **$1.54**. Confirmed absent from RunPod `myself.pods` (only Task 2 pod remains).
- Ledger: `/workspace/airp/spend-ledger.txt`.
- Commits on branch `cursor/task1-laya-regate-methodology-fixed-eb65` (PR #27): tip `35aaf6f5d135412628e824c23b1ce77425362c10` (report); prior `72207b9` (gate/analyze/RUN.md).
