# Laya vs per-primitive Qwen: deciding run (2026-10-05)

**Status:** COMPLETE.
**Declaration commit:** `9127136d1ede0f2cfb0e2f5fc67158092a1c867b` @ 2026-10-05 09:36:52 +0000 (15:21 NPT) — before any pod start.

---

## 1. Decision rule outcome

Declared rule (brief, verbatim):

> Recommend switching to Laya if all three hold for the selected checkpoints:
> 1. Laya's extras plus recall misses are no more than 5 worse than Qwen's on v2.
> 2. Laya passes the CSE named gate on all converged checkpoints.
> 3. Laya's CPU median is under 1 second per response on the Nepal VPS.
>
> Otherwise recommend staying with per-primitive Qwen.

| Clause | Number | Need | Status |
|---|---:|---|---|
| 1. Δ = Laya(E+M) − Qwen(E+M) on v2 | **-19** (Laya 36 − Qwen 55) | ≤ 5 | **PASS** |
| 2. Laya CSE on all converged ckpts | **PASS** (steps 7688, 9610, 10099; missed=0 extra=0 each) | pass all | **PASS** |
| 3. Laya CPU median (Nepal VPS) | **fp32 2379 ms / int8 1209 ms** (Step 3, one-pass batched ONNX, n=471, 8 threads) | < 1000 ms | **FAIL** (both precisions) |

**Rule outcome:** recommend **staying with per-primitive Qwen**. Justin makes the call.
Clauses 1–2 pass (Laya is actually *better* on v2 E+M by 19); clause 3 fails. The rule needs all three.

### Selected checkpoints (val composed-class macro-F1, primary thresholds)

| Model | Selected | Val macro-F1 | Stance acc |
|---|---|---:|---:|
| Laya | `ckpt-epoch-1.5-step-5766` | 0.8259 | 0.9109 |
| Qwen | `checkpoint-11535` | 0.8351 | 0.8926 |

### Step 3 CPU detail (Nepal VPS `himalogic`, Xeon Gold 5418Y, 8 cores)

One forward pass per response (batched 17 questions), ORT 1.22.1, over_1024 state tokens = 0. Source: `decide/step3/CPU-LATENCY.md`.

| Precision | median ms | p95 ms | mean ms |
|---|---:|---:|---:|
| fp32 ONNX | 2379 | 2727 | 2395 |
| int8 dynamic ONNX | 1209 | 1463 | 1212 |

int8 also flips answers (87–101 decision flips; recall misses rise). Not the same model for rule 3.

### Qwen GPU latency (selected CK, A100, n=471)

From `out/latency/gpu-step-11535.json` (ALL_INFER_DONE 2026-10-05T13:34:35Z).

| Mode | median ms | p95 ms | mean ms |
|---|---:|---:|---:|
| greedy LocalEvaluator | 240.5 | 258.2 | 242.5 |
| scored no-reuse | 2036.6 | 2117.4 | 2042.7 |
| scored reuse | 2019.8 | 2117.7 | 2028.7 |

---

## 2. Item-level comparison on held-out v2

Definition of **right:** composed class set exactly equals gold `expect` (order-insensitive), primary thresholds, shared compose. Selected CKs: Laya `ckpt-epoch-1.5-step-5766` vs Qwen `checkpoint-11535`.

| | count |
|---|---:|
| both right | 401 |
| only Qwen right | 17 |
| only Laya right | 35 |
| both wrong | 18 |
| **n** | 471 |

---

## 3. What changed in Steps 1 and 2

### Step 1 (settled proxies)
See `decide/step1/CONCLUSIONS.md`.
- Old "stance:describes P=0.23" was a **proxy artifact** — does not survive.
- "Laya's weak spots are data problems" does **not** survive as stated.
- Composed class gate numbers unchanged by proxy settlement.

Settled proxies sha: `b086cdac11f8af39b2d3984232ee0372d9ffe909acbd4b8d7fe6d4f653d08455`.

### Step 2 (labels v4)
See `decide/step2/LABELS-FIX.md`. Root cause: CA object subtype resolved from kind substrings; production kinds like `ca-named-help` fell through to `financial_crime`.
- New labels sha: `6399fd4a9b0e33bfbf21d097fc689d50ee9d6dc219db3b16d7dcdef65eb28d36`
- Diff 66 rows: 25 weapons, 21 intrusion, 20 ca-named-refusal clears; unexpected 0; tiebreaker 0.15%
- **Flagged:** invalid `criminal_assistance` object still on 198 violence-method dual rows (not a vocabulary object; left unchanged to keep diff scoped).
- This deciding run trains both models on v4 labels + the same group-held-out split.

---

## 4. Per-checkpoint composed gate (primary thresholds)

### Laya

