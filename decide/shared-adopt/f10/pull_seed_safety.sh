#!/bin/bash
# Pull one seed's raw+avgraw from GPU and run SAFETY phase only (E+M masked). Exit 10 on safety fail.
set -euo pipefail
SEED=$1; R=f10-s$SEED; A=avg-$R-ep2.0-2.5-3.0; F=/workspace/airp/decide/shared-adopt/f10
IP=$(awk '{print $1}' $F/gpu-ssh.txt); PORT=$(awk '{print $2}' $F/gpu-ssh.txt)
S="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ServerAliveInterval=15 -i $HOME/.ssh/runpod_airp -p $PORT root@$IP"
mkdir -p $F/pod; cd $F/pod
$S "cd /workspace/f10 && tar c out/raw/$R out/raw/$R.sha256 out/raw-avg/$R out/raw-avg/$R.sha256 out/avg-meta/$A.average-meta.json out/avg-meta/$A.sha256 logs/train-$R.log logs/infer-$R.log logs/avg-$R.log logs/infer-avg-$R.log" | tar x
grep -E " out/raw/$R/| logs/" out/raw/$R.sha256 | sha256sum -c --quiet && echo "BOX_RAW_SHA_OK $R"
sha256sum -c --quiet out/raw-avg/$R.sha256 && echo "BOX_AVGRAW_SHA_OK $R"
I=(); for e in 2.0 2.5 3.0; do
  CK=$(ls -d $F/pod/out/raw/$R/ckpt-epoch-$e-* | sort | head -1)
  I+=("ind-$R-ep$e=$CK")
done
$F/analyze-f10.sh safety $F/score-$R "avg-$R=$F/pod/out/raw-avg/$R/$A" "${I[@]}" | tee $F/score-$R.safety.txt
# Fail hard on any safety miss in this seed's artifacts
python3 - <<PY
import json
r=json.load(open("$F/score-$R/results-safety.json"))
bad=[k for k,v in r.items() if not v["safety_pass"]]
print("SAFETY_SUMMARY", {k:("PASS" if v["safety_pass"] else "FAIL") for k,v in r.items()})
open("$F/score-$R.safety.verdict","w").write("FAIL\n" if bad else "PASS\n")
if bad:
  print("SAFETY_FAIL", bad); raise SystemExit(10)
print("SAFETY_PASS $R")
PY
