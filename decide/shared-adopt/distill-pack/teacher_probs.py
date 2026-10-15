#!/usr/bin/env python3
"""Teacher soft targets for distillation: run each teacher checkpoint (fp32, T=1, batch 1) on TRAIN rows only, softmax per head,
average uniformly across teachers. Output jsonl: {"row_id", "soft": {qid: [probs over head width]}}. Never reads val or held-out."""
import argparse, json, time
from pathlib import Path
import torch
from transformers import AutoTokenizer
from common_shared import assert_questions_pin, encode_response, load_jsonl, state_text
from shared_model import build_for_inference
ap = argparse.ArgumentParser(); ap.add_argument("--ckpt", action="append", required=True); ap.add_argument("--questions", required=True)
ap.add_argument("--train", required=True); ap.add_argument("--out", required=True); ap.add_argument("--threads", type=int, default=8)
a = ap.parse_args(); torch.set_num_threads(a.threads)
qs = json.load(open(a.questions)); assert_questions_pin(qs)
rows = load_jsonl(a.train); assert all(not str(r["id"]).startswith(("v0-", "ho")) for r in rows)
acc = None
for ck in a.ckpt:
    model, sc = build_for_inference(Path(ck), "cpu"); tok = AutoTokenizer.from_pretrained(str(Path(ck) / "tokenizer"))
    qids, widths = sc["qids"], sc["widths"]; t0 = time.time(); cur = []
    for r in rows:
        ids, _ = encode_response(tok, state_text(r), sc["max_len"])
        with torch.no_grad(): out = model(torch.tensor([ids])).float()[0]
        cur.append({q: torch.softmax(out[j, : widths[j]], -1).tolist() for j, q in enumerate(qids)})
    acc = cur if acc is None else [{q: [x + y for x, y in zip(A[q], C[q])] for q in A} for A, C in zip(acc, cur)]
    print(ck, len(rows), f"{time.time()-t0:.0f}s", flush=True); del model
n = len(a.ckpt)
with open(a.out, "w") as f:
    for r, A in zip(rows, acc): f.write(json.dumps({"row_id": r["id"], "soft": {q: [x / n for x in v] for q, v in A.items()}}) + "\n")
print("WROTE", a.out, n, "teachers")
