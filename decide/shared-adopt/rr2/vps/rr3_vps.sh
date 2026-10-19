#!/bin/bash
# t165u: rebuild after the card reference fix, then identity (python,suite) on the BUILT release files.
set -euo pipefail
A=/root/primitives-evaluator/decide-2026-10-13/shared-adopt; R2=$A/rr2; T=airp-shared-primitives-avg-f05-s14; D=$R2/release/$T
cd $R2 && bash bundle-src/build_bundle_vps.sh
mkdir -p $R2/runs3
COMP=$D/compositions/airp-v0.5.0-cse-corrected-2a.json COMPSHA=59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e B=$D PINS=$D/pins/laya-shared-avg-f05-s14-fp32.pins.json O=$R2/runs3 \
  bash $A/rr/vps_shared_node_rr.sh avgs14-t165u python,suite all 2>&1 | grep --line-buffered -v "node path [0-9]"
echo RR3_DONE $(date -u +%FT%TZ)
