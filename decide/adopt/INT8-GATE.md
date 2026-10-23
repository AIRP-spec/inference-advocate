# Task 2a: int8 ONNX gate (deciding-run Laya checkpoints)

Brief: `decide/adopt/BRIEF-laya-adoption-2026-10-06.md` (sha256 `59e142801dac5b4312826162af2e28af092f8250e81a536f442812d5e7f1a6f1`). Generated 2026-10-06 02:53 NPT.

## Verdict

int8 is NOT the deployment build. composed item-level disagreement is far above a couple of items: 5766=220, 7688=223, 9610=226, 10099=234 CSE named gate fails on int8 for: 5766, 7688, 9610, 10099 Keep fp32 ONNX (or torch) for accuracy; the ~1.2 s int8 CPU figure is not a measured number for a model that answers like fp32 on these deciding-run checkpoints.

## Method

- Weights from deciding-run archive `laya-step4-out.tgz` (sha256 `fa5d8931…`), verified member-for-member against box extract.
- Export: `export_onnx.py` (opset 17, dynamic axes, MHA fastpath off); int8 = `quantize_dynamic` QInt8 MatMul/Gemm.
- Inference: ORT CPU, `ORT_ENABLE_ALL`, intra_op=8, **batched** = one `session.run` with 17 padded question rows (one pass per response).
- Compose/gate: shared `@airp/evaluator-local` via `gate-laya-task1.mjs`, default thresholds. CSE named gate unchanged.
- Do **not** reuse Step 3 int8 gate numbers (those were task1 retrain 9610, different train).

## Per-checkpoint gate (E/M/C = extras / recall misses / clean fires)

| Ckpt | Role | fp32 v2 E/M/C | fp32 v1-207 | fp32 CSE | int8 v2 E/M/C | int8 v1-207 | int8 CSE | composed disagree (of 471) |
|---|---|---|---|---|---|---|---|---|
| 5766 | selected | 16/20/13 | 5/10/4 | PASS | 234/105/49 | 108/41/22 | FAIL (missed=5 extra=41) | **220** |
| 7688 | converged | 41/25/34 | 18/12/16 | PASS | 229/98/72 | 93/39/30 | FAIL (missed=2 extra=32) | **223** |
| 9610 | converged | 35/20/24 | 11/12/9 | PASS | 258/97/56 | 112/48/25 | FAIL (missed=2 extra=40) | **226** |
| 10099 | converged | 37/23/25 | 11/12/9 | PASS | 272/85/65 | 117/33/28 | FAIL (missed=4 extra=36) | **234** |

## Item-level disagreement (fp32 vs int8)

Composed verdict = sorted `got` class set after shared compose. Per-primitive flip = thresholded decision differs (P≥0.5 or stance argmax).

### ckpt-epoch-1.5-step-5766 (selected)
- Composed disagree: **220** / 471 (46.7%)
- Items with any primitive flip: 426; total primitive flips: 1166; max\|Δp\|=1
- Per-primitive flip counts (rate = count/471):

| Primitive | Flips | Rate |
|---|---:|---:|
| addresses_own_nature | 119 | 25.3% |
| violence_person | 95 | 20.2% |
| stance | 90 | 19.1% |
| directed_at_user | 81 | 17.2% |
| is_mention_not_use | 78 | 16.6% |
| targets_protected_characteristic | 77 | 16.3% |
| explicit_register | 70 | 14.9% |
| subject_is_minor | 70 | 14.9% |
| untethered_to_content | 65 | 13.8% |
| self_harm | 63 | 13.4% |
| exceeds_common_knowledge | 59 | 12.5% |
| intrusion | 54 | 11.5% |
| sexual_activity | 51 | 10.8% |
| weapons | 50 | 10.6% |
| asserts_interior_state | 49 | 10.4% |
| profanity | 48 | 10.2% |
| financial_crime | 47 | 10.0% |

### ckpt-epoch-2.0-step-7688 (converged)
- Composed disagree: **223** / 471 (47.3%)
- Items with any primitive flip: 425; total primitive flips: 1120; max\|Δp\|=1
- Per-primitive flip counts (rate = count/471):

| Primitive | Flips | Rate |
|---|---:|---:|
| addresses_own_nature | 115 | 24.4% |
| directed_at_user | 96 | 20.4% |
| explicit_register | 92 | 19.5% |
| is_mention_not_use | 91 | 19.3% |
| violence_person | 86 | 18.3% |
| stance | 82 | 17.4% |
| exceeds_common_knowledge | 62 | 13.2% |
| targets_protected_characteristic | 60 | 12.7% |
| financial_crime | 56 | 11.9% |
| untethered_to_content | 52 | 11.0% |
| asserts_interior_state | 52 | 11.0% |
| self_harm | 50 | 10.6% |
| subject_is_minor | 48 | 10.2% |
| weapons | 48 | 10.2% |
| intrusion | 45 | 9.6% |
| profanity | 44 | 9.3% |
| sexual_activity | 41 | 8.7% |

### ckpt-epoch-2.5-step-9610 (converged)
- Composed disagree: **226** / 471 (48.0%)
- Items with any primitive flip: 430; total primitive flips: 1109; max\|Δp\|=1
- Per-primitive flip counts (rate = count/471):

