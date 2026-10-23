# Task 2b: one pass per response, confirmed from the code that ran

Brief: `decide/adopt/BRIEF-laya-adoption-2026-10-06.md` (sha256 `59e142801dac5b4312826162af2e28af092f8250e81a536f442812d5e7f1a6f1`), Task 2b. Checked 2026-10-06 ~01:00 NPT. Times below are NPT (UTC+5:45); log stamps ending in `Z` are UTC and are converted.

## Verdict

**One pass per response. No re-measurement needed.**

Both CPU figures (the new 2379 ms and the old 2236 ms) come from code that makes **one forward call per response**. That call is a single batch of **17 question-conditioned rows**, one row per primitive, padded to the longest row. The code never makes one forward call per primitive in the timed path.

For Laya this is the legitimate meaning of "one pass". Laya puts the question inside the bidirectional encoder input, so each primitive needs its own encoder row: the response's hidden states depend on the question. Encoding the response once and answering all 17 primitives from that one encoding is not possible with this checkpoint. It would need a different architecture and a retrain.

CPU-LATENCY.md §1.2 sketched this verdict. The trace below checks it against the scripts by SHA, on the box and on the Nepal VPS (`himalogic`, read-only `sha256sum` and `cat` over SSH; nothing was changed or run on the VPS).

## A. The 2379 ms figure (fp32 ONNX, ckpt-epoch-2.5-step-9610, n=471)

### A.1 Which code ran (identity by SHA)

| File | Box sha256 | VPS copy (`/root/primitives-evaluator/decide-2026-10-05/cpu-bench/`) |
|---|---|---|
| `decide/step3/scripts/bench_ort.py` | `9c05104441504590ff48ad12a0a01b588859696db10b04e03b6b9e3586a38b7c` | `scripts/bench_ort.py`: same; VPS `MANIFEST.sha256` line 92 |
| `decide/step3/scripts/laya_onnx_common.py` | `52ca0a687bf5aef712f6a505dca64d58882c500f776d3c90801ddc7235a16f0e` | `scripts/laya_onnx_common.py`: same |
| `decide/step3/scripts/run_vps_bench.sh` | `414da9295bee84624e23b0fdd7dbb34412ca5bfdd4bc77d43bf58f786683db8d` | `scripts/run_vps_bench.sh` and `box-side/scripts/run_vps_bench.sh`: same; MANIFEST lines 96 and 58 |
| laya 0.3.21 `agent.py` / `common.py` (encoder helpers imported by `laya_onnx_common.py`) | `cd941661…` / `93581762…` | `venv/lib/python3.12/site-packages/laya/`: same |
| run log `decide/step3/logs/vps-run-9610.log` | `e4ae2b0096b55d3b53110f7a09cf1ccfdc10f835074fd84e9e55418dc483a6fc` | `logs-run-9610.log`: same |
| result `vps/results/bench-ckpt-epoch-2.5-step-9610-fp32-batched.json` | `78da20570f984707dcfbc1b089b3af54be339bf6304da25357ebeef7752e2a71` | `results/…-fp32-batched.json`: same |
| model `laya-fp32.onnx` | `3b0dae5db2367376815725aa5c35159a89447306aca466ea85b89fe99c7829d5` | checked by `bench_ort.py` line 39 before timing |

### A.2 Invocation (`run_vps_bench.sh`)

The phase loop passes the phase name as `--mode`. The `batched` phase ran first.

```bash
 8  CK=${1:-ckpt-epoch-2.5-step-9610}; PHASES=${2:-"batched perq probe"}
17  for ph in $PHASES; do
18   for prec in fp32 int8-dynamic; do
24    nice -n 10 $PY -u bench_ort.py --ckpt $B/ckpt/$CK --model $M --expect-sha ${SHA[laya-$prec.onnx]} --suite $S --questions $Q --out $B/results/bench-$L.json --raw-out $B/raw/$L.jsonl --label $L --mode $ph --threads 8 --warmup 20 2>&1 | grep -v Warning
```

Run log, `vps-run-9610.log`:

```
10: START ckpt-epoch-2.5-step-9610-fp32-batched 2026-10-05T09:47:37Z load 0.16 0.06 0.01 ...   (15:32:37 NPT)
22: END ckpt-epoch-2.5-step-9610-fp32-batched exit 0 2026-10-05T10:07:21Z ...                  (15:52:21 NPT)
```

### A.3 The timed call (`bench_ort.py`)

```python
49      def run_item(content):
50          t0 = time.perf_counter()
51          rows, ntok = enc.encode(content)
52          t1 = time.perf_counter()
53          if a.mode == "batched":
54              logits = sess.run(["logits"], enc.collate(rows))[0]; per_q = None
55          else:
56              logits, per_q = [], []
57              for r in rows:
58                  tq = time.perf_counter(); logits.append(sess.run(["logits"], enc.collate([r]))[0][0]); per_q.append((time.perf_counter() - tq) * 1000)
...
69      for i, it in enumerate(items):
70          rec, rows, ntok, (tt, te, tr, td), per_q = run_item(it["content"])
```

