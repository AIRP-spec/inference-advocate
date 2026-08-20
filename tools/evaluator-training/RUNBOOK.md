# Runbook: evaluator corpus, training, and gate

Original 17 August 2026. Amended 18 August. Rewritten 20 August 2026 to cover all three phases and to fold in the lessons from the first four runs.

Three phases, each on its own pod:

| phase | needs | host requirement |
|---|---|---|
| generation | writer model (Qwen2.5-32B) on GPU, node orchestration on CPU | A100 or H100 80GB |
| training | PyTorch on GPU | A100 80GB. **Not Blackwell.** |
| gate | llama.cpp on CPU, one merge step | **Intel with AVX512.** GPU optional. |

The gate host requirement is not a preference. See Phase C.

---

# Phase A. Corpus generation

The generation script and the writer endpoint run on the SAME pod. The GPU serves the writer, the CPU runs orchestration. Do not rent a second pod for the script.

## Before you start

- Recipe changes must be committed and PUSHED to `feat/local-evaluator`. The pod clones from GitHub; anything unpushed does not exist on the pod.
- Any held-out suite amendment lands together with the recipe changes, never recipe-only. A recipe that claims registers the gate does not probe passes its own dry run and is still untestable.
- Confirm a clean dry run against the pushed state: `node tools/evaluator-training/generate.mjs --plan` reconciles, totals look right, CSE writer positives are 0.
- Cut a fresh API token for the writer endpoint.

## A1. Start the writer pod

- A100 or H100 80GB. Image `vllm/vllm-openai:latest`. Volume Disk 100 GB at `/workspace`. Port 8000 in HTTP ports.
- Environment variable `HF_TOKEN` set to a Hugging Face token.
- Container start command, one line, new token:

```
--model Qwen/Qwen2.5-32B-Instruct --host 0.0.0.0 --port 8000 --api-key NEW_TOKEN --max-model-len 4096 --gpu-memory-utilization 0.95
```

First start on a fresh volume downloads roughly 65 GB and takes 15 to 20 minutes (download, weight load, CUDA graph capture, then Uvicorn binds). Weights cache on the volume, so a RESTART does not re-download. Expect roughly 65 of the 100 GB used by the HF cache; that is normal, not a leak.

Probe when Uvicorn is up:

```
curl -H "Authorization: Bearer NEW_TOKEN" https://POD_ID-8000.proxy.runpod.net/v1/models
```

Do A2 and A3 while the model loads. The endpoint is not needed until the smoke test.

## A2. Repo on the VOLUME

The overlay disk is tiny and fills.

```
cd /workspace
git clone https://github.com/AIRP-spec/inference-advocate.git
cd inference-advocate
git checkout feat/local-evaluator
git pull
git log --oneline -3
```

Confirm the newest commit is the one you expect.

## A3. Node

```
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs build-essential cmake git tmux
node --version
```

**Verify the version prints v22 before running npm.** If an older Node is present, the postinstall of `node-llama-cpp` fails with a syntax error on `??`. See the Node conflict note in Phase B if apt refuses.

Do NOT run `npm install` in `/workspace`. The network volume is terrible at node_modules extraction and the install appears hung for tens of minutes or stalls. Install on local disk and move:

```
cd /workspace/inference-advocate
rm -rf node_modules
rm -rf /tmp/build && mkdir -p /tmp/build
cp package.json package-lock.json /tmp/build/
for d in packages/*/; do mkdir -p "/tmp/build/$d" && cp "$d/package.json" "/tmp/build/$d/"; done
cd /tmp/build
npm install --no-audit --no-fund
mv node_modules /workspace/inference-advocate/
for d in packages/*/; do [ -d "$d/node_modules" ] && mv "$d/node_modules" "/workspace/inference-advocate/$d/"; done
cd /workspace/inference-advocate && npm run build
```

This is npm workspaces. Copying every workspace's `package.json` into the skeleton is required, or the install resolves almost nothing (the "added 1 package" symptom). The `mv` back is slow because it crosses to the network volume; watch `du -sh node_modules` to confirm progress rather than assuming a stall.

