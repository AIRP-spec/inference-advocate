#!/usr/bin/env python3
"""EXPLORATORY. Uniform weight average of N SharedModel checkpoints from ONE run (every tensor in model.safetensors).
Accumulate in fp32, store in the source dtype (fp16, as train_shared.save_checkpoint stores). Sidecars copied from the last source."""
import argparse, json, shutil, hashlib
from pathlib import Path
import torch
from safetensors.torch import load_file, save_file
ap = argparse.ArgumentParser(); ap.add_argument("--src", action="append", required=True); ap.add_argument("--out", required=True); a = ap.parse_args()
S = [Path(s) for s in a.src]; po = Path(a.out); po.mkdir(parents=True, exist_ok=True)
for s in S: assert json.load(open(s / "shared_config.json")) == json.load(open(S[-1] / "shared_config.json")), s
shutil.copy2(S[-1] / "shared_config.json", po / "shared_config.json")
for d in ("tokenizer", "encoder"):
    if not (po / d).exists(): shutil.copytree(S[-1] / d, po / d)
acc, dt = None, None
for s in S:
    t = load_file(str(s / "model.safetensors"))
    if acc is None: acc = {k: v.float().clone() for k, v in t.items()}; dt = {k: v.dtype for k, v in t.items()}
    else:
        assert set(t) == set(acc)
        for k, v in t.items(): assert v.shape == acc[k].shape and v.dtype == dt[k]; acc[k] += v.float()
    del t
out = {k: (v / len(S)).to(dt[k]).contiguous() for k, v in acc.items()}
save_file(out, str(po / "model.safetensors"))
h = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
meta = {"EXPLORATORY": True, "method": f"uniform mean 1/{len(S)} (fp32 accumulate, stored {sorted(set(map(str, dt.values())))})", "n_tensors": len(out),
        "sources": [{"ckpt": str(s), "model_sha256": h(s / "model.safetensors")} for s in S], "model_sha256": h(po / "model.safetensors")}
(po / "average-meta.json").write_text(json.dumps(meta, indent=1) + "\n"); print("AVG_DONE", po, meta["model_sha256"])
