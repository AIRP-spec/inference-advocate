#!/bin/bash
# relay_avg.sh SEED : pod /root/avg/<A> -> VPS .../shared-adopt/f07/avg/<A> (tar via box), then sha256sum -c on the VPS against the pod-written sha file.
set -o pipefail
SEED=$1; R=f07-s$SEED; A=avg-$R-ep2.0-2.5-3.0; VD=/root/primitives-evaluator/decide-2026-10-13/shared-adopt/f07/avg
S="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ServerAliveInterval=15 -i $HOME/.ssh/runpod_airp -p 23902 root@213.173.102.179"
V="ssh -o ServerAliveInterval=15 -i $HOME/.ssh/himalogic_ed25519 -p 2060 root@203.134.250.85"
echo RELAY_START $A $(date -u +%FT%TZ)
$S "cd /root/avg && tar c $A" | $V "mkdir -p $VD && tar x -C $VD"; echo RELAY_RC $? $(date -u +%FT%TZ)
$V "cd $VD && cat > $A.sha256" < /workspace/airp/decide/shared-adopt/f07/pod/out/avg-meta/$A.sha256
$V "cd $VD && sha256sum -c --quiet $A.sha256 && echo VPS_AVG_SHA_OK $A \$(wc -l < $A.sha256)"; echo VERIFY_RC $? $(date -u +%FT%TZ)