The demo workspace is not on the generation critical path. If the build stalls there, run `generate.mjs --plan` and proceed once it prints.

**No Python packages are needed for generation.** Generation is entirely node-side. This was verified on the 20 August run. The `requirements-train.txt` pins are for training and gating only.

## A4. Point at the writer

The writer is on this pod. Use localhost; the public proxy works but round-trips every request out and back for nothing.

```
export AIRP_GENERATOR_BASE_URL=http://localhost:8000/v1
export AIRP_GENERATOR_API_KEY=NEW_TOKEN
```

Exports die with the shell. Set them inside the tmux session the run will live in.

## A5. Dry run

```
node tools/evaluator-training/generate.mjs --plan
```

Confirm it matches the plan verified before the pod: same total, same family table, CSE writer positives 0, surface writer positives 0. If a number is wrong, STOP.

## A6. Smoke test

```
node tools/evaluator-training/generate.mjs --limit 20
```

Read the 20 rows in `data/evaluator-training/corpus.jsonl` and the drop log. Confirm registers look different from each other and no meta-language leaked into composed items. Content is the utterance, never a description of the utterance.

## A7. Full generation, in tmux

**Start tmux BEFORE the run.** A dropped connection kills a run that is not in tmux, and there is no way to reattach to a lost pty.

```
tmux new -s gen
cd /workspace/inference-advocate
export AIRP_GENERATOR_BASE_URL=http://localhost:8000/v1
export AIRP_GENERATOR_API_KEY=NEW_TOKEN
node tools/evaluator-training/generate.mjs 2>&1 | tee gen.log
```

Output is bursty. Long silences are normal. Confirm liveness with `wc -l data/evaluator-training/corpus.jsonl` in another terminal.

Read the end-of-run drop accounting. A refusal or duplicate cluster on one class or register is a signal. A slot that exhausts and stops is a hard stop.

## A8. Leak check and sample

```
node tools/evaluator-training/leak-check.mjs
node tools/evaluator-training/sample.mjs
```

leak-check must report 0 held-out collisions.

## A9. Carry the corpus off the pod

The corpus and sft files are gitignored, so a fresh pod does not have them. Push to the transfer branch with a fine-grained PAT (Contents read and write on this repo only):

```
cd /workspace/inference-advocate
git checkout -b tmp-corpus-transfer 2>/dev/null || git checkout tmp-corpus-transfer
git add -f data/evaluator-training/corpus.jsonl data/evaluator-training/sft.jsonl data/evaluator-training/review-sample.json gen.log
git commit -m "corpus transfer: <run description>"
git push https://TOKEN@github.com/AIRP-spec/inference-advocate.git tmp-corpus-transfer --force
git checkout feat/local-evaluator
```

Send `review-sample.json` for review. **Do not train until the sample is accepted.** For composed classes the human read is the only real gate; automated conformance cannot catch scaffold problems.

## A10. Terminate the writer pod

Once corpus, sft, leak-check, sample, and gen.log are saved off the pod.

---

# Phase B. Training

## B1. Pod

**A100 80GB.** Do not take a Blackwell card (RTX PRO series, sm_120). PyTorch 2.4.1 in the standard images supports up to sm_90 and will fail with "no kernel image is available for execution on the device."

Verify immediately after the pip installs, before anything else:

```
python3 -c "import torch; print(torch.cuda.get_arch_list()); print(torch.cuda.get_device_capability())"
```

The device capability must appear in the arch list. If it does not, redeploy; do not work around it.

PyTorch image, not vLLM. Volume 100 GB at `/workspace`. `HF_TOKEN` set.

## B2. Repo and corpus

Clone as in A2. Then pull the gitignored training file from the transfer branch without switching branches:

```
cd /workspace/inference-advocate
git fetch origin tmp-corpus-transfer
git checkout origin/tmp-corpus-transfer -- data/evaluator-training/sft.jsonl
wc -l data/evaluator-training/sft.jsonl
```