| CK | v2 extras | v2 misses | v2 clean | v1 extras | v1 misses | v1 clean | CSE (n, missed, extra, pass) |
|---|---:|---:|---:|---:|---:|---:|---|
| `ckpt-epoch-0.5-step-1922` | 23 | 44 | 12 | 2 | 20 | 1 | 29, 0, 0, PASS |
| `ckpt-epoch-1.0-step-3844` | 34 | 29 | 21 | 12 | 13 | 9 | 29, 0, 0, PASS |
| `ckpt-epoch-1.5-step-5766` | 16 | 20 | 13 | 5 | 10 | 4 | 29, 0, 0, PASS |
| `ckpt-epoch-2.0-step-7688` | 42 | 24 | 34 | 18 | 12 | 16 | 29, 0, 0, PASS |
| `ckpt-epoch-2.5-step-9610` | 37 | 20 | 24 | 11 | 12 | 9 | 29, 0, 0, PASS |
| `ckpt-epoch-2.6-step-10099` | 38 | 23 | 26 | 11 | 12 | 9 | 29, 0, 0, PASS |

**Selected:** `ckpt-epoch-1.5-step-5766` — v2 E/M/C = 16/20/13.

### Qwen (greedy uncapped)

| CK | v2 extras | v2 misses | v2 clean | v1 extras | v1 misses | v1 clean | CSE (n, missed, extra, pass) |
|---|---:|---:|---:|---:|---:|---:|---|
| `checkpoint-3844` | 21 | 34 | 16 | 7 | 11 | 6 | 29, 0, 2, FAIL |
| `checkpoint-5766` | 24 | 31 | 17 | 10 | 14 | 7 | 29, 2, 4, FAIL |
| `checkpoint-7688` | 33 | 13 | 24 | 12 | 4 | 8 | 29, 0, 2, FAIL |
| `checkpoint-9610` | 31 | 26 | 20 | 11 | 11 | 7 | 29, 0, 2, FAIL |
| `checkpoint-11532` | 31 | 24 | 21 | 11 | 10 | 7 | 29, 0, 2, FAIL |
| `checkpoint-11535` | 31 | 24 | 21 | 11 | 10 | 7 | 29, 0, 2, FAIL |

**Selected:** `checkpoint-11535` — v2 E/M/C = 31/24/21.
Note: `checkpoint-11532` and `checkpoint-11535` share identical composed scores (same GGUF content hash prefix).

---

## 5. CSE (Laya converged = epoch ≥ 2.0 last three)

- `ckpt-epoch-2.0-step-7688`: PASS (n=29, missed=0, extra=0)
- `ckpt-epoch-2.5-step-9610`: PASS (n=29, missed=0, extra=0)
- `ckpt-epoch-2.6-step-10099`: PASS (n=29, missed=0, extra=0)

All converged Laya checkpoints **PASS** CSE under primary thresholds.

Qwen selected CK CSE: n=29, missed=0, extra=2 → **FAIL**.

---

## 6. Spend

| Item | Amount |
|---|---:|
| Prior (task1+task2) | $3.39 |
| Step4 Laya `iauzudzp6gtcys` (4090, terminated) | $1.86 |
| Step4 Qwen `6x6rfws1x4i15e` (A100, terminated) | **$6.67** (15092s / 4.19h × $1.59) |
| **Step4 subtotal** | **$8.53** |
| **Grand total (task1+2+step4)** | **$11.92** |
| **Hard stop** | **$40** |

---

## 7. Archives

| Artifact | Path |
|---|---|
| Laya | `/root/primitives-evaluator/decide-2026-10-05/step4/laya-pod/` (MANIFEST verified) |
| Qwen | `/root/primitives-evaluator/decide-2026-10-05/step4/qwen-pod/` (MANIFEST verified; tgz sha `5693e6b240954fb9d0eb1fb8ce3b2d38717f89c80971a7600e78d6cfa46dcd69`) |
| Declaration | commit `9127136` |

---

## 8. Flags

- 198 invalid `criminal_assistance` objects on violence-method dual rows (Step 2, scoped leave).
- Qwen setup-and-train tripped after successful train (`--skip-export-checkpoints` orphan); train artifacts intact; post-infer restarted.
- Qwen greedy script initially called nonexistent `promptTokens`; fixed to `passTokens`.
- Clause 3 uses Step 3 architecture-matched CPU numbers (ckpt-9610); this retrain is same encoder size.
- finish_qwen3 hung on `rp.py status` after pod was terminated early to stop idle billing; archive+MANIFEST completed off-pod; terminate confirmed via API `pods=[]`.

---

## 9. PR

Draft PR: https://github.com/AIRP-spec/inference-advocate/pull/28 (draft). Tip `80c604b34db1f65aca9822112ad73e537f645426` — `git ls-remote` MATCH.
