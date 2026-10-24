"""Create a CPU pod on network volume via Runpod REST (key via rp.key())."""
import json, os, sys, urllib.request, urllib.error
sys.path.insert(0, '/workspace/airp/decide/step4/scripts'); import rp
def rest(method, path, body=None):
    req = urllib.request.Request("https://rest.runpod.io/v1"+path, method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={"Content-Type":"application/json","Authorization":f"Bearer {rp.key()}","User-Agent":rp.UA})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: t=r.read().decode(); return json.loads(t) if t else {}
    except urllib.error.HTTPError as e: raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:800]}")
if __name__=="__main__":
    if sys.argv[1]=="create":
        pub=open(os.path.expanduser("~/.ssh/runpod_airp.pub")).read().strip()
        body={"name":"airp-f05-cpu-copy","computeType":"CPU","cloudType":"SECURE","cpuFlavorIds":["cpu3c","cpu5c","cpu3g","cpu5g"],
              "vcpuCount":2,"dataCenterIds":["EU-RO-1"],"networkVolumeId":"rmn62wuuzx","volumeMountPath":"/workspace",
              "containerDiskInGb":10,"imageName":"runpod/base:0.6.2-cpu","ports":["22/tcp"],"env":{"PUBLIC_KEY":pub}}
        print(json.dumps(rest("POST","/pods",body),indent=1))
    elif sys.argv[1]=="get": print(json.dumps(rest("GET","/pods/"+sys.argv[2]),indent=1))
