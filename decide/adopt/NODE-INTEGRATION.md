# Task 4: Laya in the reference client (Node, ONNX Runtime)

Brief: `decide/adopt/BRIEF-laya-adoption-2026-10-06.md` (sha256 `59e142801dac5b4312826162af2e28af092f8250e81a536f442812d5e7f1a6f1`), Task 4. Written 2026-10-06 ~04:35 NPT. Run times are converted to NPT (UTC+5:45).

Build: fp32 ONNX for the selected deciding-run checkpoint `ckpt-epoch-1.5-step-5766`. int8 is not the deployment build (INT8-GATE.md: 220/471 composed disagreements against fp32).

## Results

1. **The cross-path identity test passes.** On **all 471** held-out v2 items, the Python gate path and the shipped Node path give identical primitives and identical composed verdicts on every item. Both paths ran on the same host (Nepal VPS `himalogic`).
   - Primitives identical 471/471. Composed verdicts identical 471/471. The Node decode applied to the Python logits also matches 471/471.
   - Max |logit difference| between the paths is 8.3e-4. The smallest decision margin on the Python path is 0.112, so the gap to the nearest decision is about 135 times the observed drift.
   - The Node outputs also match the fp32 gate's own `perItem` record (the run that produced 16/20/13) with 0 mismatches. So the Node path reproduces **16/20/13, v1-207 5/10/4, CSE PASS** item for item.
   - The CI fixed set is a 71-item subset. It passed 71/71 on the box, once through the live CI test harness itself and once through a standalone compare.
