#!/usr/bin/env python3
"""Task 3 step 4 RunPod helper (wraps decide/step4/scripts/rp.py). create tries GPUs in order, SECURE then COMMUNITY."""
import json, sys, time
sys.path.insert(0, "/workspace/airp/decide/step4/scripts")
import rp
GPUS = ["NVIDIA GeForce RTX 4090", "NVIDIA RTX A6000", "NVIDIA L40S", "NVIDIA RTX 6000 Ada Generation"]
cmd = sys.argv[1]
if cmd == "create":
    for cloud in ("SECURE", "COMMUNITY"):
        for g in GPUS:
            try:
                r = rp.create("airp-adopt-base-laya", g, cloud=cloud, volume=60, disk=40)
                print(json.dumps(r)); sys.exit(0)
            except Exception as e:
                print(f"create failed {cloud} {g}: {str(e)[:200]}", file=sys.stderr)
    sys.exit(3)
elif cmd == "ssh":   # wait for public ssh port; print "ip port"
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
