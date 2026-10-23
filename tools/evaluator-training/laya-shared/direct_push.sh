#!/bin/bash
# usage: direct_push.sh <relative paths on pod, space-separated> ; streams pod -> VPS (agent-forwarded key, never copied to the pod)
cd /workspace/airp/decide/followup/shared; source logs/agent.env; export SSH_AUTH_SOCK; read IP PORT < logs/pod-ssh.txt
R=/root/primitives-evaluator/decide-2026-10-06/followup/shared/archive/pod
ssh -A -i $HOME/.ssh/runpod_airp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -p $PORT root@$IP "cd /workspace/shared3b && tar -cf - $* | ssh -p 2060 -o StrictHostKeyChecking=no -o LogLevel=ERROR root@203.134.250.85 'mkdir -p $R && tar -xf - -C $R'" && echo "DIRECT_PUSHED $* $(date -u +%T)"
