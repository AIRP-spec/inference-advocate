#!/bin/bash
# Identity rerun: python_ref_shared.py pins the suite sha to 6c7b30e1 (pre-bnd-05 file). Item content is identical in 82f8e720
# (only ho-violence-bnd-05 expect/notes changed), so Python and Node both read the 6c7b30e1 file for inputs. No gold is used here.
set -u
A=/root/primitives-evaluator/decide-2026-10-13/shared-adopt; RR=$A/rr; M=avg-f05-s14-ep2.0-2.5-3.0
COMP=$RR/airp-v0.5.0-cse-corrected-2a.json; COMPSHA=59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e
R=/root/primitives-evaluator/decide-2026-10-13/shared-node/repo
echo "SUITE_FILE $(sha256sum $R/data/evaluator-gate/held-out-suite.v2.json)"
COMP=$COMP COMPSHA=$COMPSHA B=$RR/bundle-$M PINS=$RR/laya-shared-avg-f05-s14-RESEARCH.pins.json O=$RR/runs bash $RR/vps_shared_node_rr.sh avgs14-rr-id python,suite all 2>&1 | grep --line-buffered -v "node path [0-9]"
echo "ID_DONE $(date -u +%FT%TZ)"
