# Task 4: Laya in the reference client (Node, ONNX Runtime)

Brief: `decide/adopt/BRIEF-laya-adoption-2026-10-06.md` (sha256 `59e142801dac5b4312826162af2e28af092f8250e81a536f442812d5e7f1a6f1`), Task 4. Written 2026-10-06 ~04:35 NPT. Run times are converted to NPT (UTC+5:45).

Build: fp32 ONNX for the selected deciding-run checkpoint `ckpt-epoch-1.5-step-5766`. This int8 build failed its gate (INT8-GATE.md: 220/471 composed disagreements against fp32), so the deployment build is fp32.

## Update 2026-10-10: S2c ported into the Node path (follow-up Task 2)

The Node path now runs the same fast build as the Python S2c result in `CPU-SPEED.md`: ORT `session.intra_op.allow_spinning=0`, the padding-free packed graph (`910eec05…`, from `cpu-speed/onnx/5766-fp32-packed`), and the S2c packing. The results below replace the padded-layout numbers in the next section, which are kept as the pre-port record.

1. **Cross-path identity passes after the port: 471/471.** Same 471 held-out v2 items through the Python S2c path (`python_ref.py`, packed layout through the vendored `pack_common.pack_rows`) and the Node path (`LayaLocalEvaluator`), both on the Nepal VPS.
   - Primitives identical **471/471**. Composed verdicts identical **471/471**. Node decode on the Python logits identical 471/471.
   - **The packed feed is covered, not only the logits:** the SHA-256 of all seven feed tensors (`input_ids`, `seg_ids`, `position_ids`, `marker_pos`, `marker_mask`, `row_start`, `qtype`) is equal on **471/471** items. So the Node tokenization, row building, first-fit-decreasing packing, cost-minimising cap, segment and position ids, and flat marker and row-start indices reproduce Python byte for byte.
   - **Max |logit delta| 8.28e-4** (Node onnxruntime-node 1.30.0 against Python onnxruntime 1.22.1). The smallest decision margin is 0.112.
   - The Node packed outputs also match the pre-port padded gate path (VPS Python, padded `0b569403` graph) on primitives and composed verdicts, 471/471, max |logit delta| 8.28e-4.
   - The 71-item CI subset passes 71/71 on the same terms (feed SHA 71/71, max delta 4.8e-4).