2. **Node latency on the Nepal VPS (the users' number), n=471, fp32 5766:** **median 2209 ms, p95 2604 ms** (mean 2239, min 1644, max 2868).
   - Setup: Node v22.23.2, onnxruntime-node 1.30.0, @receptron/laya 0.1.2, intraOpNumThreads 8, on a Xeon Gold 5418Y with 8 vCPU.
   - Each item is timed through `evaluate()` after `load()`'s warm-up. The time covers tokenizing, building the 17 rows, one `session.run`, decoding and composing.
   - The run was 03:54–04:12 NPT. A load monitor sampled every 15 s during both runs: no other benchmark was running in any of the 144 samples.
   - For comparison, the Python path on the same host in the same job measured median 2270 ms and p95 2657 ms. That time covers encode and run, without decode.
   - The Step 3 figure of 2379 ms was measured on a different checkpoint (9610).
   - The 1-second deployment target is not met.

## Config shape (default off)

| Config | Evaluator |
|---|---|
| none | rule evaluator (unchanged fallback) |
| `kind:"local"`, no `engine` | GGUF live pin v2.1 (unchanged) |
| `kind:"local", engine:"laya-onnx"` + `laya{}` | `LayaLocalEvaluator` (`local-laya`) |

```json
{ "kind": "local", "engine": "laya-onnx",
  "modelPath": "<bundle>/laya.onnx",
  "modelSha256": "0b5694036a20f3093f2cac7c8f6d8569400756e9982a28ccd4070997a522aa8e",
  "laya": { "pinsPath": "tools/evaluator-training/laya-node/pins/laya-5766-fp32.pins.json",
            "pinsSha256": "b0c9dd23bb71233db4026d6531fa1484c0f8b64b307ac1bd3b7330a911f1edbd",
            "compositionPath": "tools/evaluator-training/primitives/compositions/airp-v0.5.0.json",
            "compositionSha256": "4def0b8fd339713bd261106cb10235949f4bd1bc4e3631a88dd7cc511b0087e0",
            "intraOpNumThreads": 8 } }
```

## Requirements check

| Requirement | How it is met | Evidence |
|---|---|---|
| modelSha256 enforced, refuse on mismatch | `verifyModelSha256` runs before the session opens. The config and the pins file must name the same SHA. | Test `laya evaluator refuses…` covers four refusal cases. Test `engine dispatch` shows `createOnDeviceEvaluator` rejecting a fake `laya.onnx`. |
| Temperature, thresholds and question wording pinned by SHA | The pins file is pinned by SHA in the config. It holds T=1/1, 0.5 thresholds with stance argmax, the 17 question definitions inline (deep-equal to `laya-questions.json` f519fa8e…), max_len and head_max_len, and the SHAs of laya_config and the tokenizer files. | An edited pins file is refused. A missing threshold is refused. |
| Warm-up at the end of load() | `warmAtLoad` runs `evaluate(LOAD_WARMUP_REQUEST)`, discards the verdict and restores the observables. | VPS warm-up 1777 ms; load 7.0 s; SHA verify 2.1 s |
| Composition through the shared compose only | `compose()` from `compose-primitives.ts`. The Python path emits primitives only, so both paths' verdicts come from the same compose. | `compare.mjs` |
| Rule evaluator stays the fallback when config is unset | `resolveEvaluator` is unchanged for a missing config. Laya and ORT are imported dynamically, only when `engine` is `laya-onnx`. | Core test `no evaluator config resolves to the rule evaluator…` |
| Mandatory CI cross-path test | See below | |

### Cross-path test

The test is `tools/evaluator-training/laya-crosspath.test.mjs`, run by the root `npm test` glob, with scripts in `tools/evaluator-training/laya-node/crosspath/`.

- **Always runs (model-free):**
  - The pin SHAs are checked.
  - The Node decode is applied to the committed Python-path golden logits for the 71 fixed items and must reproduce the Python primitives and composed verdicts. Those golden outputs equal the gate's `perItem` record.
  - The refusal cases and engine dispatch are tested.
- **Live:** `python_ref.py` (the batched `bench_ort.py` path: laya 0.3.21 and onnxruntime 1.22.1) and `node_path.mjs` (LayaLocalEvaluator) run on the same items. `compare.mjs` then requires identity item by item.
  - It runs when `AIRP_LAYA_BUNDLE_DIR` and `AIRP_LAYA_PYTHON` are set.
  - The new CI job `laya-crosspath` (self-hosted, label `laya-bundle`) sets `AIRP_LAYA_CROSSPATH_REQUIRED=1`. A missing bundle then fails the job instead of skipping. I checked that it fails.
- **Why the CI set is 71 items, not 471:** the full set takes about 36 minutes for both paths on 8 vCPU.
  - The 71 items are every 8th item in suite order, plus the 12 other items with the smallest Python-path margin. They were chosen from suite order and Python outputs only.
  - The full 471 was run on the VPS, not attempted in CI. It passed. To run all 471 in CI, use `node_path.mjs --ids all` and pass an all-ids file to `python_ref.py`.

## Inference path notes

- @receptron/laya `systemOne` makes **one `session.run` per response**: 17 rows in one padded batch, laid out with laya `build_sequence`. Its row lengths match Python's on every item probed.
- The pinned graph's second output is named `act_logits`, but receptron expects `act_probs`. The session wrapper adds `softmax(act_logits)`; nothing uses it to decide. The ONNX file was not re-exported (its SHA is unchanged).
- Decisions are taken from the raw logits, not from receptron's answers, which are rounded to 4 decimals. A P(true) of 0.49996 would round to 0.5 and fire where Python does not.
- Exact dependency pins: `@receptron/laya` 0.1.2, `onnxruntime-node` 1.30.0 (the Python reference uses ORT 1.22.1; drift ≤ 8.3e-4).

## Patches (local branch `adopt/laya-node-evaluator` from 261aea1; not pushed)

See `decide/adopt/node/patches/`.

## Blockers and caveats

- **The CI live job needs a self-hosted runner** with the 1.7 GB bundle and the Python env (repository variables `AIRP_LAYA_BUNDLE_DIR` and `AIRP_LAYA_PYTHON`). None exists yet. On GitHub-hosted CI, only the model-free half runs. Justin needs to register a runner, for example the VPS. I did not register one.
- **Not caused by this work:** at 261aea1, `packages/evaluator-local` tests already fail to compile (`test/prompt-v4.test.ts` TS6059/TS2353). Because of that, root `npm test` stops before the tools tests. I confirmed it on a clean 261aea1 tree.
- The VPS ran commit 413668d. The later commit 44fe226 changes only a test and a log string, so the measured code path is the same.
- Latency is still about 2.2× the 1 s target. That belongs to Task 3.
