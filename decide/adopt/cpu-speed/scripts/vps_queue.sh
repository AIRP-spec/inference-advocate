#!/bin/bash
# Waits for any other agent's VPS benchmark job (Task 4 node bench etc.) to finish, then runs the given script.
# Deliberately not named vps_run.sh, so other jobs' idle checks do not see a queued (idle) Task 3 job.
while pgrep -f "bench_latency_laya_node|bench_latency|llama-server|score-per-primitive" >/dev/null; do echo "$(date -u +%T) queued behind: $(pgrep -fa 'bench_latency' | grep -v pgrep | cut -c1-80 | tr '\n' ' ')"; sleep 30; done
exec "$@"
