#!/usr/bin/env python3
"""Raw-logit inference for shared-encoding checkpoints (fp32, T=1, batch 1, no padding, no autocast).
Output per checkpoint: <out>/<ckpt>/{val,heldout}.jsonl in the same schema as the deciding run's infer_raw.py."""
import argparse, json, time
from pathlib import Path

import torch
from transformers import AutoTokenizer

from common_shared import MAX_LEN, assert_questions_pin, encode_response, load_jsonl, state_text
from shared_model import build_for_inference


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", action="append", required=True)
    ap.add_argument("--questions", required=True)
    ap.add_argument("--val", required=True)
    ap.add_argument("--suite", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--device", default="cuda")
    a = ap.parse_args()
    qs = json.load(open(a.questions)); assert_questions_pin(qs)
    val = load_jsonl(a.val)
    suite = json.load(open(a.suite))["items"]
    for ck in a.ckpt:
        ckp = Path(ck)
        od = Path(a.out) / ckp.name; od.mkdir(parents=True, exist_ok=True)
        model, sc = build_for_inference(ckp, a.device)
        tok = AutoTokenizer.from_pretrained(str(ckp / "tokenizer"))
        qids, widths = sc["qids"], sc["widths"]
        stance_keys = list(qs["stance"]["criteria"].keys())
        for split, rows in (("val", val), ("heldout", suite)):
            t0 = time.time()
            with open(od / f"{split}.jsonl", "w") as f:
                for r in rows:
                    ids, ntok = encode_response(tok, state_text(r), sc["max_len"])
                    with torch.no_grad():
                        out = model(torch.tensor([ids], device=a.device)).float()[0].cpu()
                    logits = {q: [float(x) for x in out[j, : widths[j]]] for j, q in enumerate(qids)}
                    st = logits["stance"]
                    p1 = {q: float(torch.softmax(torch.tensor(logits[q]), -1)[1]) for q in qids if qs[q]["type"] == "noul"}
                    rec = {"id": r["id"], "state_tokens": ntok, "seq_len_max": len(ids), "truncated": ntok > sc["max_len"] - 2,
                           "logits": logits, "stance_choice": stance_keys[max(range(len(st)), key=lambda i: st[i])], "noul_p_T1": p1}
                    f.write(json.dumps(rec) + "\n")
            print(f"{ckp.name} {split} n={len(rows)} {time.time()-t0:.1f}s", flush=True)
        del model
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


if __name__ == "__main__":
    main()
