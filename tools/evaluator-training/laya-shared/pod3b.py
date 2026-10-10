#!/usr/bin/env python3
"""RunPod helper for 3b (wraps decide/step4/scripts/rp.py). create: RTX 4090 (same GPU as the 3a latency runs), COMMUNITY first (cheapest), then SECURE."""
import json, sys, time
sys.path.insert(0, "/workspace/airp/decide/step4/scripts")
import rp
cmd = sys.argv[1]
if cmd == "create":
    for cloud in ("COMMUNITY", "SECURE"):
        try:
            r = rp.create("airp-3b-shared", "NVIDIA GeForce RTX 4090", cloud=cloud, volume=80, disk=50, mem=30, vcpu=8)
            print(json.dumps(r)); sys.exit(0)
        except Exception as e:
            print(f"create failed {cloud}: {str(e)[:200]}", file=sys.stderr)
    sys.exit(3)
elif cmd == "ssh":
    pid = sys.argv[2]
    for _ in range(90):
        s = rp.status(pid)
        ports = ((s or {}).get("runtime") or {}).get("ports") or []
        for p in ports:
            if p["privatePort"] == 22 and p["isIpPublic"]:
                print(p["ip"], p["publicPort"]); sys.exit(0)
        time.sleep(10)
    sys.exit(4)
elif cmd == "status": print(json.dumps(rp.status(sys.argv[2]), indent=1))
elif cmd == "pods": print(json.dumps(rp.pods(), indent=1))
elif cmd == "terminate": print(json.dumps(rp.terminate(sys.argv[2])))
