"""FRESH-06 RunPod helper (key via rp.key() inside rp.py; never printed). gpu: SECURE RTX 4090 on network volume rmn62wuuzx (EU-RO-1), no HF token
(base model is public; HF cache on the volume). cpu: CPU pod on the same volume (REST). ssh/status/terminate/pods."""
import json, os, sys, time
sys.path.insert(0, '/workspace/airp/decide/step4/scripts'); import rp
sys.path.insert(0, '/workspace/airp/decide/shared-adopt/f05'); import rp_cpu
VOL = "rmn62wuuzx"
cmd = sys.argv[1]
if cmd == "gpu":
    pub = open(os.path.expanduser("~/.ssh/runpod_airp.pub")).read().strip()
    inp = {"cloudType": "SECURE", "gpuCount": 1, "containerDiskInGb": 40, "minVcpuCount": 8, "minMemoryInGb": 30,
           "gpuTypeId": "NVIDIA GeForce RTX 4090", "name": "airp-f07-gpu", "imageName": "runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04",
           "ports": "22/tcp", "volumeMountPath": "/workspace", "startSsh": True, "networkVolumeId": VOL, "dataCenterId": "EU-RO-1",
           "env": [{"key": "PUBLIC_KEY", "value": pub}]}
    print(json.dumps(rp.gql("mutation($i: PodFindAndDeployOnDemandInput) { podFindAndDeployOnDemand(input: $i) { id name costPerHr desiredStatus machine { gpuTypeId } } }", {"i": inp})))
elif cmd == "cpu":
    pub = open(os.path.expanduser("~/.ssh/runpod_airp.pub")).read().strip()
    body = {"name": "airp-f07-cpu-copy", "computeType": "CPU", "cloudType": "SECURE", "cpuFlavorIds": ["cpu3c", "cpu5c", "cpu3g", "cpu5g"],
            "vcpuCount": 2, "dataCenterIds": ["EU-RO-1"], "networkVolumeId": VOL, "volumeMountPath": "/workspace",
            "containerDiskInGb": 10, "imageName": "runpod/base:0.6.2-cpu", "ports": ["22/tcp"], "env": {"PUBLIC_KEY": pub}}
    r = rp_cpu.rest("POST", "/pods", body); print(json.dumps({k: r.get(k) for k in ("id", "name", "costPerHr", "desiredStatus")}))
elif cmd == "ssh":
    for _ in range(90):
        s = rp.status(sys.argv[2]); ports = ((s or {}).get("runtime") or {}).get("ports") or []
        for p in ports:
            if p["privatePort"] == 22 and p["isIpPublic"]: print(p["ip"], p["publicPort"]); sys.exit(0)
        time.sleep(10)
    sys.exit(4)
elif cmd == "pods": print(json.dumps([(p["id"], p["name"], p["desiredStatus"], p["costPerHr"]) for p in rp.pods()]))
elif cmd == "terminate": print(json.dumps(rp.terminate(sys.argv[2])))
elif cmd == "balance": print(json.dumps(rp.gql("query { myself { clientBalance currentSpendPerHr } }")))
