#!/bin/bash
# Wait for each seed avg; relay to VPS; safety-gate. Stop only on safety miss. Do not look at E+M.
set -uo pipefail
F=/workspace/airp/decide/shared-adopt/f10
IP=$(awk '{print $1}' $F/gpu-ssh.txt); PORT=$(awk '{print $2}' $F/gpu-ssh.txt)
S="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=20 -i $HOME/.ssh/runpod_airp -p $PORT root@$IP"
DEADLINE=$(($(date +%s)+7800))
for SEED in 27 28 29; do
  R=f10-s$SEED
  echo "WAITING avg $R $(date -u +%T)"
  while true; do
    NOW=$(date +%s); [ $NOW -lt $DEADLINE ] || { echo TIMEOUT; exit 8; }
    st=$($S "test -f /workspace/f10/out/raw-avg/$R/.done && echo DONE || (pgrep -af 'train_shared|infer_raw|average_n'|grep -v pgrep|head -1; tail -1 /workspace/f10/logs/train-$R.log 2>/dev/null | tr -d '\r'; test -f /workspace/f10/out/raw/$R/.done && echo RAW_DONE_$R || true)" || echo SSH_FAIL)
    echo "  $(date -u +%T) $st"
    if echo "$st" | grep -q '^DONE$'; then break; fi
    if echo "$st" | grep -qE 'VOLUME_LOW|AVG_FAILED|RUN_FAILED|PIPE_EXIT=[1-9]'; then
      echo FAIL_SIGNAL; $S 'tail -50 /workspace/f10/logs/pipeline.log'; exit 9
    fi
    sleep 45
  done
  echo "RELAY+PULL+SAFETY $R $(date -u +%T)"
  bash $F/pull_seed_safety.sh $SEED | tee -a $F/relay-s$SEED.log
  bash $F/relay_avg.sh $SEED | tee -a $F/relay-s$SEED.log
  echo "SEED $SEED SAFETY_OK $(date -u +%T)"
done
echo ALL_SEEDS_SAFETY_PASS $(date -u +%T)