2. **Node latency on the Nepal VPS after the port (the users' number), n=471, fp32 5766 packed S2c: median 1078 ms, p95 1237 ms** (mean 1083, min 880, max 1440). Before the port: 2209 / 2604 ms.
   - Setup: Node v22.23.2, onnxruntime-node 1.30.0, @receptron/laya 0.1.2, intraOpNumThreads 8, Xeon Gold 5418Y, 8 vCPU. Median item: 9 bins of capacity 104.
   - Protocol as the Python bench: 20 untimed warm-up items after `load()`'s own warm-up, then every one of the 471 items timed through `evaluate()` (tokenize, build rows, pack, one `session.run`, decode, compose). p95 is nearest rank.
   - The run held `flock /tmp/airp-vps-bench.lock`, so it did not overlap another bench started under the same lock (a second executor was benchmarking on this VPS). Its first loadavg sample (7.49) is the tail of the previous bench's load; the 8-thread run itself accounts for the 6.4 at the end. The lock does not cover a process that does not take it.
   - Python S2c on the same host: 1069 / 1305 ms (encode + run + decode, no compose). Node is within 1% on the median.
   - **The 1-second target is not met at the median** (1078 ms), and all of these inputs are near-empty (median 12 tokens); real-length latency is unknown (follow-up Task 3a).
3. **What changed in the code:** `laya-packed.ts` (pack port and sequence builder), `laya-evaluator.ts` (layout chosen by the pins file; the session option), the packed pins file `laya-5766-fp32-packed.pins.json` (sha `6cca52cf…`), the vendored `pack_common.py` (sha `d199164c…`, pinned in the pins file and checked in CI), feed hashing in both paths, and `compare.mjs`, which fails on any feed hash that differs. The padded layout (the original pins) still works.
   - The sequence builder is a port of `@receptron/laya`'s `buildSequence`, but it tokenizes the response once and builds each question's fixed prefix once at load. Same ids and markers; the feed SHA equality above is the proof.
4. **CI.** The self-hosted-runner patch is withdrawn. `decide/adopt/node/ci-laya-crosspath-hosted.workflow.patch` is the replacement; see "CI" below.

Artifacts: `decide/adopt/node/s2c-vps-*.json`.

## Pre-port results (padded layout, 2026-10-06)

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

The JSON below is the pre-port padded config. For the shipped packed build use `modelSha256` `910eec05…`, pins `laya-5766-fp32-packed.pins.json` and pinsSha256 `6cca52cf…` (`laya-node/evaluator.laya-onnx.example.json`).

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
- **Packed feed, model-free (new):** `crosspath/golden-python-packed-fixed.jsonl` holds, for each of the 71 fixed items, the 17 token rows as Python built them and the SHA-256 of the Python-packed feed. Node `packRows` must reproduce every feed (cap, bins, ids, segment and position ids, marker and row-start indices) byte for byte, and the Node decode on the packed Python logits must reproduce the primitives. I checked that the test bites: packing with the longest-row cap instead of the S2c rule mismatches 50 of the 71 goldens.
- **Live:** `python_ref.py` (laya 0.3.21, onnxruntime 1.22.1; the packed layout uses the vendored `pack_common.py`) and `node_path.mjs` (LayaLocalEvaluator) run on the same items. `compare.mjs` requires identical primitives, identical composed verdicts, and, for the packed layout, identical feed SHA-256 on every item.
  - The packed (shipped) build runs when `AIRP_LAYA_BUNDLE_DIR_PACKED` and `AIRP_LAYA_PYTHON` are set. The padded fallback runs when `AIRP_LAYA_BUNDLE_DIR` is also set.
  - With `AIRP_LAYA_CROSSPATH_REQUIRED=1` a missing packed bundle fails the test instead of skipping.
- **Why the CI set is 71 items, not 471:** the full set takes about 36 minutes for both paths on 8 vCPU.
  - The 71 items are every 8th item in suite order, plus the 12 other items with the smallest Python-path margin. They were chosen from suite order and Python outputs only.
  - The full 471 was run on the VPS, not attempted in CI. It passed. To run all 471 in CI, use `node_path.mjs --ids all` and pass an all-ids file to `python_ref.py`.

## Inference path notes

- @receptron/laya `systemOne` makes **one `session.run` per response**: 17 rows in one padded batch, laid out with laya `build_sequence`. Its row lengths match Python's on every item probed.
- The pinned graph's second output is named `act_logits`, but receptron expects `act_probs`. The session wrapper adds `softmax(act_logits)`; nothing uses it to decide. The ONNX file was not re-exported (its SHA is unchanged).
- Decisions are taken from the raw logits, not from receptron's answers, which are rounded to 4 decimals. A P(true) of 0.49996 would round to 0.5 and fire where Python does not.
- Exact dependency pins: `@receptron/laya` 0.1.2, `onnxruntime-node` 1.30.0 (the Python reference uses ORT 1.22.1; drift ≤ 8.3e-4).

## CI (hosted runner, no self-hosted runner)

The repository is public, so no self-hosted runner is registered: fork code would run on our hardware. `decide/adopt/node/ci-laya-crosspath-hosted.workflow.patch` adds the `laya-crosspath` job to `.github/workflows/ci.yml` on an `ubuntu-latest` runner:

- It downloads the bundle archive from a pinned URL (default: the release asset `laya-5766-fp32-packed-bundle.tar.gz` under tag `laya-5766-fp32-packed`; the repository variable `AIRP_LAYA_BUNDLE_URL` overrides it), caches it by SHA, and checks the SHA-256 (`30ecd3b5cb52fcc471c6f4ea73d659e4533f5e0a4aa3db6871b91d13b57d2c77`) before extracting, on cache hits too. A mismatch fails the job and deletes the file.
- It builds a pinned Python reference environment (torch 2.14.0 CPU, laya 0.3.21, onnxruntime 1.22.1, transformers 4.48.3, numpy 2.2.6, the versions of the VPS venv) and runs `laya-crosspath.test.mjs` with `AIRP_LAYA_CROSSPATH_REQUIRED=1`.
- Triggers: push to main and workflow_dispatch only. The job is skipped on pull_request.
- **Blocked on publishing the bundle.** The archive (994 MB, deterministic: built twice, same SHA, by `laya-node/make-bundle-archive.sh`) exists on the box and the VPS but is not published anywhere. Publishing it is Justin's decision (release asset or other host). Until it is, the job fails at the download step.
- The token that pushes this branch lacks the `workflow` scope, so the workflow file is **not** modified here. Justin applies the patch with a workflow-scoped token: `git apply decide/adopt/node/ci-laya-crosspath-hosted.workflow.patch`. `git apply --check` passes against the branch's `ci.yml`.
- I could not run the job on GitHub from here; the YAML parses and the patch applies, and the Python pins and the torch CPU index resolve (`pip index versions`). The first real run will test the rest.
- **Pending latency picture.** Whether to keep this as a gate on every push to main, or run it nightly, depends on what real-length latency (Task 3a) says about the model we ship. Do not treat the CI note as final.

## Patches

The branch `adopt/laya-node-evaluator` (PR #29) carries the commits. The S2c port is the commit after `08f47db`. Earlier local format-patches are in `decide/adopt/node/patches/`.

## Blockers and caveats

- **The live CI job is blocked on publishing the bundle** (see CI above). Until then, on GitHub only the model-free half runs. No self-hosted runner is needed or registered.
- **Not caused by this work:** at 261aea1, `packages/evaluator-local` tests already fail to compile (`test/prompt-v4.test.ts` TS6059/TS2353). Because of that, root `npm test` stops before the tools tests. I confirmed it on a clean 261aea1 tree.
- The VPS ran commit 413668d. The later commit 44fe226 changes only a test and a log string, so the measured code path is the same.
- Latency after the port is 1078 ms median, still above 1 s, and measured on near-empty inputs.