In `batched` mode there is **one `sess.run` per response** (line 54), over every row `enc.encode` returned. The 17-call loop (lines 56-58) is the `perq` reference mode, which gave 1698 ms. That mode is **not** the 2379 ms figure.

### A.4 What `enc.encode` returns (`laya_onnx_common.py`)

One row per question, all 17 questions, with the response tokenized once and placed into each row:

```python
46          self.ids = list(questions.keys())
...
56      def encode(self, state, max_len=MAX_LEN, head_max_len=HEAD_MAX_LEN):
57          """== Agent._encode_state (agent.py 752-783): tokenize state once, one sequence per question."""
59          sids = self.state_ids(state)
61          for qid in self.ids:
63              seq, markers, stats = build_sequence(self.tok, state, q, max_len, head_max_len,
64                                                   truncate_left=isinstance(state, list), state_ids=sids,
65                                                   return_stats=True)
...
70      def collate(self, items):
71          """== laya.common.collate_items (pads every row to the longest), as numpy for ORT."""
72          n, L = len(items), max(len(it["ids"]) for it in items)
```

`load_inputs` asserts `len(qs) == 17` (line 32), and the questions file is SHA-pinned at line 13 (`f519fa8e…`).

### A.5 The ONNX graph is the whole model over a dynamic row axis (`export_onnx.py`)

The export ran on the box: `decide/step3/scripts/export_onnx.py` sha256 `014b8f3458ecb19ef797ed0493e7e800f8e0002b6f915c58cc62a771a43b3fcf`, which matches the VPS `box-side/scripts/export_onnx.py`. It produced `laya-fp32.onnx` `3b0dae5d…`, the file the VPS bench SHA-checked.

```python
57          def forward(s, input_ids, attention_mask, marker_pos, marker_mask, qtype):
58              return s.m(input_ids, attention_mask, marker_pos, marker_mask, qtype)
...
71                            dynamic_axes={"input_ids": {0: "rows", 1: "seq"}, "attention_mask": {0: "rows", 1: "seq"},
```

One `session.run` therefore runs encoder + heads over all rows in the batch.

### A.6 Evidence in the output that it was 17 rows in one run

- Result JSON `summary`: `"mode": "batched"`, `"n": 471`, `per_item.median_ms` 2378.95 (recomputed from `per_item_ms`: 2378.95), `per_question_run: null` (that field is filled only in `perq` mode), `session_run.median_ms` 2374.2, `encode.median_ms` 4.4, `threads.intra_op` 8, ORT 1.22.1, host `himalogic`, Xeon Gold 5418Y.
- Raw `vps/raw/ckpt-epoch-2.5-step-9610-fp32-batched.jsonl` (sha `2013a855…`): all 471 records have exactly 17 `row_lens` and 17 logit entries. Example (first item): `row_lens [59, 57, 63, …, 107, …, 52]`, `padded_seq 107`.
- int8 one-pass (1209 ms): same code path, `bench-…-int8-dynamic-batched.json` (sha `ad6c8e76…`), `mode: batched`.

## B. The old 2236 ms figure (fp32 PyTorch eager, orig ckpt-epoch-2.6-step-10160, every 4th item, n=118)

### B.1 Which code ran

| File (VPS `/root/primitives-evaluator/task1-2026-10-05/`) | sha256 | Box copy |
|---|---|---|
| `bench/run-cpu-bench-bounded.sh` | `76b2a2bfe2cb0bdf6b357eda10aa5f54650dd2ee1eb0c16c939174cea6a540be` | (VPS only) |
| `inputs/bench_latency_bounded.py` | `1ff3e6723dbd2558c05f92e3267a1a441abab1bc793e5a99119152905c74b397` | `task1/scripts/bench_latency_bounded.py`: same |
| `pylib/laya/agent.py` | `cd94166107d6c359bdbbeb86ebfa39e197534af1f954457ece7cb11dba363c5e` | laya 0.3.21 (`/tmp/laya-src`, `step3/venv-export`): same |
| `pylib/laya/common.py` | `9358176290b519b3e1df0077e6b55ce6a57e191abaf8401f3f7c35cb62596868` | same |
| `bench/cpu-bench-orig.log` | `afef0ed24bf06889ca0c4eee620ca1e2d8fd682994503e7e837a29330310663c` | (VPS only) |
| `bench/bench-cpu-orig-ckpt-epoch-2.6-step-10160.json` | `b604648969d839d9e048cf7fb39f7c0b1ef2af19bb6461ee5726fb31f169f910` | (VPS only) |

### B.2 Invocation (`run-cpu-bench-bounded.sh`)

```bash
3  export PYTHONPATH=./pylib OMP_NUM_THREADS=8
5  timeout 900 python3 -u inputs/bench_latency_bounded.py --ckpt "$1" --questions inputs/laya-questions.json --suite inputs/held-out-suite.v2.json --device cpu --threads 8 --stride 4 --max-sec 480 --out bench/bench-cpu-$2.json
```

