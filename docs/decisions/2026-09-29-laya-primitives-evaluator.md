# Laya Primitives Evaluator Fine-Tune Experiment

**Date:** 2026-09-29  
**Status:** DRAFT  
**Branch:** `cursor/feat-laya-primitives-evaluator`  
**Comparison Baseline:** Qwen 8056 per-primitive (CK-6420: 36e/12r, CK-8560: 27e/23r)

## Context

The AIRP local evaluator currently uses Qwen3-1.7B fine-tuned with a per-primitive prompting architecture. This design decision (Decision 11) validated that per-primitive decomposition works, but the generative decoder architecture requires 18 sequential forward passes per evaluation.

Laya (convaiinnovations/laya) is an encoder decision model based on ModernBERT-large. It evaluates a state (assistant response) against multiple questions simultaneously through a shared encoder trunk with per-question classification heads, enabling parallel primitive evaluation. This experiment scaffolds a Laya fine-tune to test whether an encoder decision model can match or exceed Qwen's per-primitive accuracy at reduced computational cost.

## Decision 12: Laya Encoder-Head Fine-Tune for Primitives

**Decision:** Scaffold a Laya fine-tune experiment targeting the same 17-primitive AIRP task, using encoder+heads training and RLCD recipe, to produce a side-by-side comparison against Qwen 8056.

**Status:** DRAFT — scaffolding only, training and evaluation out of scope for this PR

**Rationale:**
- **Parallelism:** Laya evaluates all 17 questions in a single forward pass with shared encoding, versus 18 sequential Qwen passes
- **Architectural fit:** Encoder decision models are designed for typed-choice tasks like primitives
- **Comparison credibility:** One variable = model architecture; labels SHA, composition, suite, and gate thresholds identical
- **Encoder prior:** ModernBERT-large is a strong English encoder; the typed-decisions checkpoint shows 1024 max_len trains cleanly

### Design Constraints (Locked)

1. **Fine-tune encoder + heads** (not heads-only) — full model participates in AIRP task adaptation
2. **Use RLCD recipe** (not plain CE-only SFT) — Laya's published training method
3. **Raise max_len to 1024** for AIRP fine-tune — suite fits in 512 but production replies may not (conservative budget)
4. **Calibration only on Phase 2 val split** — never the held-out suite

### One Variable = Model

**Identical across Qwen and Laya runs:**
- Labels SHA: `5bdae44cd2bc520c56b09b1478c64724cb6fa3b7be0c93a63bc7262a9b9cd282` (8056 merged)
- Composition: `compositions/airp-v0.5.0.json`
- Held-out suite: `data/evaluator-gate/held-out-suite.v2.json` (471 items)
- Gate thresholds: same per-primitive defaults (0.5 unless tuned on val)

**The only difference:**
- Qwen: generative decoder, per-primitive sequential prompts, temperature 0
- Laya: encoder decision model, 17 questions evaluated in parallel, trained with RLCD

### Base Model Pin

**Repo:** `convaiinnovations/laya`  
**Revision:** `55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851`  
**Weights:** `model.safetensors`  
**Weight SHA256:** `891102d372688fc2a094dac56a384bc537b87c63f21f9f3dac0be2b7cbc8d86c`  
**Encoder:** ModernBERT-large  
**Config max_len:** 512 (base); **AIRP fine-tune max_len:** 1024

Rationale for general English `laya` (not `typed-decisions`): AIRP primitives are English safety/moderation judgments (stance + harm objects + qualifiers). The `typed-decisions` checkpoint is a specialist fine-tune on invoice/security-incident/customer-service/agent-trace workflows and its README warns it can behave like base or worse outside those four domains. That domain bleed is the wrong prior for AIRP. The general English checkpoint is the correct starting point.

Raising `max_len` to 1024 at fine-tune time: the 471-item held-out suite fits comfortably in 512 (max state 34 tokens, head overhead ~33-89 tokens per question). However, production assistant replies in AIRP can be longer than suite fixtures. The `typed-decisions` checkpoint already demonstrates that ModernBERT-large Laya trains cleanly at 1024. We adopt 1024 for AIRP from the start rather than inheriting `typed-decisions` weights to avoid its domain-specific prior.

### Pinned Laya Question Bundle

**Decision:** Pin the 17 AIRP primitive questions by SHA-256, identical train and inference, no taxonomy/class definitions in instructions.

**Location:** `tools/evaluator-training/laya/questions.json`  
**Verification:** Unit test asserts sha256 of canonical JSON matches recorded pin

