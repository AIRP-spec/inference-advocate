#!/bin/bash
set -o pipefail
SEED=$1; R=f10-s$SEED; A=avg-$R-ep2.0-2.5-3.0; VD=/root/primitives-evaluator/decide-2026-10-13/shared-adopt/f10/avg
# SSH target filled by monitor after pod up (f10/gpu-ssh.txt)
IP=$(awk '{print $1}' /workspace/airp/decide/shared-adopt/f10/gpu-ssh.txt)
PORT=$(awk '{print $2}' /workspace/airp/decide/shared-adopt/f10/gpu-ssh.txt)
S="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ServerAliveInterval=15 -i $HOME/.ssh/runpod_airp -p $PORT root@$IP"
V="ssh -o ServerAliveInterval=15 -i $HOME/.ssh/himalogic_ed25519 -p 2060 root@203.134.250.85"
echo RELAY_START $A $(date -u +%FT%TZ)
$S "cd /root/avg && tar c $A" | $V "mkdir -p $VD && tar x -C $VD"; echo RELAY_RC $? $(date -u +%FT%TZ)
$V "cd $VD && cat > $A.sha256" < /workspace/airp/decide/shared-adopt/f10/pod/out/avg-meta/$A.sha256
$V "cd $VD && sha256sum -c --quiet $A.sha256 && echo VPS_AVG_SHA_OK $A \$(wc -l < $A.sha256)"; echo VERIFY_RC $? $(date -u +%FT%TZ)