The line count must match the plan total. It will show as modified in `git status`; that is expected. Do not commit it, and do not switch branches again or it disappears.

## B3. Node

The PyTorch image ships an old Node and `libnode-dev`, which conflicts with NodeSource:

```
apt-get remove -y libnode-dev nodejs npm libnode72
apt-get autoremove -y
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs build-essential cmake git tmux
node --version
```

If dpkg still refuses over `/usr/include/node/common.gypi`, force it: `dpkg --force-overwrite -i /var/cache/apt/archives/nodejs_*.deb` then `apt-get install -f -y`. Nothing on the pod needs Node 12.

Then npm on local disk as in A3, and `npm run build`. The gate imports the built `@airp/core` and `@airp/evaluator-local`, so those must compile.

## B4. Python

```
cd /workspace/inference-advocate
pip install -r tools/evaluator-training/requirements-train.txt
```

That file is the authoritative pin set. Do not type the list by hand; earlier versions of this runbook omitted `sentencepiece`, `protobuf`, and `gguf`, and the run failed hours later at the GGUF conversion step.

Torch comes from the image. Watch the output; if pip tries to install or upgrade `torch`, stop and reconsider, because replacing the image's CUDA build kills GPU access.

Verify:

```
python3 -c "import torch, transformers, peft, trl, sentencepiece, gguf; print(torch.__version__, torch.cuda.is_available(), transformers.__version__)"
```

## B5. Template check before spending GPU time

The sweep is driven by `sweep-recipe.json`, not `train-recipe.json`. `train-recipe.json` is the unused within-family A/B recipe. Point the check at the right file:

```
python3 tools/evaluator-training/train.py --recipe tools/evaluator-training/sweep-recipe.json --check-template
```

Confirm it names `Qwen/Qwen3-0.6B`, reports a non-empty assistant mask with the verdict inside it, and reports no-think active. This check catches the masking failure that once produced a healthy-looking loss curve and a model that had learned almost nothing.

## B6. Run the sweep, in tmux

```
tmux new -s sweep
cd /workspace/inference-advocate
node tools/evaluator-training/run-sweep.mjs 2>&1 | tee sweep.log
```

`run-sweep.mjs` does leak-check, the SFT assert, training with interval checkpoints, then merge, convert, and gate per checkpoint, then the curve report. Do not invoke `train.py` or `gate-from-adapters.py` by hand.

Confirm in the startup lines: base `Qwen/Qwen3-0.6B`, the SFT row count matching the plan, `sft-v3 ok`, and a sweep line naming the checkpoint interval. Steps per epoch is `ceil(n / 32)`; half-epoch saves land at half that.

**Ignore the loss curve.** A falling loss says nothing about generalization. The gate is the signal.

## B7. If training completes but the save crashes

Transient volume I/O errors have killed the final checkpoint save after training completed. The interval checkpoints written earlier are intact.

```
ls -d data/evaluator-training/artifacts/sweep-qwen3-0.6B/lora/checkpoint-*
for d in data/evaluator-training/artifacts/sweep-qwen3-0.6B/lora/checkpoint-*; do echo "$d: $(ls $d | tr '\n' ' ')"; done
```

A usable checkpoint has `adapter_config.json` and `adapter_model.safetensors`. **Delete any directory holding only a README**, or the gate will fail on it.

Do not retrain to recover one endpoint checkpoint. Gate what survived:

```
node tools/evaluator-training/run-sweep.mjs --skip-preflight --skip-train 2>&1 | tee gate.log
```

Note `checkpoints.json` is written after training and will not exist if the crash preceded it.

## B8. Carry the adapters off

Adapters are roughly 40 MB each, so a five-checkpoint set is about 200 MB, over GitHub's file limit. Use RunPod transfer:

```
tar -czf /tmp/adapters.tar.gz -C data/evaluator-training/artifacts/sweep-qwen3-0.6B lora
tar -tzf /tmp/adapters.tar.gz | head
runpodctl send /tmp/adapters.tar.gz
```

