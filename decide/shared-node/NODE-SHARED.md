# Task 4: shared-encoding primitives model in the reference client (Node, ONNX Runtime)

Brief: Justin's 2026-10-13 brief (`decide/shared-adopt/BRIEF-2026-10-13.md`), Task 4. Weights: run A, epoch 2.5, step 570 (the adopted checkpoint; 3b `REPORT-3b.md`). Step 7 of the task (repeat identity and latency on the final two-seed weights) is still to do. The architecture is fixed, so that rerun only needs a new pins file and bundle. All times below are UTC; NPT = UTC+5:45. Runs: 2026-10-13 02:32–02:36Z (08:17–08:21 NPT).

## Results

1. **The cross-path identity test passes on all 471 held-out v2 items.** It compares the Python gate path (3b `onnx_raw.py` / `bench_shared.py`: laya 0.3.21 tokenization, onnxruntime 1.22.1) with the shipped Node path (`LayaSharedLocalEvaluator.evaluate()`: onnxruntime-node 1.30.0, @huggingface/tokenizers 0.2.0). Both ran on the same host, the Nepal VPS `himalogic`.
   - Primitives identical 471/471. Composed verdicts identical 471/471. The Node decode applied to the Python logits matches 471/471.
   - **Input feeds identical 471/471**: SHA-256 over `input_ids` (dims plus little-endian int64), computed independently on each side.
   - **Max |logit difference| 1.69e-4. Smallest Python-path decision margin 0.0509** (`ho2b-hate-pos-01`, `targets_protected_characteristic`), so the margin is about 300 times the observed drift.
   - The Node primitives also equal the 3b gate's own per-item record (torch fp32, `offline/primary/A-ckpt-epoch-2.5-step-570/heldout-primitives.jsonl`) on 471/471. So the Node path reproduces **v2 17/19/13, v1-207 5/8/4, CSE PASS** item for item.
   - Rep 2 Node run: the same primitives and feeds as rep 1 on 471/471.
   - CI fixed set (71 items: every 8th item plus the 12 lowest-margin others): live test 6/6 pass on the VPS with `AIRP_LAYA_CROSSPATH_REQUIRED=1`.
2. **Node latency on the Nepal VPS** (Xeon Gold 5418Y, 8 vCPU, Node v22.23.2, intraOpNumThreads 8, inter 1, sequential, allow_spinning 0, batch 1, no padding). Per-item time is the wall time of `evaluate()`: tokenize + one `session.run` + decode + compose. Warm-up: `load()` warm-up, then 20 untimed suite items, then 2 untimed items per bucket. n = 20 per bucket, p95 nearest rank, ms:

| Bucket | Node r1 median / p95 | Node r2 median / p95 | Python 3b r1 (REPORT-3b) | Gate: median < 1000 ms at 500 |
|---|---|---|---|---|
| ~50 | 98 / 116 | 98 / 130 | 102 / 123 | |
| ~200 | 267 / 279 | 250 / 275 | 246 / 287 | |
| **~500** | **642 / 701** | **614 / 648** | 645 / 716 | **MET** (642 ms, 36% headroom; worst item 717 ms) |
| ~1000 | 1,378 / 1,603 | 1,401 / 1,681 | 1,427 / 1,616 | (over 1 s; not gated) |
| short suite (471) | 45.7 / 60.7 | 45.6 / 59.6 | 46 / 62 (Python, this job: 45.4 / 62.3) | |

   - **The ship gate "CPU median < 1000 ms at the 500-token bucket on the Nepal VPS, measured in Node" is met:** 642 ms in r1, 614 ms in r2. All 20 items at 500 tokens finished under 1 s; the slowest was 717 ms.
   - The 1000-token bucket is above 1 s (median 1.4 s). Truncation is as in 3b: the response is cut at 1022 tokens, so 6 of 20 items lose a tail (up to 47 tokens). No held-out item is truncated (the longest feed is 36 tokens).
   - **Memory:** Node process RSS was 2.5 GB on the suite and 2.9 GB after the 1000-token bucket. That is far under the 9 GB cgroup cap every run used (`systemd-run MemoryMax=9G`). The VPS has 15 GiB and production was running (about 2.7 GiB used at idle). Load: SHA verification of the 1.7 GB graph 1.4 s, session open 3.8 s, warm-up 43 ms.
   - **Noise:** each timed step held `flock /tmp/airp-vps-bench.lock` and ran under `nice -n 10`. The lock was free when requested. The load average rose from 0.9 to 4.9 over the job, which is this job's own 8 threads. No other bench overlapped.

## Config shape (default off)

