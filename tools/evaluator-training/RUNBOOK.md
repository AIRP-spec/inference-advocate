# Runbook: corpus generation run

Original: Monday, 17 August 2026. Amended Tuesday, 18 August 2026 with fixes learned during the first register-augmentation run (localhost endpoint, HF_TOKEN, local-disk npm install, demo workspace off the critical path, weights cache behavior).

This is the operational procedure for regenerating the evaluator training corpus on a RunPod pod. The generation script and the writer endpoint run on the SAME pod: the GPU serves the writer model, the CPU runs the orchestration. Do not rent a second pod for the script.

## Before you start

- The recipe changes must be committed and PUSHED to `feat/local-evaluator`. The pod clones from GitHub; anything unpushed does not exist on the pod.
- The held-out suite amendment (if any) lands together with the recipe changes, never recipe-only. A recipe that claims registers the gate does not probe passes its own dry run and is still untestable.
- Confirm a clean dry run against the pushed state: `node tools/evaluator-training/generate.mjs --plan` reconciles, totals look right, CSE writer positives are 0. Do not spend on a pod against a broken or stale plan.
- Cut a fresh API token for the writer endpoint.

## Step 1. Start the writer endpoint pod

- Deploy one RunPod pod. A100 or H100 80GB (the writer is Qwen2.5-32B).
- Image: `vllm/vllm-openai:latest`
- Volume Disk: 100 GB, mounted at /workspace
- Add port 8000 to HTTP ports
- Environment variable: `HF_TOKEN` set to a Hugging Face token. Costs nothing, avoids unauthenticated rate limits on the model download.
- Container start command (one line, new token):

```
--model Qwen/Qwen2.5-32B-Instruct --host 0.0.0.0 --port 8000 --api-key NEW_TOKEN --max-model-len 4096 --gpu-memory-utilization 0.95
```

- First start on a fresh volume downloads roughly 65 GB of weights and takes 15 to 20 minutes total (download, weight loading, CUDA graph capture, then Uvicorn binds). Watch the pod logs, not the curl probe; as long as the log moves through those stages it is fine. The weights cache on the volume, so a pod RESTART does not re-download and is much faster.
- The download is most of the volume: expect roughly 65 of the 100 GB used by the Hugging Face cache. This is normal.
- Probe when Uvicorn is up:

```
curl -H "Authorization: Bearer NEW_TOKEN" https://POD_ID-8000.proxy.runpod.net/v1/models
```

A JSON reply naming the model is a pass. Do Steps 2 and 3 in parallel while the model loads; the endpoint is not needed until the smoke test.

## Step 2. Get the repo, on the VOLUME not the overlay

The overlay disk is tiny and fills. Work from /workspace.

```
cd /workspace
git clone https://github.com/AIRP-spec/inference-advocate.git
cd inference-advocate
git checkout feat/local-evaluator
git pull
```

## Step 3. Dependencies

### Node

```
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs build-essential cmake git tmux
```

Do NOT run `npm install` directly in /workspace. The network volume is terrible at node_modules extraction (tens of thousands of small file writes) and the install will appear hung for tens of minutes or stall outright. Install on local disk and move the result:

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
```

The repo is npm workspaces; copying every workspace's package.json into the skeleton is required or the install resolves almost nothing (the "added 1 package" symptom).

Build note: the generation pipeline does not need the full workspace build. `generate.mjs --plan` runs once core (and its siblings) compile; the demo workspace is not on the critical path. If the build is slow on the volume, run the plan and proceed once it prints.

```
cd /workspace/inference-advocate && npm run build
```

### Python

```
pip install "transformers==4.51.3" "peft==0.13.2" "trl==0.11.4" --no-deps
pip uninstall -y torchvision torchaudio
```

Keep the image's torch. Do not pip install torch. Note: these pins are the TRAINER dependency set and may not be needed on a generation-only pod (the node-side generator does not import them). Unverified; try skipping them on a future generation-only pod and update this note.

Save the environment freeze, denoted by pod role:

```
pip freeze > /workspace/inference-advocate/working-versions-writer-vllm.txt
```

(The trainer pod's freeze is `working-versions-trainer-pytorch.txt`. They are different images; restore from the file matching the pod type.)

## Step 4. Point the generation scripts at the writer

The writer runs on this same pod, so use localhost, not the public proxy (the proxy works but round-trips every request out and back for nothing):

```
export AIRP_GENERATOR_BASE_URL=http://localhost:8000/v1
export AIRP_GENERATOR_API_KEY=NEW_TOKEN
```

Exports die with the shell. Set them inside the tmux session the run will live in.

## Step 5. Dry run on the pod, confirm the plan

```
node tools/evaluator-training/generate.mjs --plan
```

Confirm it matches the plan verified locally before the pod: same total, same family and register tables, CSE writer positives 0. If the number is wrong or CSE shows writer slots, STOP and report. Do not generate.

## Step 6. Smoke test, 20 items

```
node tools/evaluator-training/generate.mjs --limit 20
```

Read the 20 in data/evaluator-training/corpus.jsonl and the drop log. Confirm the registers actually look different from each other (blunt is blunt, hedged is hedged) and no meta-language leaked into composed items (utterance, never a description of the utterance). If it looks right, continue. The full run regenerates from scratch; the smoke items do not need clearing.

## Step 7. Full generation, in tmux

```
tmux new -s gen
export AIRP_GENERATOR_BASE_URL=http://localhost:8000/v1
export AIRP_GENERATOR_API_KEY=NEW_TOKEN
node tools/evaluator-training/generate.mjs 2>&1 | tee gen.log
```

Detach: Ctrl-b then d. Reattach: `tmux attach -t gen`.

Output is bursty: long silences between progress lines are normal (writer batches in flight). To confirm liveness, watch `wc -l data/evaluator-training/corpus.jsonl` grow, or GPU utilization in `nvidia-smi`.

Watch the end-of-run drop accounting. A big writer-refusal or duplicate-corpus cluster on one class or register is a signal, paste it. A slot that exhausts and stops ("failed to fill ... Stop and report") is a hard stop, paste it.

## Step 8. Leak check and review sample

```
node tools/evaluator-training/leak-check.mjs
node tools/evaluator-training/sample.mjs
```

leak-check must be clean (0 held-out collisions). sample.mjs writes review-sample.json.

## Step 9. Send the sample for review

Upload review-sample.json to the review chat. Do NOT train yet. The review gates the training run. Composed slices and any newly added registers need the closest reading; for composed classes the human read is the only real gate (automated conformance cannot catch scaffold problems).

## Step 10. Terminate the writer pod

Once the corpus, leak-check, sample, gen.log, and working-versions freeze are saved off the pod, terminate. Generation is done; the writer is not needed for training.

## After the sample is accepted (separate session)

- Training runs on a fresh pod against the new corpus.
- Base model: Qwen3-0.6B (size is not the lever; 0.6B is the phone-deployment target).
- Run the checkpoint sweep, read the table.

## Reminders

- Work from /workspace, not the overlay. The overlay fills.
- npm extraction goes on local disk, never the volume. See Step 3.
- The corpus and sft files are gitignored. If training on a different pod later, carry them via the tmp-corpus-transfer branch or regenerate.
- Never resume a halted generation by appending. One recipe, one seed, one run. Generation is the cheap phase; re-run it.
