# Laya primitives evaluator in the reference client (Node, ONNX Runtime)

Task 4 of `decide/adopt/BRIEF-laya-adoption-2026-10-06.md` (sha256 `59e14280…`). **Off by default.**

| Config | Evaluator that runs |
|---|---|
| no evaluator config | rule evaluator (unchanged) |
| `kind: "local"`, no `engine` | GGUF live pin, v2.1 (unchanged) |
| `kind: "local"`, `engine: "laya-onnx"` + `laya` block | `LayaLocalEvaluator` (`local-laya`) |

## Config shape

See `evaluator.laya-onnx.example.json`:

```json
{
  "kind": "local",
  "engine": "laya-onnx",
  "modelPath": "<bundle>/laya.onnx",
  "modelSha256": "0b5694036a20f3093f2cac7c8f6d8569400756e9982a28ccd4070997a522aa8e",
  "laya": {
    "pinsPath": "tools/evaluator-training/laya-node/pins/laya-5766-fp32.pins.json",
    "pinsSha256": "b0c9dd23bb71233db4026d6531fa1484c0f8b64b307ac1bd3b7330a911f1edbd",
    "compositionPath": "tools/evaluator-training/primitives/compositions/airp-v0.5.0.json",
    "compositionSha256": "4def0b8fd339713bd261106cb10235949f4bd1bc4e3631a88dd7cc511b0087e0",
    "intraOpNumThreads": 8
  }
}
```

`resolveEvaluator` refuses a laya-onnx config with a missing or malformed pin, or one that also
sets `promptTemplateVersion`, before any file is opened.

## What is pinned (refused on mismatch, before the session opens)

| Pin | Value |
|---|---|
| ONNX graph `laya.onnx` (exported `laya-fp32.onnx`, ckpt-epoch-1.5-step-5766) | `0b5694036a20f3093f2cac7c8f6d8569400756e9982a28ccd4070997a522aa8e` (config **and** pins must agree) |
| checkpoint `model.safetensors` (provenance) | `703cabfcd1e51bfe24aee7416d99df7c8f21bb0449e0dda6712179b69fee1cf5` |
| pins file `laya-5766-fp32.pins.json` | `b0c9dd23bb71233db4026d6531fa1484c0f8b64b307ac1bd3b7330a911f1edbd` |
| question wording `laya-questions.json` (inline in pins, deep-equal checked in CI) | `f519fa8e4763cc95acef3d134f984941c263043bad4abfd2a827c69e560650ee` |
| `laya_config.json` (max_len 1024, head_max_len 256, T=1) | `7de12d5029e6834fa6ce19939380488cf9012e164fe2da91568b23d4075a2ddb` |
| `tokenizer/tokenizer.json` | `6c8aaa9a542084f2457eab775d4eeb51f92a70c0fd9de28d5edb0ddec3c08d30` |
| `tokenizer/tokenizer_config.json` | `2966a59b9e9cf122279aec1249e22e5bc7ad8430c754e95031b13fd128d4e560` |
| composition `airp-v0.5.0.json` | `4def0b8fd339713bd261106cb10235949f4bd1bc4e3631a88dd7cc511b0087e0` |
| temperature | noul 1.0, choice 1.0 (the Python gate path decoded raw logits at T=1) |
| thresholds | primary: 0.5 every yes/no primitive (fires iff P(true) >= 0.5), stance argmax |

int8 is not the deployment build (`decide/adopt/INT8-GATE.md`: 220/471 composed disagreements vs fp32).

## Inference path

`@receptron/laya` 0.1.2 `Laya.load({ modelDir })` + `systemOne(content, questions)` on
`onnxruntime-node` 1.30.0: one session.run per response, 17 question-conditioned rows in one
padded batch (laya `build_sequence` layout). Two adaptations, both in `laya-evaluator.ts`:

1. The pinned graph's second output is `act_logits`; receptron reads `act_probs`. The session
   wrapper adds `act_probs = softmax(act_logits)` (not used for any decision).
2. Decisions come from that pass's raw logits through `layaPrimitivesFromLogits` (pinned T,
   thresholds, stance order), not from systemOne's answers, which are rounded to 4 decimals.

Composition is the shared `compose()` from `@airp/evaluator-local` only. `load()` ends with a
warm-up `evaluate()` on `LOAD_WARMUP_REQUEST` (verdict discarded, observables restored).

## Cross-path test (mandatory)

`tools/evaluator-training/laya-crosspath.test.mjs`, fixed items `crosspath/fixed-items.json`
(71 held-out v2 items: every 8th in suite order + the 12 smallest-margin others).

- Always (main CI job): pin SHAs; the Node decode on the committed Python-path golden logits
  (`crosspath/golden-python-fixed.jsonl`) reproduces the Python primitives and composed verdicts;
  the evaluator refuses model / pins / composition / threshold mismatches.
- Live (job `laya-crosspath`, self-hosted runner with the bundle): `python_ref.py` (the bench_ort
  batched gate path, laya 0.3.21 + onnxruntime 1.22.1) and `node_path.mjs` (LayaLocalEvaluator)
  on the same items; `compare.mjs` requires identical primitives and identical composed verdicts
  on every item.

Assemble a bundle: `node assemble-bundle.mjs --onnx laya-fp32.onnx --tokenizer-dir CKPT/tokenizer --out DIR`.