| Config | Evaluator |
|---|---|
| none | rule evaluator (unchanged fallback) |
| `kind:"local"`, no `engine` | GGUF live pin v2.1 (unchanged) |
| `kind:"local", engine:"laya-onnx"` + `laya{}` | Laya 5766 (`local-laya`, PR #29) |
| `kind:"local", engine:"laya-shared-onnx"` + `laya{}` | **shared-encoding model** (`local-laya-shared`, this PR) |

```json
{ "kind": "local", "engine": "laya-shared-onnx",
  "modelPath": "<bundle>/laya-shared.onnx",
  "modelSha256": "dadee217c626ee46794cd80d6f440ce181d7d38675a0326aeab0eb473c29ab5f",
  "laya": { "pinsPath": "tools/evaluator-training/laya-shared-node/pins/laya-shared-A570-fp32.pins.json",
            "pinsSha256": "006546c6951771f6219cb0fba50d2f8050461ff83f1b414996b191e05a068793",
            "compositionPath": "tools/evaluator-training/primitives/compositions/airp-v0.5.0.json",
            "compositionSha256": "4def0b8fd339713bd261106cb10235949f4bd1bc4e3631a88dd7cc511b0087e0",
            "intraOpNumThreads": 8 } }
```

Bundle directory: `laya-shared.onnx` (the 3b export `shared-ckpt-epoch-2.5-step-570-fp32.onnx`, renamed only), `shared_config.json`, `tokenizer/{tokenizer.json, tokenizer_config.json, special_tokens_map.json}`.

## Pins (refused on mismatch, before any session opens)

Pins file `laya-shared-A570-fp32.pins.json`, **sha256 `006546c6951771f6219cb0fba50d2f8050461ff83f1b414996b191e05a068793`**:

| Pinned | Value |
|---|---|
| ONNX weights (fp32, one encoder pass + 17 heads, `input_ids [1,L]` → `logits [1,17,5]`) | `dadee217c626ee46794cd80d6f440ce181d7d38675a0326aeab0eb473c29ab5f` |
| torch checkpoint `model.safetensors` (provenance) | `95d1c4124477d27342b202f47f777fba449fb2cbf8d6d14747d9c84fd65f5120` |
| heads: `shared_config.json` (head order = graph output rows, widths, max_len 1024, input format) | `ccacd35480bdd71d6e5b833dd296212848d167a30000f689468e81d3e207cb03` |
| tokenizer.json / tokenizer_config.json / special_tokens_map.json | `6c8aaa9a…` / `2966a59b…` / `ea97ecdb…` (same files as Laya 5766) |
| temperature | T = 1 (noul and stance; 3b primary mode; the fitted 3.94 / 4.50 are not used) |
| thresholds | 0.5 for all 16 yes/no primitives (fires iff P(true) ≥ 0.5); stance argmax |
| questions the heads were trained on (provenance; not fed) | `f519fa8e…` |
| composition airp-v0.5.0 | `4def0b8f…` |
| ORT | allow_spinning = 0 (required by the pins validator) |

Refusals are tested model-free: wrong graph on disk, pins edited without updating the config SHA, config/pins model mismatch, composition mismatch, wrong file name, swapped tokenizer file, missing threshold, spinning not pinned off, and `shared_config.json` head order differing from the pins.

## Inference path

- `[CLS] response [SEP]`. The response is the request `content` with `[MASK]` replaced by a space, tokenized without special tokens and cut to its first 1022 tokens. This is the same function as 3b `common_shared.encode_response`, and the feed SHAs prove it on every item.
- One `session.run` per response, batch 1, exact length: nothing is padded and no attention mask is fed (the graph takes `input_ids` only).
- The output row order is the pinned head order (alphabetical qids, stance at row 11). The decode reads each head's first `width` logits, never the padding columns.
- The decode is `layaPrimitivesFromLogits`, the function the Laya path and the cross-path test already use. Only its parameter type was narrowed to the five fields it reads. Composition goes through the shared `compose()`.
- Engine `laya-shared-onnx` imports onnxruntime-node and @huggingface/tokenizers dynamically, only when a config names it. New explicit dependency: `@huggingface/tokenizers` 0.2.0, already in the lockfile as @receptron/laya's dependency.

## Branch and tests

- Branch `adopt/shared-node-evaluator`, stacked on `decide/shared-encoding-3b` (#30, f7c9a97), with PR #29 (`adopt/laya-node-evaluator` a718ff5) merged in. The Node evaluator scaffolding this builds on (pins checks, compose, crosspath compare) lives in #29, which is not in #30. So the PR diff against #30 includes #29's changes; review #29 first.
- New: `packages/evaluator-local/src/laya-shared-evaluator.ts`; `tools/evaluator-training/laya-shared-node/` (pins, `crosspath/python_ref_shared.py`, `crosspath/node_path_shared.mjs`, fixed items, Python goldens, `vps_shared_node.sh`); `tools/evaluator-training/laya-shared-crosspath.test.mjs`. The compare step reuses #29's `laya-node/crosspath/compare.mjs` unchanged.
- Changed: `LOCAL_ENGINES` gains `laya-shared-onnx`, which uses the same `laya` validation as `laya-onnx`, with error messages naming the engine; `createOnDeviceEvaluator` dispatch; index exports.
- **The live default is unchanged.** No config gives the rule evaluator, and `engine` omitted gives the GGUF pin. Core tests 146/146 pass on the VPS (Node 22).
- The model-free shared test passes 5/5 everywhere; the live test passes 6/6 on the VPS. #29's laya test: 7 pass, 2 live skipped.
- **Not caused by this work (as in #29):** `packages/evaluator-local` tests do not compile (`test/prompt-v4.test.ts` TS6059/TS2353), and on Node 20 core tests fail for lack of `node:sqlite`.
- No workflow file was changed. Adding the live shared test to the self-hosted CI job is the same open question as #29's (no self-hosted runner exists).

## Caveats

- These are the run A weights. Task 4 step 7 reruns identity and latency on the two-seed selection: new pins (ONNX, shared_config, safetensors SHAs), `vps_shared_node.sh <tag> python,suite,lengths` with `B=` and `PINS=` set, then the same compare.
- The latency inputs are the 3a pinned set (unlabelled, benign), so accuracy and latency come from different inputs, as in 3a/3b.
- ORT versions differ between paths (Python 1.22.1, Node 1.30.0). That difference is the measured drift, at most 1.69e-4.
- The self_harm regression and CSE ship gates belong to Task 3 and are not measured here.

## Archive

VPS `/root/primitives-evaluator/decide-2026-10-13/shared-node/` with `MANIFEST.sha256` (remote `sha256sum -c` verified). It holds the repo tarballs of the measured commits, the bundle (the ONNX is a hard link to the 3b archive copy, same SHA), the pinned length set, all runs (Python and Node per-item JSONL, summaries, compare reports), logs, and this file.
