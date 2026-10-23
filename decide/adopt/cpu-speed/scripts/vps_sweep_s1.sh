#!/bin/bash
# Task 3 step 1 screen: ORT thread/session settings on the deployment fp32 padded model, items 0-79 (speed screen
# only; accuracy is gated on the full 471 for the chosen setting). Control (t8 default) is run first AND last to
# expose drift from production load.
V=/root/primitives-evaluator/decide-2026-10-06/adopt/cpu-speed
M=$V/onnx/5766-fp32-padded/laya-fp32.onnx
R=$V/scripts/vps_run.sh
C="--limit 80 --warmup 10"
$R s1-t8-ctrlA $M padded --intra 8 $C
$R s1-t8-spin0 $M padded --intra 8 --spin 0 $C
$R s1-t6 $M padded --intra 6 $C
$R s1-t4 $M padded --intra 4 $C
$R s1-t8-aff $M padded --intra 8 --affinity "1;2;3;4;5;6;7" $C
$R s1-t8-ctrlB $M padded --intra 8 $C
echo SWEEP_S1_DONE
