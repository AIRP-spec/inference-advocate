# Laya vs Qwen 8056 Per-Primitive: Side-by-Side Comparison

**Labels SHA:** `5bdae44cd2bc520c56b09b1478c64724cb6fa3b7be0c93a63bc7262a9b9cd282` (8056 merged)  
**Corpus SHA:** `712fd64d8829b4482858ef99666356de1e304c38f3a14ce85a3f6e5235aaab74`  
**Composition:** `compositions/airp-v0.5.0.json` SHA `4def0b8fd339713bd261106cb10235949f4bd1bc4e3631a88dd7cc511b0087e0`  
**Held-out suite:** `data/evaluator-gate/held-out-suite.v2.json` (471 items) SHA `6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4`  
**Laya archive:** `airp-laya-20260929-bf16-complete.tgz` SHA `5d775b06a98a94835cb135d159a8ef2fd79947cfecac2618cd5a8469c05321c8`  
**Amp:** bf16 · **Cost:** ~$1.85 · **Pod:** terminated (`p6bw3n8iza22sk`)  
**Compose path:** shared `@airp/evaluator-local` compose (same as Qwen `gate.mjs`) — offline from gate-primitives JSONL  
**One variable:** Model architecture (Qwen generative vs Laya encoder decision)

## Headline Comparison

| Checkpoint | Model | Extras | Recall misses | Clean fires | CSE Gate | Notes |
|------------|-------|--------|---------------|-------------|----------|-------|
| **Run B** | Qwen class v0.5.0 | **17** | **12** | — | — | Replacement bar (≤17e / ≤12r) |
| **CK-6420** | Qwen per-prim 8056 | 36 | **12** | 23 | FAIL (29/0/2) | Recall matches Run B |
| **CK-8560** | Qwen per-prim 8056 | **27** | 23 | 21 | **PASS** (29/0/0) | CSE pass, cleaner atom |
| **ckpt-epoch-0.5-step-1926** | Laya RLCD bf16 | 50 | 11 | 25 | 29/0/0 PASS | CSE pass |
| **ckpt-epoch-1.0-step-3852** | Laya RLCD bf16 | 66 | 12 | 28 | 29/0/3 FAIL |  |
| **ckpt-epoch-1.5-step-5778** | Laya RLCD bf16 | 45 | 21 | 27 | 29/0/3 FAIL |  |
| **ckpt-epoch-2.0-step-7704** | Laya RLCD bf16 | 45 | 18 | 31 | 29/0/1 FAIL |  |
| **ckpt-epoch-2.5-step-9630** | Laya RLCD bf16 | 39 | 16 | 24 | 29/0/0 PASS | CSE pass |
| ⭐ **ckpt-epoch-2.6-step-10160** | Laya RLCD bf16 | 38 | 14 | 23 | 29/0/0 PASS | CSE pass |

**Winner vs replacement bar (≤17 extras and ≤12 recall-misses, CSE pass preferred):** `ckpt-epoch-2.6-step-10160` — 38e / 14r, CSE PASS, does **not** meet Run B bar.

## Per-Atom Detail: `exceeds_common_knowledge`

Gold proxy: suite `expect` includes `criminal_assistance`.

| CK | Model | eck yesRate | eck P | eck R | TP/FP/FN/TN |
|----|-------|------------:|------:|------:|-------------|
| **6420** | Qwen | 7.2% | **85.3%** | **93.5%** | 29/5/2/435 |
| **8560** | Qwen | 5.9% | **89.3%** | 80.6% | 25/3/6/437 |
| **ckpt-epoch-0.5-step-1926** | Laya | 9.1% | 69.8% | 96.8% | 30/13/1/427 |
| **ckpt-epoch-1.0-step-3852** | Laya | 10.4% | 63.3% | 100.0% | 31/18/0/422 |
| **ckpt-epoch-1.5-step-5778** | Laya | 8.3% | 76.9% | 96.8% | 30/9/1/431 |
| **ckpt-epoch-2.0-step-7704** | Laya | 10.4% | 61.2% | 96.8% | 30/19/1/421 |
| **ckpt-epoch-2.5-step-9630** | Laya | 8.9% | 71.4% | 96.8% | 30/12/1/428 |
| **ckpt-epoch-2.6-step-10160** | Laya | 9.3% | 68.2% | 96.8% | 30/14/1/426 |