Verify the archive lists cleanly before terminating; a bad read from a flaky mount produces a corrupt archive that looks fine by size. Also carry `train-log.json`, which holds the loss history.

Do not bother with the GGUFs. They regenerate from the adapters in minutes.

---

# Phase C. Gate

## C1. The host requirement, which is the whole phase

The gate runs llama.cpp on CPU. Its speed is dominated by the **instruction set**, not core count. Measured on the identical 0.6B Q8_0 artifact:

| host | instructions | per item |
|---|---|---|
| Xeon Platinum 8470, 208 cores | AVX512, VNNI, BF16, AMX_INT8 | ~1500 ms |
| EPYC 7742, 128 cores | AVX2 only | ~35000 ms |
| Xeon Platinum 8358, 16 cores | AVX512, VBMI, VNNI | **~340 ms** |

Sixteen Intel cores beat 128 AMD cores by a factor of one hundred.

**Before installing anything on a gate host:**

```
lscpu | grep -o 'avx512[a-z_]*' | sort -u
nproc
```

Empty output means the host is unusable. Destroy it and take another.

A DigitalOcean **Premium Intel** droplet, 16 vCPU, is a known-good and cheap gate host. RunPod's CPU pool has repeatedly drawn AMD. RunPod GPU pods vary; check before building.

The gate needs no GPU. The merge step imports torch but runs fine on CPU, which was verified on 19 August. On a CPU-only host, install CPU torch explicitly:

```
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r tools/evaluator-training/requirements-train.txt
```

(Add `--break-system-packages` on recent Debian and Ubuntu.)

## C2. Restore the adapters

```
mkdir -p data/evaluator-training/artifacts/sweep-qwen3-0.6B
tar -xzf adapters.tar.gz -C data/evaluator-training/artifacts/sweep-qwen3-0.6B/
rm -rf data/evaluator-training/artifacts/sweep-qwen3-0.6B/lora/checkpoint-*README-only*
ls data/evaluator-training/artifacts/sweep-qwen3-0.6B/lora/
```

Delete any checkpoint directory without weights.

## C3. Run, in tmux

```
tmux new -s gate
cd /root/inference-advocate
node tools/evaluator-training/run-sweep.mjs --skip-preflight --skip-train 2>&1 | tee gate.log
```

**Read the `llama.cpp system-info` line.** It prints the instruction set directly and is the definitive check that the host is right. It appears after the first merge and conversion, not at startup.

Then read the first few item latencies:

- Under 2 seconds: correct host, let it run.
- Over 20 seconds: stop. The host lacks AVX512 or something else is wrong. Every result will be a timeout recorded as "fired nothing," which is indistinguishable in the report from a model that learned nothing.

`LocalEvaluator` exposes no thread option, so llama.cpp picks its own default. On a 128-core box it used about 12. This is a known gap.

## C4. Read the results

Send `sweep-report.json`, every `gate-report-step-*.json`, and `gate.log` for review.

The verdict string is not the result. `extraLimit` is 0 and no checkpoint has passed yet. What matters is whether the specific taught contrasts moved the specific rows they targeted, which is read by cross-referencing failing row IDs against the held-out suite's `family` field.

---

# Standing rules

- **One recipe, one seed, one run.** Never resume a halted generation by appending. The dedup set rebuilds empty each run, and a halt usually precedes a recipe change. Generation is the cheap phase.
- **A corpus assembled across runs is not reproducible from its recipe.** Partial regeneration is acceptable for a diagnostic sweep. The run backing a published artifact must be a single clean run from the final recipe.
- **The held-out suite is never a training input.** Its digest is pinned. Amendments are reviewed. It is the fixed point across sweeps; changing it breaks the comparison series.
- **State the criterion before applying it.** A labeling rule stated in prose has twice been implemented as a verb list, which passes every automated check while being wrong.
- **Check that every rule the gate enforces is taught somewhere in the corpus.** Neither conformance, leak-check, nor the dry run performs this check.
- **Work from `/workspace` on RunPod, never the overlay.**
- **Start tmux before the run.**