**Structure (17 questions):**
- 1 stance question (`type: "choice"`, 5 criteria)
- 7 object questions (`type: "noul"` binary)
- 9 qualifier questions (`type: "noul"` binary)

**Wording source:** Derived from Phase 0 draft instructions (`LAYA-PHASE0.md` section B), refined for clarity. No prose taxonomies, no counter-examples in instructions. The model learns from labels, not embedded prose.

**Rationale:**
- Question wording is a hyperparameter — pin it by SHA the same way Qwen pinned prompt bundle SHA
- Identical train/infer wording eliminates train/test distribution shift
- No taxonomy prose in instructions: keep question surface small, let RLCD learn from gold answers

### Train/Val Split Strategy

**Decision:** Deterministic stratified split: ~90% train, ~10% val, stratified by stance and key rare positives.

**Phase 2 Split (Completed 2026-09-29):**
- **Seed:** `20260929`
- **Archive:** `airp-laya-8056-split.tgz` (himalogic / Nepal VPS)
- **Archive SHA256:** `186e9fd5675733a8c51d828bbf3799099d10942474af6601cc80e5383d808942`

**Artifacts:**
- `train.jsonl`: 7250 rows, SHA256 `474c8a6029ce6ecab6e0fbf94bdd19ef1c6a8b343578f21bca09172195dda8a1`
- `val.jsonl`: 805 rows, SHA256 `dcb44431d878ad2298a551ebcbb8e753e982bf8cd92e83e2df28c6892f497d17`
- Questions (canonical): SHA256 `a2e7b5b36615e3b720258c1363819e7c976fac64d998e7d19a0899a5d41ef7a7`
- Labels SHA: `5bdae44cd2bc520c56b09b1478c64724cb6fa3b7be0c93a63bc7262a9b9cd282` (8056 merged)
- Corpus SHA: `712fd64d9c0c27e40a92aaa6cf86f8bb84a0385d8df0cbb2d2b473f04aaaaab74`

**Stratification targets:**
- Stance distribution (5 levels)
- Rare positives: `subject_is_minor`, `exceeds_common_knowledge`, `is_mention_not_use` (minority classes with high composition weight)

**Suite leak prevention:** 1 content-hash collision with suite `bnd-05` excluded (documented in `split-meta.json`). No held-out suite ids in train or val.

**Val split purpose:** Threshold tuning and ECE calibration only — **never** for early stopping or hyperparameter search.

### Laya Sample Construction

**State field:** `item["content"]` from corpus (assistant response text)  
**Questions field:** Pinned 17-question bundle  
**Gold answers:**
- Stance: `{"choice": "<stance_value>"}` (one of: describes, depicts, endorses, encourages, conveys_method)
- Objects (7): `{"noul": <bool>}` per primitive
- Qualifiers (9): `{"noul": <bool>}` per primitive

Laya packs each question separately with state: `[CLS] <type> instructions [SEP] [MASK] opts [SEP] state [SEP]`. Questions do **not** multiply sequence length by 17; the encoder trunk is shared.

### Training Recipe (RunPod Scaffold)

