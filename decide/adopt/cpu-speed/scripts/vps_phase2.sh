#!/bin/bash
# Task 3 phase 2 (after the S1 sweep). S1 winner (screen): intra 8 + allow_spinning=0.
# S1 full 471 (gated vs baseline) -> S2 packed full 471 on top of S1 -> S2b ORT-optimized packed screen + packed
# control screen -> base-encoder speed probes (untrained weights; latency shape only) -> S3 max_len 128 full 471.
V=/root/primitives-evaluator/decide-2026-10-06/adopt/cpu-speed
R=$V/scripts/vps_run.sh
while pgrep -f "vps_sweep_s1" >/dev/null || pgrep -f "bench_latency" >/dev/null; do sleep 30; done
for d in 5766-fp32-packed probe-base-fp32-padded probe-base-fp32-packed 5766-fp32-packed-ortopt; do
  while [ ! -f $V/onnx/$d/SHA256SUMS ] || ! (cd $V/onnx/$d && sha256sum -c --quiet SHA256SUMS 2>/dev/null); do echo "$(date -u +%T) waiting for $d transfer"; sleep 60; done
done
S="--intra 8 --spin 0"
$R s1-t8-spin0-full $V/onnx/5766-fp32-padded/laya-fp32.onnx padded $S
$R s2-packed-t8-spin0 $V/onnx/5766-fp32-packed/laya-fp32-packed.onnx packed $S
$R s2b-packed-ortopt-t8-spin0-screen $V/onnx/5766-fp32-packed-ortopt/laya-fp32-packed-ortopt.onnx packed $S --limit 80 --warmup 10
$R s2-packed-t8-spin0-screen $V/onnx/5766-fp32-packed/laya-fp32-packed.onnx packed $S --limit 80 --warmup 10
$R probe-base-padded-t8-spin0-screen $V/onnx/probe-base-fp32-padded/laya-fp32.onnx padded $S --limit 80 --warmup 10
$R probe-base-packed-t8-spin0-screen $V/onnx/probe-base-fp32-packed/laya-fp32-packed.onnx packed $S --limit 80 --warmup 10
$R s3-packed-t8-spin0-maxlen128 $V/onnx/5766-fp32-packed/laya-fp32-packed.onnx packed $S --max-len 128
echo PHASE2_DONE
