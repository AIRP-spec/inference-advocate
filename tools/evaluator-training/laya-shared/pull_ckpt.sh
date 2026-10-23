#!/bin/bash
# usage: pull_ckpt.sh <run: A|B> <ckpt dir name>   (tar stream pod -> archive/pod/checkpoints-<run>/)
cd /workspace/airp/decide/followup/shared; read IP PORT < logs/pod-ssh.txt; mkdir -p archive/pod
ssh -i $HOME/.ssh/runpod_airp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -p $PORT root@$IP "cd /workspace/shared3b && tar -cf - checkpoints-$1/$2" | tar -xf - -C archive/pod && echo "PULLED $1/$2 $(date -u +%T)"