**Optimizer:** RLCD (Laya's published recipe, not plain CE-only SFT)  
**Scope:** Encoder + heads (full model fine-tune)  
**Max sequence length:** 1024 (raised from base 512)  
**Checkpointing:** Every 0.5 epoch  
**Archive convention:** `laya-airp-primitives-ckpt-<step>.safetensors`  
**Termination:** Pod terminates after final checkpoint archived

**Scaffold only:** This PR provides recipe JSON and `TRAIN.md`. Actual training execution on RunPod is out of scope (coordinator will launch).

**Dependency:** Upstream Laya fine-tune API (`pip install laya`). If upstream API is unclear from published docs, scaffold a thin wrapper and document exact commands to run on A100.

**CI constraint:** Do **not** require downloading full weights in CI; keep CI unit-level (questions SHA, compose identity, split no-leak).

### Gate Path for Laya

**Decision:** Laya adapter uses the **same shared compose** as existing primitives gate — no dual path.

**Adapter signature:**
```
layaGate(checkpoint_path, suite, questions, thresholds_per_primitive) → gate_report
```

**Flow:**
1. Load Laya checkpoint from local path
2. For each suite item: evaluate 17 questions → primitive vectors (stance + objects + qualifiers)
3. Apply configurable per-primitive thresholds (defaults 0.5; later fitted on val)
4. **Compose via shared compose** (`tools/evaluator-training/primitives/compose.mjs`) — primitives → taxonomy flags
5. Emit same report shape as existing `gate.mjs` (extras, recall misses, per-atom P/R, CSE named gate)

**ECE / Calibration:** Report Expected Calibration Error per primitive on val (and optionally suite, labeled as diagnostic only).

**Identity test (required):** `compose(primitives_from_laya) == compose(primitives_from_qwen)` given identical primitive vectors. This test proves the compose layer is shared and Laya/Qwen differences are model-only.

**Per-primitive thresholds:** Laya outputs probabilities (`noul` in [0,1], `choice` as logits → softmax). Threshold each binary primitive independently. Stance takes argmax over 5 options.

**Integration:** Laya gate script lives under `tools/evaluator-training/laya/gate-laya.mjs`. It imports the shared compose from `primitives/compose.mjs` and produces a report that can be diffed directly against `gate-report-step-*.json` from Qwen runs.

### Side-by-Side Comparison

**Decision:** Pre-fill a comparison table with Qwen 8056 baseline numbers from `STATUS-8056-GATE.md`, leave Laya cells empty for post-training fill.

**Baseline (Run B, Qwen class-trained v0.5.0):** 17 extras / 12 recall  
**Qwen per-prim CK-6420:** 36 extras / 12 recall (eck P 85.3% / R 93.5%)  
**Qwen per-prim CK-8560:** 27 extras / 23 recall (eck P 89.3% / R 80.6%, CSE pass)

**Template:** `tools/evaluator-training/laya/SIDE-BY-SIDE.md`

**Rows to fill after training:**
- Laya CK-<step>: extras / recall / clean-fires
- Per-atom P/R on exceeds_common_knowledge (gold proxy: CA from suite expect)
- CSE named gate (29/0/0 target, from 8560+)
- `subject_is_minor` atom P/R (R=100% target on all CKs)

**Success criteria (post-training):** Laya should match or exceed Qwen 8560 on CSE pass (29/0/0) and approach or improve eck precision while maintaining recall near Qwen 6420 (93.5%). The table is for coordinator judgment, not an automated gate.

## What This PR Does

1. **ADR:** This document (Decision 12)
2. **Pinned questions:** `tools/evaluator-training/laya/questions.json` + SHA unit test
3. **Split tooling:** Script to deterministically split 8056 labels into train/val with stratification
4. **Dataset builder:** Convert labels+corpus → Laya training samples (state, questions, gold answers)
5. **Training recipe:** `tools/evaluator-training/laya/TRAIN.md` + recipe JSON for RunPod
6. **Gate path:** `gate-laya.mjs` adapter using shared compose, with ECE reporting
7. **Comparison template:** `SIDE-BY-SIDE.md` pre-filled with Qwen baseline
8. **Tests:** Questions SHA match, compose identity, split suite-leak prevention

## What This PR Does NOT Do

**Explicitly out of scope:**
- **Phase 5 wiring:** LocalEvaluator default-on Laya path, shipping to tryairp
- **Merging:** This PR remains draft-only
- **Editing held-out suite or gate.json thresholds**
- **Launching RunPod:** Training execution is coordinator responsibility
- **Regenerating corpus:** Uses existing 8056 labels file
- **Touching live tryairp daemon (step-744) or live pin**

## Lessons Learned (to be appended to LESSONS.md if warranted)

**Note for future experiments:** Encoder decision models (like per-primitive generative models) still must pin input format by SHA. The Laya questions bundle is the format pin, analogous to Qwen's prompt bundle SHA. Changing question wording is a breaking change that requires retraining, just as changing a Qwen system prompt would.

## Done When

- Draft PR open with ADR + questions pin + split/builder/gate scaffolding + TRAIN.md + side-by-side template
- Tests pass: questions SHA, compose identity, split no-suite-leak
- PR body states: one variable = model; labels SHA; base pin; comparison target = Qwen 8056 per-prim
- Remote push verified (`git ls-remote`); full branch tip SHA and PR URL reported
- PR marked **DRAFT**
- No merge to main

## Comparison Table Preview (Empty Laya Cells)

| Checkpoint | Model | Extras | Recall | Clean | eck P / R | CSE |
|------------|-------|--------|--------|-------|-----------|-----|
| Run B | Qwen class v0.5.0 | 17 | 12 | — | — | — |
| CK-6420 | Qwen per-prim 8056 | 36 | 12 | 23 | 85.3% / 93.5% | FAIL (2 extra) |
| CK-8560 | Qwen per-prim 8056 | 27 | 23 | 21 | 89.3% / 80.6% | **PASS** (29/0/0) |
| CK-? | **Laya RLCD** | *TBD* | *TBD* | *TBD* | *TBD* | *TBD* |

Full side-by-side will be populated in `SIDE-BY-SIDE.md` after training completes.