The log, `cpu-bench-orig.log`, line 16 records: `"ckpt": "ckpt-orig/ckpt-epoch-2.6-step-10160", "device": "cpu", "n": 118, … "median_ms": 2235.605547670275, "p95_ms": 2648.9839809946716, … "torch": "2.14.0+cpu", "threads": 8, "host": "himalogic"`. The run started at 2026-10-05T05:33:05Z (11:18 NPT).

### B.3 The timed call (`bench_latency_bounded.py`)

```python
13  qs = json.load(open(a.questions)); items = json.load(open(a.suite))["items"]
17  sel = items[::a.stride]; ms = []; t_start = time.time(); capped = False
18  for i, it in enumerate(sel):
19      t0 = time.perf_counter(); agent.predict(it["content"], qs, max_len=1024, head_max_len=256)
```

There is **one `agent.predict` per item**, and it passes all questions (`qs`, the 17-question file).

### B.4 Inside laya 0.3.21 (`agent.py`, `common.py`; byte-identical on VPS and box)

```python
agent.py 1377   predict = system_one
agent.py 1318       return self.predict_batch([state], questions, ...          # inside system_one (def at 1283)
agent.py 1015   chunk = batch_size if (batch_size and batch_size > 0) else len(states)   # = 1 state
agent.py 1031   encoded = [self._encode_state(st, ids, internal, **overrides) for st in part]
agent.py 775        for qid in ids:                                            # inside _encode_state (752-783)
agent.py 777            seq, markers, stats = build_sequence(self.tok, state, q, max_len, head_max_len,
agent.py 1040   b = collate_items(per_state_items, self.tok.pad_token_id)
agent.py 1041   logits, act = self._forward(b)                                 # ONE forward for all rows
agent.py 866        logits, act = self._infer(b)                              # _forward -> _infer -> self.model(...) at 814
common.py 531   n, L = len(items), max(len(it["ids"]) for it in items)        # collate_items pads all rows to longest
```

With one state and `batch_size=None`, `chunk = 1`, so the single state's 17 rows go through **one** `collate_items` and **one** `_forward`. On CPU, `_infer` retries only on non-CPU OOM (line 829), so it does not split the batch.

Precision was fp32. `agent.py` line 499 sets `self.dtype = torch.float32`. CPU bf16 autocast is enabled only by `LAYA_CPU_AMP` (line 518), and the run script does not set it.

## C. Why "one shared encoding" is not available (architecture, from code)

```python
common.py 146   """Format: [CLS] <type> instructions [SEP] [MASK] opt0 [MASK] opt1 ... [SEP] state [SEP].
common.py 313   def forward(self, input_ids, attention_mask, marker_pos, marker_mask, qtype, detach_encoder: bool = False):
common.py 314       h = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
```

The question (instructions + options) and the response (state) share one bidirectional ModernBERT sequence, and the encoder runs on every row. Every response token attends to the question tokens, so the response's representation is different for each primitive. The only sharing laya does is tokenizing the response once (`agent.py` lines 765-773, "Tokenize the shared state once"). That saves tokenizer work, not encoder work. A model that encodes the response once and answers 17 primitives from that one encoding would be a different model and would need retraining. This is out of scope here.

Cost of this design on the suite: the median padded batch is 17 × 102 = 1734 tokens for 903 real tokens, so about 48% of the batch is padding (`bench_ort.py` tokens summary: `padded_seq_median` 102, `row_len_total_median` 903). Running 17 unpadded single rows (`perq`, 1698 ms fp32 / 1003 ms int8) is faster, but it is 17 calls and not one pass. It is reported only as a reference.

## D. Checkpoint caveat (disclosure, not a one-pass issue)

The 2379 ms was measured on Step 3's `ckpt-epoch-2.5-step-9610` (task1 group-split retrain, `model.safetensors` `3a88d65f…`), not on the deciding run's selected `ckpt-epoch-1.5-step-5766` (`703cabfc…`). They have the same architecture:
- `rl_agent_config.json` sha256 `7aa34edd41f6c95dd987c43d5a71ee8120491b8a862e35f1b95854609c93ebf2` in both.
- Tokenizer files are byte-identical.
- `encoder/config.json` differs only in metadata keys (`_name_or_path`, `_attn_implementation_autoset`, `reference_compile: false`, `transformers_version`). Both are ModernBERT with 28 layers, hidden 1024, 16 heads, and intermediate 2624.
- `model.safetensors` is the same size (842,609,220 bytes).

Weights do not change fp32 compute cost at a fixed shape. So the figure carries over for fp32. int8 *accuracy* does not carry over and must be gated per checkpoint (Task 2a).

## E. Answer to the brief

- "Neither of the last two reports stated whether Laya's CPU latency came from one forward pass per response answering all primitives, or one pass per primitive." **Answer: one forward pass per response, answering all 17 primitives in one batched call.** Code: `bench_ort.py` line 54 (2379 ms), and `bench_latency_bounded.py` line 19 → laya `agent.py` line 1041 (2236 ms).
- "If it was per primitive, re-measure with one pass and report both." Not needed. Both figures are already one-pass. The per-question variant (1698 ms) was measured separately and labeled as not one-pass.
