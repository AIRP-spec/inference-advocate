#!/bin/bash
set -o pipefail
VD=/root/primitives-evaluator/decide-2026-10-13/shared-adopt/f07/volume
echo COPY_START $(date -u +%FT%TZ)
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ServerAliveInterval=15 -i $HOME/.ssh/runpod_airp -p 30455 root@213.173.105.108 'cd /workspace && tar c --exclude=f07/__pycache__ f07' | ssh -o ServerAliveInterval=15 -i $HOME/.ssh/himalogic_ed25519 -p 2060 root@203.134.250.85 "mkdir -p $VD && tar x -C $VD"
echo COPY_RC $? $(date -u +%FT%TZ)
ssh -i $HOME/.ssh/himalogic_ed25519 -p 2060 root@203.134.250.85 "cd $VD && sha256sum f07/MANIFEST-volume-f07.sha256 && sha256sum -c --quiet f07/MANIFEST-volume-f07.sha256 && echo VPS_SHA_OK \$(wc -l < f07/MANIFEST-volume-f07.sha256); df -h / | tail -1"
echo VERIFY_RC $? $(date -u +%FT%TZ)
