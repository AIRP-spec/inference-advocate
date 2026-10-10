#!/usr/bin/env python3
"""Step 3: verify checkpoint archives against recorded SHAs, extract the checkpoints used,
and hash every file of each extracted checkpoint against the bytes inside the verified archive.
Writes logs/weights-verify.json. No file in any archive is modified."""
import hashlib, json, os, sys, tarfile, time
ROOT = "/workspace/airp/decide/step3"
# NOTE: the box copy /workspace/airp/task1/archive/task1-retrain-checkpoints.tar is truncated
# (4,951,357,440 B vs 5,081,057,280 B on the VPS; sha a5d40bec... != recorded 385ef23d...), so ckpt 9610
# is verified and extracted from the VPS copy by scripts/vps_extract_9610.sh instead.
REC = {
    "/workspace/airp-laya-artifacts/airp-laya-20260929-bf16-complete.tgz":
        ("5d775b06a98a94835cb135d159a8ef2fd79947cfecac2618cd5a8469c05321c8",
         "airp-laya-artifacts/last-archive.json + .sha256 + task1 REPORT section 1"),
}
WANT = {"/workspace/airp/task1/archive/task1-retrain-checkpoints.tar": "ckpt-epoch-2.5-step-9610",
        "/workspace/airp-laya-artifacts/airp-laya-20260929-bf16-complete.tgz": "ckpt-epoch-2.6-step-10160"}
def sha_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 22), b""): h.update(b)
    return h.hexdigest()
out = {"archives": {}, "checkpoints": {}}
for arc, (want, src) in REC.items():
    t = time.time(); got = sha_file(arc)
    out["archives"][arc] = {"sha256": got, "recorded": want, "recorded_in": src, "ok": got == want}
    print(arc, got, "OK" if got == want else "MISMATCH", f"{time.time()-t:.0f}s", flush=True)
    if got != want: json.dump(out, open(f"{ROOT}/logs/weights-verify.json", "w"), indent=1); sys.exit(2)
    name = WANT[arc]; dest = f"{ROOT}/ckpt/{name}"; files = {}
    with tarfile.open(arc, "r:*") as tf:
        for m in tf:
            parts = m.name.split("/")
            if name not in parts or not m.isfile(): continue
            rel = "/".join(parts[parts.index(name) + 1:])
            h = hashlib.sha256(); os.makedirs(os.path.dirname(f"{dest}/{rel}"), exist_ok=True)
            src_f = tf.extractfile(m)
            with open(f"{dest}/{rel}", "wb") as w:
                for b in iter(lambda: src_f.read(1 << 22), b""): h.update(b); w.write(b)
            files[rel] = {"sha256_in_archive": h.hexdigest(), "size": m.size, "member": m.name}
    for rel, d in files.items():
        d["sha256_extracted"] = sha_file(f"{dest}/{rel}"); d["ok"] = d["sha256_extracted"] == d["sha256_in_archive"]
    out["checkpoints"][name] = {"archive": arc, "dest": dest, "files": files, "ok": all(d["ok"] for d in files.values()) and "model.safetensors" in files}
    print(name, "files", len(files), "ok", out["checkpoints"][name]["ok"], files.get("model.safetensors", {}).get("sha256_extracted"), flush=True)
json.dump(out, open(f"{ROOT}/logs/weights-verify.json", "w"), indent=1)
print("VERIFY_DONE", all(c["ok"] for c in out["checkpoints"].values()))
