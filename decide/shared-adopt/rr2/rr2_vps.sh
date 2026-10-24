#!/bin/bash
# t164u: re-issue pins with demo-default wording (verdict fields unchanged), re-run identity (python,suite) and Node lengths. VPS CPU, flock, 9G.
set -euo pipefail
A=/root/primitives-evaluator/decide-2026-10-13/shared-adopt; RR=$A/rr; R2=$A/rr2; M=avg-f05-s14-ep2.0-2.5-3.0
mkdir -p $R2/runs; cd $R2
/root/primitives-evaluator/decide-2026-10-05/cpu-bench/venv/bin/python - $RR/laya-shared-avg-f05-s14-RESEARCH.pins.json $R2/laya-shared-avg-f05-s14-fp32.pins.json <<'PY'
import json,sys,hashlib
src,out=sys.argv[1:3]; p=json.load(open(src)); old=json.loads(json.dumps(p))
p["name"]="laya-shared avg-f05-s14-ep2.0-2.5-3.0 fp32 (tryairp demo default; NOT certified for production)"
p["note"]="avg-f05-s14: uniform weight average of f05-s14 epochs 2.0/2.5/3.0 (average_n.py 88f9cbce). Selected on val composed macro-F1 0.8021 (2a) over avg-f05-s12 0.7747 (4237006); approved by Justin Flores 2026-10-19 (t164u) as the default evaluator of the tryairp.com / dev.tryairp.com demos. Did NOT pass AIRP certification (stopped per ADR 2026-10-19). T=1, P(true)>=0.5, stance argmax, composition 2a. The @airp/core package default remains the rule evaluator."
for k in p:
  if k not in ("name","note"): assert p[k]==old[k], k
json.dump(p,open(out,"w"),indent=1); open(out,"a").write("\n"); print("PINS",hashlib.sha256(open(out,"rb").read()).hexdigest())
PY
COMP=$RR/airp-v0.5.0-cse-corrected-2a.json COMPSHA=59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e B=$RR/bundle-$M PINS=$R2/laya-shared-avg-f05-s14-fp32.pins.json O=$R2/runs \
  bash $RR/vps_shared_node_rr.sh avgs14-v2pins python,suite,lengths all 2>&1 | grep --line-buffered -v "node path [0-9]"
echo RR2_DONE $(date -u +%FT%TZ)