| Primitive | Flips | Rate |
|---|---:|---:|
| addresses_own_nature | 133 | 28.2% |
| violence_person | 101 | 21.4% |
| stance | 76 | 16.1% |
| directed_at_user | 71 | 15.1% |
| is_mention_not_use | 70 | 14.9% |
| explicit_register | 69 | 14.6% |
| untethered_to_content | 63 | 13.4% |
| intrusion | 58 | 12.3% |
| weapons | 58 | 12.3% |
| profanity | 57 | 12.1% |
| targets_protected_characteristic | 57 | 12.1% |
| asserts_interior_state | 54 | 11.5% |
| subject_is_minor | 51 | 10.8% |
| sexual_activity | 50 | 10.6% |
| financial_crime | 48 | 10.2% |
| self_harm | 47 | 10.0% |
| exceeds_common_knowledge | 46 | 9.8% |

### ckpt-epoch-2.6-step-10099 (converged)
- Composed disagree: **234** / 471 (49.7%)
- Items with any primitive flip: 429; total primitive flips: 1093; max\|Δp\|=1
- Per-primitive flip counts (rate = count/471):

| Primitive | Flips | Rate |
|---|---:|---:|
| addresses_own_nature | 125 | 26.5% |
| violence_person | 93 | 19.7% |
| directed_at_user | 78 | 16.6% |
| is_mention_not_use | 78 | 16.6% |
| targets_protected_characteristic | 71 | 15.1% |
| explicit_register | 69 | 14.6% |
| stance | 65 | 13.8% |
| financial_crime | 59 | 12.5% |
| asserts_interior_state | 59 | 12.5% |
| exceeds_common_knowledge | 57 | 12.1% |
| profanity | 54 | 11.5% |
| sexual_activity | 53 | 11.3% |
| untethered_to_content | 52 | 11.0% |
| weapons | 50 | 10.6% |
| intrusion | 44 | 9.3% |
| subject_is_minor | 44 | 9.3% |
| self_harm | 42 | 8.9% |

## Latency notes

- Accuracy gates in this report used **box** ORT (host `grok-bot-vm`). Box medians below are incidental.
- For CPU speed claims cite **Nepal VPS Step3** one-pass int8 **1209 ms median** / fp32 **2379 ms** (task1-architecture measurement on Xeon Gold 5418Y). That int8 speed does **not** qualify as the deployment number when int8 disagrees with fp32 on deciding-run checkpoints.

### Box CPU latency (batched one-pass, incidental)

| Ckpt | fp32 median / p95 ms | int8 median / p95 ms |
|---|---|---|
| 5766 | 2212 / 2951 | 957 / 1234 |
| 7688 | 2254 / 4709 | 884 / 1157 |
| 9610 | 2151 / 2905 | 867 / 1105 |
| 10099 | 2098 / 2932 | 742 / 949 |

## Paths and SHAs

| Artifact | SHA256 |
|---|---|
| ckpt-epoch-1.5-step-5766 weights `model.safetensors` | `703cabfcd1e51bfe24aee7416d99df7c8f21bb0449e0dda6712179b69fee1cf5` |
| ckpt-epoch-1.5-step-5766 `laya-fp32.onnx` | `0b5694036a20f3093f2cac7c8f6d8569400756e9982a28ccd4070997a522aa8e` |
| ckpt-epoch-1.5-step-5766 `laya-int8-dynamic.onnx` | `4e58214ec923680f3f54efac5ccbac4601bb4b4c4ceb94af8c16682d1b6296c7` |
| ckpt-epoch-2.0-step-7688 weights `model.safetensors` | `64b4054cd9f9ea12097c8df320739d98eab98a32842a0f7912c2c243dab9878d` |
| ckpt-epoch-2.0-step-7688 `laya-fp32.onnx` | `f9383ea793ca652aa6eb4bbcf0f8dab7943ddbe92e1066b28e5b36ca3b13cc2e` |
| ckpt-epoch-2.0-step-7688 `laya-int8-dynamic.onnx` | `69ad13fd6bbe2a71cde2efbea6b825dd9f7a180cd423c70a638b0917d33a3a3c` |
| ckpt-epoch-2.5-step-9610 weights `model.safetensors` | `9d18d3ab5195c2525eb2ec62f6ad80e25b236b2bfe61054f03227d117880000c` |
| ckpt-epoch-2.5-step-9610 `laya-fp32.onnx` | `26bfc57cbae62d125a93bce6dcd8c236ee25b8f00a53635bf3ea92a38088a1ad` |
| ckpt-epoch-2.5-step-9610 `laya-int8-dynamic.onnx` | `6e2c955702f37bc717c52f15b5690311c754dd1a1f13926fe9846c3e4248050b` |
| ckpt-epoch-2.6-step-10099 weights `model.safetensors` | `4104085cff7dad6adf0199508678f0d5cce0cf5ed8fb22da81b983f72b11134d` |
| ckpt-epoch-2.6-step-10099 `laya-fp32.onnx` | `616f9273d37cce8e4dfd6b1ce8badff96822f434c5adb5f5808ba7cecdee9866` |
| ckpt-epoch-2.6-step-10099 `laya-int8-dynamic.onnx` | `27ca6766ebc60a372ce68db565fe061ff24fa015a259e18967b05fe6cf5c7a15` |

Local tree: `/workspace/airp/decide/adopt/int8/`. Archive: `/root/primitives-evaluator/decide-2026-10-06/adopt/int8/` on Nepal VPS with MANIFEST.

