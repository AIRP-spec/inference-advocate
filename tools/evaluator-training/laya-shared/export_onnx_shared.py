#!/usr/bin/env python3
"""Export a shared-encoding checkpoint to fp32 ONNX: one encoder pass + 17 heads, input_ids [1, L] (dynamic L), output logits [1,17,5].
No attention mask input: batch 1 means nothing is padded (the S2c 'padding-free' property holds trivially)."""
import argparse, hashlib, json
from pathlib import Path

import numpy as np
import torch

from shared_model import build_for_inference


class Wrap(torch.nn.Module):
    def __init__(self, m):
        super().__init__(); self.m = m
    def forward(self, input_ids):
        return self.m(input_ids, None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--opset", type=int, default=17)
    a = ap.parse_args()
    m, sc = build_for_inference(a.ckpt, "cpu")
    w = Wrap(m).eval()
    ids = torch.randint(5, 1000, (1, 37))
    with torch.no_grad():
        ref = w(ids)
    torch.onnx.export(w, (ids,), a.out, input_names=["input_ids"], output_names=["logits"],
                      dynamic_axes={"input_ids": {1: "seq"}}, opset_version=a.opset, dynamo=False)
    import onnxruntime as ort
    s = ort.InferenceSession(a.out, providers=["CPUExecutionProvider"])
    worst = 0.0
    for L in (37, 5, 120, 513):
        x = torch.randint(5, 1000, (1, L))
        with torch.no_grad():
            r = w(x).numpy()
        o = s.run(["logits"], {"input_ids": x.numpy()})[0]
        worst = max(worst, float(np.abs(o - r).max()))
    sha = hashlib.sha256(open(a.out, "rb").read()).hexdigest()
    meta = {"ckpt": a.ckpt, "onnx": Path(a.out).name, "sha256": sha, "max_abs_logit_diff_vs_torch": worst, "opset": a.opset,
            "inputs": ["input_ids"], "outputs": ["logits [1,17,5]"], "qids": sc["qids"], "widths": sc["widths"], "max_len": sc["max_len"]}
    json.dump(meta, open(str(a.out) + ".meta.json", "w"), indent=1)
    print("EXPORT_DONE", json.dumps(meta))


if __name__ == "__main__":
    main()
