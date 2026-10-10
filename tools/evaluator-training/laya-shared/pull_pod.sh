#!/bin/bash
# usage: pull_pod.sh <remote-subdir-relative-to-/workspace/shared3b> ; streams tar from pod into archive/pod/
cd /workspace/airp/decide/followup/shared; read IP PORT < logs/pod-ssh.txt
ssh -i $HOME/.ssh/runpod_airp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -p $PORT root@$IP "cd /workspace/shared3b && tar -cf - $1" | tar -xf - -C archive/pod && echo "PULLED $1 $(date -u +%T)"
