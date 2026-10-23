#!/bin/bash
# usage: push_vps.sh <local path under archive/> [bwlimit KB/s]  (rsync to VPS followup/shared, nice'd; resumable)
cd /workspace/airp/decide/followup/shared/archive
BW=${2:-2000}
rsync -a --partial --exclude "*.box-store-snap-*" --bwlimit=$BW -e "ssh -i $HOME/.ssh/himalogic_ed25519 -p 2060" "$1" root@203.134.250.85:/root/primitives-evaluator/decide-2026-10-06/followup/shared/archive/ && echo "PUSHED $1 $(date -u +%T)"
