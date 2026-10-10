#!/bin/bash
# Task 3 VPS runner: one bench at a time, nice -n 10, waits for load < 1.5 and no other bench/llama.
# Usage: vps_run.sh <label> <model-path> <layout> [extra bench2 args...]
set -u
V=/root/primitives-evaluator/decide-2026-10-06/adopt/cpu-speed
PY=/root/primitives-evaluator/decide-2026-10-05/cpu-bench/venv/bin/python
export HF_HOME=/root/primitives-evaluator/decide-2026-10-05/cpu-bench/hf-home TOKENIZERS_PARALLELISM=false
L=$1; M=$2; LAY=$3; shift 3
SHA=$(sha256sum "$M" | cut -d' ' -f1)
waitidle() { while [ "$(cut -d' ' -f1 /proc/loadavg | awk '{print ($1>=1.5)}')" = 1 ] || pgrep -f "bench_ort.py|bench_latency|llama-server|score-per-primitive" >/dev/null; do echo "$(date -u +%T) waiting load $(cut -d' ' -f1-3 /proc/loadavg)"; sleep 30; done; }
waitidle
echo "START $L $(date -u +%FT%TZ) load $(cat /proc/loadavg) sha $SHA"
cd $V/scripts
nice -n 10 $PY -u bench2.py --ckpt $V/ckpt/ckpt-epoch-1.5-step-5766 --model "$M" --expect-sha $SHA \
  --suite $V/inputs/held-out-suite.v2.json --questions $V/inputs/laya-questions.json \
  --out $V/results/bench-$L.json --raw-out $V/raw/$L.jsonl --label $L --layout $LAY "$@" 2>&1 | grep -v -i warning
echo "END $L exit ${PIPESTATUS[0]} $(date -u +%FT%TZ) load $(cat /proc/loadavg)"
