#!/usr/bin/env python3
"""Raw logits from the exported fp32 ONNX (same schema as infer_raw_shared.py) + parity vs the torch raw logits."""
import argparse, json
from pathlib import Path
import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer
from common_shared import encode_response, load_jsonl, state_text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--onnx", required=True); ap.add_argument("--ckpt", required=True); ap.add_argument("--suite", required=True)
    ap.add_argument("--torch-raw", required=True, help="torch heldout.jsonl for the same checkpoint"); ap.add_argument("--out", required=True)
    ap.add_argument("--device", default="cpu")
    a = ap.parse_args()
    sc = json.load(open(Path(a.ckpt) / "shared_config.json")); tok = AutoTokenizer.from_pretrained(str(Path(a.ckpt) / "tokenizer"))
    prov = ["CPUExecutionProvider"] if a.device == "cpu" else ["CUDAExecutionProvider", "CPUExecutionProvider"]
    s = ort.InferenceSession(a.onnx, providers=prov)
    ref = {r["id"]: r for r in load_jsonl(a.torch_raw)}
    suite = json.load(open(a.suite))["items"]
    qids, widths = sc["qids"], sc["widths"]
    worst, flips, stance_flips, n = 0.0, 0, 0, 0
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    with open(a.out, "w") as f:
        for it in suite:
            ids, ntok = encode_response(tok, state_text(it), sc["max_len"])
            o = s.run(["logits"], {"input_ids": np.asarray([ids], dtype=np.int64)})[0][0]
            lg = {q: [float(x) for x in o[j, : widths[j]]] for j, q in enumerate(qids)}
            r = ref[it["id"]]["logits"]
            for q in qids:
                worst = max(worst, float(np.abs(np.array(lg[q]) - np.array(r[q])).max()))
                if widths[qids.index(q)] == 2:
                    flips += int((lg[q][1] >= lg[q][0]) != (r[q][1] >= r[q][0]))   # P(true) >= 0.5  <=>  z_true >= z_false
                else:
                    stance_flips += int(np.argmax(lg[q]) != np.argmax(r[q]))
            n += 1
            st = lg["stance"]; p1 = {q: float(np.exp(lg[q][1]) / (np.exp(lg[q][0]) + np.exp(lg[q][1]))) for q in qids if widths[qids.index(q)] == 2}
            f.write(json.dumps({"id": it["id"], "state_tokens": ntok, "seq_len_max": len(ids), "truncated": False, "logits": lg, "noul_p_T1": p1}) + "\n")
    rep = {"n": n, "max_abs_logit_delta_vs_torch": worst, "yes_no_flips": flips, "stance_flips": stance_flips, "device": a.device, "onnx": Path(a.onnx).name}
    json.dump(rep, open(a.out + ".parity.json", "w"), indent=1); print("PARITY", json.dumps(rep))


if __name__ == "__main__":
    main()
