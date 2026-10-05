# Step 4 deciding run — pre-training / pre-gating declarations

**Date:** 2026-10-05 (NPT)  
**Brief:** `/workspace/airp/decide/BRIEF-deciding-run-2026-10-05.md` (sha256 `a8b9e451c881ac0a5517b68fea597acfdc4529e31834f2d7f25277a72ed97704`)  
**Purpose:** Lock selection, thresholds, temperature, decision rule, and CSE "converged" definition **before** any training or held-out readout for this deciding comparison. The git commit timestamp on this file is the proof.

This run compares **Laya** (encoder, one-pass) vs **per-primitive Qwen3-0.6B LoRA** on identical training rows, identical group-held-out validation, identical composition, settled proxies, and held-out suites. Justin makes the final call; this document says how the numbers will be chosen and how the rule will be applied.

---

## 1. Inputs (locked)

| Artifact | Value |
|---|---|
| Labels | `primitives-labels-8056-v4.jsonl` sha256 `6399fd4a9b0e33bfbf21d097fc689d50ee9d6dc219db3b16d7dcdef65eb28d36` |
| Corpus | sha256 `712fd64d8829b4482858ef99666356de1e304c38f3a14ce85a3f6e5235aaab74` |
| Split | Laya group-held-out `laya-airp-group-v1` reused by **row id** (not re-randomized): train 7236 / val 819 |
| Split definition sha (sorted train ids + `---` + sorted val ids) | `a1b26aa56cfdc16a27f4869a174666fb6a18f7aa1b55f18ab2e4cd9959fceb45` |
| bnd-05 suite-leak exclusion | corpus id `tr-mention-versus-use-refusal-naming-category-0001` excluded from train and val (unchanged) |
| Composition | `compositions/airp-v0.5.0.json` via shared `@airp/evaluator-local` `compose` |
| Settled proxies | `gold-proxies.v0.5.0.settled.json` sha256 `b086cdac11f8af39b2d3984232ee0372d9ffe909acbd4b8d7fe6d4f653d08455` |
| Qwen prompt bundle | sha256 `f118809a613f6c1fd85b08b61c6810eb3910b30bf034de1146c949c38aa36eb8` (must stay unchanged) |
| Qwen SFT | train rows only (17 × 7236 = 123012), builder `build-sft-per-primitive.mjs`, meta written before train |
| Held-out | suite v2 (471) sha `6c7b30e1…`; historicalSubset v1-207 |

Both models train on the **same** train id set and validate on the **same** val id set. Asserted before training.

---

## 2. Checkpoint selection metric (validation only)

**Metric:** composed-class macro-F1 on the **validation rows only**.

**Computation (identical for both models):**

1. For each validation row, obtain the model's primitives (stance + objects + qualifiers), applying the **primary** thresholds below (default).
2. Compose to a class set with shared `@airp/evaluator-local` `compose` and `compositions/airp-v0.5.0.json`.
3. Gold class set = the row's corpus `expect` array (empty ⇒ no classes).
4. For each of the **eleven** v0.5.0 class types, compute binary F1 over the 819 validation rows (presence/absence of that class in pred vs gold). Skip a class only if it has **zero gold positives and zero predictions** on val (undefined F1); otherwise include it.
5. Macro-F1 = unweighted mean of the per-class F1s that were defined.
6. Select the checkpoint with the **highest** validation composed-class macro-F1.
7. Tie-break (pre-declared): higher validation stance accuracy (argmax vs gold `stance`); if still tied, the **later** checkpoint (higher global step).

**Hard rule:** held-out v2 / v1-207 numbers are **never** used to choose a checkpoint or a threshold mode.

---

## 3. Thresholds

| Mode | Rule | Role |
|---|---|---|
| **Primary (selection + headline)** | Default: 0.5 for every yes/no primitive; **argmax** for stance | Used for checkpoint selection and for the decision-rule extras/misses |
| **Secondary** | Validation-fitted thresholds for both models (per-checkpoint own-val search; primitives with zero val positives keep 0.5) | Reported beside primary; **not** used to select |

Report both modes for every saved checkpoint on v2 and v1-207. Do not pick the mode from held-out results.

---

## 4. Laya temperature scaling

