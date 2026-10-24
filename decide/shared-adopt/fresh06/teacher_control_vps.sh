#!/bin/bash
# FRESH-06 step 2 control: rerun ens5 teacher on 8 v5 train rows; compare to 7a428e8d values on the box. VPS CPU, flock, 9G cgroup.
set -u
R=/root/primitives-evaluator/decide-2026-10-13/shared-adopt; D=$R/distill; P=$D/pack; F=$R/f06/teacher; PY=/root/primitives-evaluator/decide-2026-10-05/cpu-bench/venv/bin/python
export PYTHONPATH=$P HF_HOME=/root/primitives-evaluator/decide-2026-10-05/cpu-bench/hf-home TOKENIZERS_PARALLELISM=false
cd $F; echo "START $(date -u +%FT%TZ)"
echo "c8528f9e21ecca8d29c28b0c5d2884621b4a4cd6a6fa4a4761d9af77373d74fb  $P/teacher_probs.py" | sha256sum -c || exit 4
sha256sum -c $D/teacher-ckpts.sha256 || exit 5
mapfile -t CK < $D/teacher-ckpts.txt; [ ${#CK[@]} = 5 ] || exit 6
A=(); for c in "${CK[@]}"; do A+=(--ckpt $c); done
flock /tmp/airp-vps-bench.lock nice -n 10 systemd-run --scope --quiet -p MemoryMax=9G -p MemorySwapMax=0 $PY -u $P/teacher_probs.py "${A[@]}" --questions $P/data-v5/laya-questions.json --train $F/control-v5-rows.jsonl --out $F/control-v5-rows-soft.jsonl --threads 8 2>&1 | grep -vi warning
sha256sum control-v5-rows-soft.jsonl; echo "CONTROL_DONE $(date -u +%FT%TZ)"
