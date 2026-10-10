#!/bin/bash
# 3b pod pipeline: setup -> preprocess -> train run A -> train run B -> raw logits for every checkpoint. Detached (nohup).
set -uxo pipefail
export PYTHONUNBUFFERED=1 TORCHDYNAMO_DISABLE=1 TOKENIZERS_PARALLELISM=false
export HF_HOME=/workspace/hf-cache HUGGING_FACE_HUB_TOKEN="${HF_TOKEN:-}"
cd /workspace/shared3b; mkdir -p logs out/raw
echo "PIPE_START $(date -u +%FT%TZ)"; nvidia-smi -L
sha256sum data/*.jsonl data/*.json
pip install -q -r requirements.txt 2>&1 | tail -3
pip install -q 'laya==0.3.21' 'transformers==4.48.3' 2>&1 | tail -2
python3 -c "import torch,transformers,laya,onnxruntime as o;print(torch.__version__,torch.cuda.is_available(),transformers.__version__,o.__version__)"
python3 preprocess_shared.py --data-dir data --out-dir preprocessed 2>&1 | tee logs/preprocess.log
grep -q PREPROCESS_DONE logs/preprocess.log || { echo "PREPROCESS_FAILED"; exit 21; }
python3 -u train_shared.py --output-dir checkpoints-A --epochs 3 --batch-size 8 --grad-accum 4 --lr-encoder 2e-5 --lr-head 1e-4 --amp bf16 --sigma-start 0.25 2>&1 | tee logs/train-A.log
echo "RUN_A_EXIT:${PIPESTATUS[0]}"
python3 -u train_shared.py --output-dir checkpoints-B --epochs 3 --batch-size 2 --grad-accum 1 --lr-encoder 2e-5 --lr-head 1e-4 --amp bf16 --sigma-start 0.25 --log-every 500 2>&1 | tee logs/train-B.log
echo "RUN_B_EXIT:${PIPESTATUS[0]}"
for R in A B; do
  ARGS=(); for c in checkpoints-$R/ckpt-epoch-*; do ARGS+=(--ckpt "$c"); done
  python3 -u infer_raw_shared.py "${ARGS[@]}" --questions data/laya-questions.json --val data/val.jsonl --suite data/held-out-suite.v2.json --out out/raw/$R --device cuda 2>&1 | tee logs/infer-$R.log
done
echo "PIPELINE_DONE $(date -u +%FT%TZ)"
