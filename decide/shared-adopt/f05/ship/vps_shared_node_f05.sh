#!/bin/bash
# Shared-encoding Node port on the Nepal VPS: cross-path identity (Python gate path vs Node evaluate()) on held-out v2,
# then Node latency (short suite + pinned length buckets). Every timed step runs under flock /tmp/airp-vps-bench.lock
# (another executor benches here), nice -n 10, and a 9 GB memory cgroup (production runs on this 15 GiB host).
# Usage: vps_shared_node.sh <tag> <steps: any of python,suite,lengths (comma list)> [ids: all|FILE]
set -u
TAG=$1; STEPS=$2; WHICH=${3:-all}
V=${V:-/root/primitives-evaluator/decide-2026-10-13/shared-node}
R=${R:-$V/repo}; L=$R/tools/evaluator-training/laya-shared-node; O=${O:-$V/runs}; B=${B:-$V/bundle-shared-A570}
PY=/root/primitives-evaluator/decide-2026-10-05/cpu-bench/venv/bin/python
export HF_HOME=/root/primitives-evaluator/decide-2026-10-05/cpu-bench/hf-home TOKENIZERS_PARALLELISM=false
LOCK=/tmp/airp-vps-bench.lock; CG="systemd-run --scope --quiet -p MemoryMax=9G -p MemorySwapMax=0"
PINS=${PINS:-$L/pins/laya-shared-A570-fp32.pins.json}; PINSHA=$(sha256sum $PINS | cut -d' ' -f1)
COMP=${COMP:-$R/tools/evaluator-training/primitives/compositions/airp-v0.5.0.json}; COMPSHA=${COMPSHA:-4def0b8fd339713bd261106cb10235949f4bd1bc4e3631a88dd7cc511b0087e0}; [ "$(sha256sum $COMP | cut -d" " -f1)" = "$COMPSHA" ] || { echo COMP_SHA_MISMATCH; exit 3; }
SUITE=$R/data/evaluator-gate/held-out-suite.v2.json; PINNED=${PINNED:-$V/lengths/pinned-lengths-v1.jsonl}; : $V/lengths/pinned-lengths-v1.jsonl
mkdir -p $O
if [ "$WHICH" = all ]; then python3 -c "import json;json.dump({'ids':[i['id'] for i in json.load(open('$SUITE'))['items']]},open('$O/all-ids.json','w'))"; IDS=$O/all-ids.json; else IDS=$WHICH; fi
echo "JOB $TAG steps=$STEPS pins $PINSHA start $(date -u +%FT%TZ)"
NODEARGS="--bundle $B --pins $PINS --pins-sha $PINSHA --composition $COMP --composition-sha $COMPSHA --threads 8 --warmup 20"
case ",$STEPS," in *,python,*)
  flock $LOCK bash -c "echo START python \$(date -u +%FT%TZ) load \$(cat /proc/loadavg); nice -n 10 $CG $PY -u $L/crosspath/python_ref_shared.py --bundle $B --pins $PINS --pins-sha $PINSHA --suite $SUITE --ids $IDS --out $O/$TAG-python.jsonl --threads 8 2>&1 | grep -v -i warning; echo END python \$(date -u +%FT%TZ)";;
esac
case ",$STEPS," in *,suite,*)
  flock $LOCK bash -c "echo START node-suite \$(date -u +%FT%TZ) load \$(cat /proc/loadavg); cd $R && nice -n 10 $CG node $L/crosspath/node_path_shared.mjs $NODEARGS --suite $SUITE --ids $IDS --out $O/$TAG-node.jsonl --summary $O/$TAG-node-summary.json 2>&1 | grep -v '^local-laya-shared@.*-> '; echo END node-suite \$(date -u +%FT%TZ) load \$(cat /proc/loadavg)"
  [ -f $O/$TAG-python.jsonl ] && { cd $R && node $R/tools/evaluator-training/laya-node/crosspath/compare.mjs --python $O/$TAG-python.jsonl --node $O/$TAG-node.jsonl --pins $PINS --composition $COMP --out $O/$TAG-compare.json; echo "COMPARE exit $?"; };;
esac
case ",$STEPS," in *,lengths,*)
  flock $LOCK bash -c "echo START node-lengths \$(date -u +%FT%TZ) load \$(cat /proc/loadavg); cd $R && nice -n 10 $CG node $L/crosspath/node_path_shared.mjs $NODEARGS --warmup-suite $SUITE --pinned $PINNED --out $O/$TAG-lengths.jsonl --summary $O/$TAG-lengths-summary.json 2>&1 | grep -v '^local-laya-shared@.*-> '; echo END node-lengths \$(date -u +%FT%TZ) load \$(cat /proc/loadavg)";;
esac
echo JOB_DONE $(date -u +%FT%TZ)
