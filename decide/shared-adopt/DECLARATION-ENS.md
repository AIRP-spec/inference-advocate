# Declaration: probability ensembles of round-recipe seeds (EXPLORATORY, no training)

Date 2026-10-14 (NPT), Justin 00:34 NPT. Status: **DECLARED BEFORE ANY ENSEMBLE SCORING.** Hashed, committed, pushed (ls-remote verified) and archived to the VPS before any ensemble gate is computed.

**EXPLORATORY.** Every member seed's own epoch-3.0 results are already known (REPORT-TASK3, RESCORE-CSE-CORRECTED, REPORT-FRESH). A pass here is not a ship recommendation. At most it justifies a declared distillation test on fresh seeds.

## Ensembles (exactly two; no other subset may be chosen from results)

| id | members (each at epoch 3.0, step 690; archived raw logits) |
|---|---|
| `ens5` | round1, round2, fresh-s3, fresh-s4, fresh-s5 |
| `ens3f` | fresh-s3, fresh-s4, fresh-s5 |

## Method

For each item (val and held-out v2), each member's yes/no primitive P(true) = softmax(logits, T=1)[yes], and stance probs = softmax(stance logits, T=1). The ensemble value is the **uniform arithmetic mean** across members, per primitive and per stance class. It fires iff mean P >= 0.5; stance = argmax of the mean stance probs. Nothing is fitted on val or held-out. Composition: corrected `airp-v0.5.0-cse-corrected.json` `4e840f3b77c4a15fca46bc1bb537e5d4f3f6cbe37e4dde94d4e5d411f585be38` (mention rule unchanged). Gate: `gate-from-primitives-comp.mjs`, suite held-out v2 `6c7b30e1…`, settled proxies `b086cdac…`.

## Pass bar (per ensemble)

An ensemble is **one model**: one set of averaged primitives. "Every seed" and "worst seed" therefore both reduce to that single output. An ensemble passes iff all hold:
1. CSE clean (0 miss, 0 extra over 29)
2. self_harm misses 0
3. v2 E+M <= 36

Each ensemble is judged on its own; no fallback.

## Also reported

- For every held-out item that fails (any class extra or miss) on **any** of the five single seeds at epoch 3.0: how many of the five fail it, plus whether ens5 and ens3f fail it.
- Node latency at the ~500-token bucket on the Nepal VPS (flock, nice 10, MemoryMax 9G, intraOp 8, n=20 pinned items, median/p95) for **2- and 3-model ensembles**. Each member is a separate encoder: its own ORT session and its own full `evaluate()`, run sequentially per item, with the time summed per item. All members use the A570 fp32 graph, which has the same architecture and FLOPs as the round-recipe graphs; latency does not depend on weight values. 1-model is the reference.

If an ensemble passes: write a distillation proposal with cost. Do not run it.
