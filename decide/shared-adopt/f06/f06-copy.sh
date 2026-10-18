#!/bin/bash
set -o pipefail
VD=/root/primitives-evaluator/decide-2026-10-13/shared-adopt/f06/volume
echo COPY_START $(date -u +%FT%TZ)
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ServerAliveInterval=15 -i $HOME/.ssh/runpod_airp -p 40695 root@213.173.105.95 'cd /workspace && tar c --exclude=f06/__pycache__ f06' | ssh -o ServerAliveInterval=15 -i $HOME/.ssh/himalogic_ed25519 -p 2060 root@203.134.250.85 "mkdir -p $VD && tar x -C $VD"
echo COPY_RC $? $(date -u +%FT%TZ)
ssh -i $HOME/.ssh/himalogic_ed25519 -p 2060 root@203.134.250.85 "cd $VD && sha256sum f06/MANIFEST-volume-f06.sha256 && sha256sum -c --quiet f06/MANIFEST-volume-f06.sha256 && echo VPS_SHA_OK \$(wc -l < f06/MANIFEST-volume-f06.sha256); df -h / | tail -1"
echo VERIFY_RC $? $(date -u +%FT%TZ)