Fit temperature(s) on **validation logits only** (noul and stance separately if the trainpack does), then apply at inference for probability/ECE reporting. Threshold decisions for the primary path still use default 0.5 / argmax on the (possibly temperature-scaled) probabilities unless a secondary fitted-threshold run says otherwise. Temperature is never fitted on held-out.

---

## 5. CSE named gate — definition of "converged" checkpoints

Declared before any held-out CSE readout:

- **Converged** = the last three saved half-epoch checkpoints of each run whose nominal epoch is **≥ 2.0** (i.e. the final three of the planned 0.5-epoch sweep, once training has reached epoch 2).
- If a run saves fewer than three checkpoints at epoch ≥ 2.0, **all** checkpoints at epoch ≥ 2.0 count; if none exist (early abort), the run fails the CSE clause of the decision rule and that fact is reported.
- The CSE named gate is evaluated under **primary (default) thresholds** for this clause of the decision rule. Secondary (fitted) CSE is reported but does not decide the rule.

This matches the prior Qwen/Laya reporting convention of treating the late half-epoch checkpoints as the converged set, but is locked here before seeing this run's held-out numbers.

---

## 6. Decision rule (verbatim from the brief)

> Recommend switching to Laya if all three hold for the selected checkpoints:
> 1. Laya's extras plus recall misses are no more than 5 worse than Qwen's on v2.
> 2. Laya passes the CSE named gate on all converged checkpoints.
> 3. Laya's CPU median is under 1 second per response on the Nepal VPS.
>
> Otherwise recommend staying with per-primitive Qwen. Report which way the rule falls. Justin makes the call.

**Operational reading of clause 1:** let \(L = E_L + M_L\) and \(Q = E_Q + M_Q\) on held-out v2 under primary thresholds for each model's **selected** checkpoint. Need \(L - Q \le 5\).

**Clause 2:** Laya CSE named gate pass on **every** converged Laya checkpoint (definition in §5), primary thresholds.

**Clause 3:** from Step 3 CPU bench on the Nepal VPS (one pass per response); median per item &lt; 1.0 s. If Step 3 is still pending when this report is written, mark CPU pending and do not claim clause 3.

---

## 7. Qwen inference path for this run

Use the **greedy uncapped** path that agreed with scored readout on 99.96–100% of passes in Task 2, through the same LocalEvaluator / node-llama-cpp stack after GGUF export (Q8_0). State the path in the report. Do not use prefix reuse for headline numbers.

---

## 8. Item-level "right" definition (held-out v2 comparison table)

An item is **right** for a model iff the composed class set (after primary thresholds + shared compose) **exactly equals** the gold `expect` set (order-insensitive). Counts: both right / only Qwen right / only Laya right / both wrong.

---

## 9. Training recipes (no HP search)

- **Qwen per-primitive LoRA:** same hyperparameters as the prior per-primitive 8056 run (`sweep-recipe-perprim-v1.json` / STATUS-8056): Qwen3-0.6B, LoRA r=16 α=32 dropout 0.1, 3 epochs, batch 8 / accum 4, lr 1e-4 cosine warmup 0.03, max seq 4096, bf16, packing false, assistant-only loss, seed 20260815, half-epoch checkpoints. Train on the train-only SFT built above.
- **Laya:** same recipe as the clean group-split retrain in Task 1: bf16, NaN hardening in `train_airp.py`, `transformers==4.48.3`, `laya==0.3.21`, `reference_compile=False`, `TORCHDYNAMO_DISABLE=1`, 3 epochs, batch 8 / accum 4, lr encoder 2e-5 / head 1e-4, σ_start 0.25, max_len 1024.

---

## 10. Archive rule

Before terminating any RunPod pod: archive SFT metadata, labels, prompt (bundle sha), validation split definition, thresholds (default + fitted), temperature, **every** checkpoint, and raw per-item outputs to `/root/primitives-evaluator/decide-2026-10-05/step4/` on the Nepal VPS with `MANIFEST.sha256`, then verify remote SHAs. If anything cannot be archived, the pod stays up and `BLOCKED.md` is written.

---

## Commit record

Committed on branch `decide/step4-comparison` **before** RunPod training starts for this deciding run. Record commit hash and author date in the Step 4 report.
