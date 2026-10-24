#!/bin/bash
# pull_seed.sh SEED : pull raw (individual + averaged) + sha files for f07-sSEED from the pod to the box, verify, score.
set -euo pipefail
SEED=$1; R=f07-s$SEED; A=avg-$R-ep2.0-2.5-3.0; F=/workspace/airp/decide/shared-adopt/f07
S="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ServerAliveInterval=15 -i $HOME/.ssh/runpod_airp -p 23902 root@213.173.102.179"
mkdir -p $F/pod; cd $F/pod
$S "cd /workspace/f07 && tar c out/raw/$R out/raw/$R.sha256 out/raw-avg/$R out/raw-avg/$R.sha256 out/avg-meta/$A.average-meta.json out/avg-meta/$A.sha256 logs/train-$R.log logs/infer-$R.log logs/avg-$R.log logs/infer-avg-$R.log" | tar x
grep -E " out/raw/$R/| logs/" out/raw/$R.sha256 | sha256sum -c --quiet && echo "BOX_RAW_SHA_OK $R"
sha256sum -c --quiet out/raw-avg/$R.sha256 && echo "BOX_AVGRAW_SHA_OK $R"
I=(); for e in 2.0 2.5 3.0; do I+=(ind-$R-ep$e=$(ls -d $F/pod/out/raw/$R/ckpt-epoch-$e-*)); done
$F/analyze-f07.sh $F/score-$R avg-$R=$F/pod/out/raw-avg/$R/$A "${I[@]}"
