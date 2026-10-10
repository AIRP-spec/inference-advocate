#!/bin/bash
# Task 3 step 4: ModernBERT-base Laya retrain on RunPod. create -> upload pack -> setup+train+post-infer ->
# pull -> archive to Nepal VPS (MANIFEST, remote sha verify) -> terminate -> confirm. Spend logged.
set -uo pipefail
B=/workspace/airp/decide/adopt/cpu-speed/base
LOG=$B/logs/orchestrate.log; exec >>"$LOG" 2>&1
NPT(){ TZ=Asia/Kathmandu date '+%F %T NPT'; }
echo "ORCH_START $(NPT)"
cd $B
tar -czf $B/base-trainpack.tgz -C $B pack && sha256sum $B/base-trainpack.tgz | tee $B/base-trainpack.tgz.sha256
python3 pod.py create > logs/pod-create.json || { echo "POD_CREATE_FAILED"; echo "BLOCKED: no GPU pod available" > $B/BLOCKED-pod.md; exit 3; }
POD=$(python3 -c "import json;print(json.load(open('logs/pod-create.json'))['podFindAndDeployOnDemand']['id'])")
RATE=$(python3 -c "import json;print(json.load(open('logs/pod-create.json'))['podFindAndDeployOnDemand']['costPerHr'])")
echo "$POD" > logs/pod-id.txt; echo "POD $POD rate \$$RATE/hr $(NPT)"; cat logs/pod-create.json
read IP PORT < <(python3 pod.py ssh $POD) || true
if [ -z "${PORT:-}" ]; then echo "NO_SSH — terminating"; python3 pod.py terminate $POD; exit 4; fi
echo "$IP $PORT" > logs/pod-ssh.txt; echo "SSH $IP:$PORT"
SSH=(ssh -i ~/.ssh/runpod_airp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=30 -o ServerAliveInterval=30 -p "$PORT" root@"$IP")
SCP=(scp -i ~/.ssh/runpod_airp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -P "$PORT")
for i in $(seq 1 30); do "${SSH[@]}" true && break; sleep 10; done
"${SCP[@]}" $B/base-trainpack.tgz root@"$IP":/workspace/ || { echo UPLOAD_FAIL; python3 pod.py terminate $POD; exit 5; }
"${SSH[@]}" 'cd /workspace && sha256sum base-trainpack.tgz && rm -rf adopt-base-laya && mkdir adopt-base-laya && tar -xzf base-trainpack.tgz -C adopt-base-laya --strip-components=1 && cd adopt-base-laya && mkdir -p logs && (setsid nohup bash -c "bash setup-and-train.sh > logs/setup-train.nohup 2>&1; bash post-train-infer.sh > logs/post-infer.log 2>&1" > /dev/null 2>&1 < /dev/null &) ; sleep 2; ls'
echo "LAUNCHED $(NPT)"
T0=$(date +%s)
while true; do
  sleep 120
  if "${SSH[@]}" 'grep -q POST_INFER_DONE /workspace/adopt-base-laya/logs/post-infer.log 2>/dev/null'; then echo "POST_INFER_DONE_SEEN $(NPT)"; break; fi
  st=$("${SSH[@]}" 'cd /workspace/adopt-base-laya; tail -c 300 logs/train.log 2>/dev/null | tr "\r" "\n" | tail -1; ls checkpoints 2>/dev/null | tr "\n" " "; pgrep -f "train_airp|infer_raw|bench_latency|pip|setup-and-train" >/dev/null && echo ALIVE || echo DEAD' 2>&1)
  echo "$(NPT) $st"
  if echo "$st" | grep -q DEAD; then
    if ! "${SSH[@]}" 'grep -q POST_INFER_DONE /workspace/adopt-base-laya/logs/post-infer.log 2>/dev/null'; then
      echo "PIPELINE_DEAD"; "${SSH[@]}" 'cd /workspace/adopt-base-laya; tail -40 logs/setup-train.nohup; tail -40 logs/train.log; tail -40 logs/post-infer.log' ; break
    fi
  fi
  if [ $(( $(date +%s) - T0 )) -gt 18000 ]; then echo "TIMEOUT_5H"; break; fi
done
# pull whatever exists
"${SSH[@]}" 'cd /workspace/adopt-base-laya && tar -czf /tmp/base-out.tgz out checkpoints logs pins.json data/split-meta.json data/train.jsonl data/val.jsonl data/held-out-suite.v2.json data/laya-questions.json training-meta.json preprocessed/preprocess-meta.json train_airp.py setup-and-train.sh post-train-infer.sh launch-retrain.sh 2>/dev/null; ls -la /tmp/base-out.tgz; sha256sum /tmp/base-out.tgz'
mkdir -p $B/out
"${SCP[@]}" root@"$IP":/tmp/base-out.tgz $B/out/base-out.tgz && sha256sum $B/out/base-out.tgz
rm -rf $B/out/extract && mkdir -p $B/out/extract && tar -xzf $B/out/base-out.tgz -C $B/out/extract && echo "PULL_OK $(du -sh $B/out/base-out.tgz)"
ST=$B/archive-staging; rm -rf $ST && mkdir -p $ST/meta
cp $B/out/base-out.tgz $ST/; cp $B/base-trainpack.tgz $ST/meta/; cp $B/logs/pod-create.json $B/logs/pod-id.txt $ST/meta/
AIRP_ARCHIVE_REMOTE=/root/primitives-evaluator/decide-2026-10-06/adopt/cpu-speed/base-pod python3 /workspace/airp/decide/step4/scripts/archive_to_vps.py $ST | tee $B/logs/archive.log
if grep -q ARCHIVE_OK $B/logs/archive.log; then
  UP=$(python3 -c "import json,subprocess;p=json.loads(subprocess.check_output(['python3','$B/pod.py','status','$POD']));print(p['runtime']['uptimeInSeconds'] if p and p.get('runtime') else 0)")
  COST=$(python3 -c "print(f'{$UP/3600*$RATE:.2f}')")
  echo "TERMINATE $POD up=${UP}s cost=\$$COST $(NPT)"
  echo "$UP $RATE" > $B/logs/pod-uptime-rate.txt
  python3 pod.py terminate $POD; sleep 10
  python3 pod.py pods | python3 -c "import json,sys;ps=json.load(sys.stdin);print('PODS_AFTER', [p['id'] for p in ps]);sys.exit(1 if any(p['id']=='$POD' for p in ps) else 0)" && echo "TERMINATED_CONFIRMED $(NPT)"
else
  echo "ARCHIVE_FAILED — pod $POD LEFT RUNNING for manual archive"; echo "BLOCKED: archive failed, pod $POD running" > $B/BLOCKED-archive.md
fi
echo ORCH_DONE