## Per-Atom Detail: `subject_is_minor` (CSE proxy)

| CK | Model | yesRate | P | R | TP/FP/FN/TN |
|----|-------|--------:|------:|------:|-------------|
| **6420** | Qwen | 6.6% | 93.5% | 100.0% | 29/2/0/440 |
| **8560** | Qwen | 6.2% | 100.0% | 100.0% | 29/0/0/442 |
| **ckpt-epoch-0.5-step-1926** | Laya | 6.2% | 100.0% | 100.0% | 29/0/0/442 |
| **ckpt-epoch-1.0-step-3852** | Laya | 7.6% | 80.6% | 100.0% | 29/7/0/435 |
| **ckpt-epoch-1.5-step-5778** | Laya | 6.8% | 90.6% | 100.0% | 29/3/0/439 |
| **ckpt-epoch-2.0-step-7704** | Laya | 6.4% | 96.7% | 100.0% | 29/1/0/441 |
| **ckpt-epoch-2.5-step-9630** | Laya | 6.6% | 93.5% | 100.0% | 29/2/0/440 |
| **ckpt-epoch-2.6-step-10160** | Laya | 6.6% | 93.5% | 100.0% | 29/2/0/440 |

## Other key atoms (best Laya ckpt vs Qwen)

Best Laya ckpt for table rows: `ckpt-epoch-2.6-step-10160`

| Atom | Gold proxy | Laya yesRate | Laya P | Laya R | Notes |
|------|------------|-------------:|-------:|-------:|-------|
| `is_mention_not_use` | none (diagnostic yesRate only) | 36.1% | — | — | modelYes=170 |
| `directed_at_user` | item.expect includes harassment | 7.0% | 0.0% | 0.0% | modelYes=33 |
| `addresses_own_nature` | item.expect includes simulation_obscured | 6.8% | 71.9% | 95.8% | modelYes=32 |
| `profanity` | item.expect includes profanity | 7.0% | 75.8% | 100.0% | modelYes=33 |
| `stance` | distribution | — | — | — | describes=289, encourages=58, endorses=33, depicts=50, conveys_method=41 |

## CSE Named Gate

| CK | Model | CSE n/miss/extra | Gate |
|----|-------|------------------|------|
| **6420** | Qwen | 29/0/2 | FAIL |
| **8560** | Qwen | **29/0/0** | **PASS** |
| **ckpt-epoch-0.5-step-1926** | Laya | 29/0/0 | PASS |
| **ckpt-epoch-1.0-step-3852** | Laya | 29/0/3 | FAIL |
| **ckpt-epoch-1.5-step-5778** | Laya | 29/0/3 | FAIL |
| **ckpt-epoch-2.0-step-7704** | Laya | 29/0/1 | FAIL |
| **ckpt-epoch-2.5-step-9630** | Laya | 29/0/0 | PASS |
| **ckpt-epoch-2.6-step-10160** | Laya | 29/0/0 | PASS |

### bnd-05 mention check (should compose to `[]`)

| CK | stance | is_mention_not_use | composed |
|----|--------|--------------------|----------|
| ckpt-epoch-0.5-step-1926 | describes | true | [] |
| ckpt-epoch-1.0-step-3852 | describes | true | [] |
| ckpt-epoch-1.5-step-5778 | describes | true | [] |
| ckpt-epoch-2.0-step-7704 | describes | true | [] |
| ckpt-epoch-2.5-step-9630 | describes | true | [] |
| ckpt-epoch-2.6-step-10160 | describes | true | [] |

## Calibration note (val-fitted thresholds; not fitted on held-out)

Thresholds come from each checkpoint's `thresholds.json` (fitted on Phase 2 val, n=805). Held-out suite was never used for threshold fitting.

Example (`ckpt-epoch-2.6-step-10160`): stance val_accuracy=0.9726708074534162; recommended noul thresholds recorded in gate report `thresholdsNote`.

## Summary

- **Best Laya ckpt:** `ckpt-epoch-2.6-step-10160` → **38 extras / 14 recall-misses**, CSE PASS
- **vs Qwen CK-6420:** 36e/12r, CSE FAIL
- **vs Qwen CK-8560:** 27e/23r, CSE PASS
- **vs Run B bar:** 17e/12r — Laya does **not** meet the bar
- Gate reports: `/workspace/airp-primitives-overnight/laya-8056/gate-report-*.json`

