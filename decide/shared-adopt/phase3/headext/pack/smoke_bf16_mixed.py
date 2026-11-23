#!/usr/bin/env python3
"""Standing pre-pod check (t226u item 1, A30): mixed long/short bf16 batches through the real base encoder + 25 heads.

Builds deterministic micro-batches of 8 from data-v10 train (ids and token counts only; no text is printed):
  B1 = the 1 shortest row + the 7 longest rows (padding far past 128 tokens on the short row),
  B2 = the 4 shortest + the 4 longest rows,
  B3 = 8 rows evenly spaced in token length.
For each attention implementation: bf16 autocast forward in eval mode (all outputs at real rows must be finite) and a
train-mode forward + backward of the summed outputs (gradient checkpointing on, as train_shared) (loss and every gradient must be finite).
Exit 0 only if every implementation listed in --require-finite is finite everywhere. Implementations in --attn but not
in --require-finite are reported only (the sdpa reproduction).
  smoke_bf16_mixed.py --model-dir BASE --train data-v10/train.jsonl --device cpu|cuda --attn sdpa,eager --require-finite eager --out J"""
import argparse, gc, json, sys, time
from pathlib import Path

import torch
from transformers import AutoTokenizer

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common_shared import encode_response, load_jsonl, state_text  # noqa: E402
from shared_model import load_base  # noqa: E402

MB = 8


def batches(lens):
    order = sorted(range(len(lens)), key=lambda i: (lens[i], i))
    n = len(order)
    b1 = [order[0]] + order[-7:]
    b2 = order[:4] + order[-4:]
    b3 = [order[round(k * (n - 1) / 7)] for k in range(8)]
    return {"B1_1short_7long": b1, "B2_4short_4long": b2, "B3_spread": b3}


def collate(seqs, pad):
    L = max(len(s) for s in seqs)
    ids = torch.full((len(seqs), L), pad, dtype=torch.long)
    att = torch.zeros((len(seqs), L), dtype=torch.long)
    for i, s in enumerate(seqs):
        ids[i, : len(s)] = torch.tensor(s); att[i, : len(s)] = 1
    return ids, att


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-dir", required=True)
    ap.add_argument("--train", required=True)
    ap.add_argument("--device", default="cpu")
    ap.add_argument("--attn", default="sdpa,eager")
    ap.add_argument("--require-finite", default="eager")
    ap.add_argument("--n-questions", type=int, default=25)
    ap.add_argument("--max-len", type=int, default=1024)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    dev = torch.device(a.device)
    tok = AutoTokenizer.from_pretrained(str(Path(a.model_dir) / "tokenizer"))
    rows = load_jsonl(a.train)
    seqs = [encode_response(tok, state_text(r), a.max_len)[0] for r in rows]
    lens = [len(s) for s in seqs]
    bs = batches(lens)
    report = {"train_rows": len(rows), "max_seq_len": max(lens), "rows_over_128": sum(l > 128 for l in lens), "device": a.device,
              "dtype": "bf16 autocast", "batches": {k: {"ids": [rows[i]["id"] for i in v], "seq_lens": [lens[i] for i in v],
                                                         "max_pad": max(lens[i] for i in v) - min(lens[i] for i in v)}
                                                     for k, v in bs.items()}, "results": {}}
    ok = True
    for impl in [x for x in a.attn.split(",") if x]:
        torch.manual_seed(7)
        model, _ = load_base(a.model_dir, a.n_questions, attn=impl)
        if hasattr(model.encoder, "gradient_checkpointing_enable"):  # as train_shared (memory only; same numbers)
            model.encoder.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
        model.to(dev)
        assert model.encoder.config._attn_implementation == impl
        res = {}
        for name, idx in bs.items():
            ids, att = collate([seqs[i] for i in idx], tok.pad_token_id)
            ids, att = ids.to(dev), att.to(dev)
            t0 = time.time()
            model.eval()
            with torch.no_grad(), torch.autocast(dev.type, dtype=torch.bfloat16):
                out = model(ids, att).float()
            bad_rows = sorted(set(torch.nonzero(~torch.isfinite(out))[:, 0].tolist()))
            model.train(); model.zero_grad(set_to_none=True)
            with torch.autocast(dev.type, dtype=torch.bfloat16):
                loss = model(ids, att).float().sum()
            loss.backward()
            grads_finite = all(torch.isfinite(p.grad).all().item() for p in model.parameters() if p.grad is not None)
            r = {"eval_nonfinite_rows": len(bad_rows), "eval_nonfinite_row_ids": [rows[idx[i]]["id"] for i in bad_rows],
                 "train_loss_finite": bool(torch.isfinite(loss).item()), "grads_finite": bool(grads_finite),
                 "sec": round(time.time() - t0, 1)}
            r["finite"] = r["eval_nonfinite_rows"] == 0 and r["train_loss_finite"] and r["grads_finite"]
            res[name] = r
            print(f"SMOKE {impl} {name} seq_lens={report['batches'][name]['seq_lens']} nonfinite_rows={r['eval_nonfinite_rows']} "
                  f"loss_finite={r['train_loss_finite']} grads_finite={r['grads_finite']}", flush=True)
        res["all_finite"] = all(v["finite"] for v in res.values() if isinstance(v, dict))
        report["results"][impl] = res
        if impl in a.require_finite.split(",") and not res["all_finite"]:
            ok = False
        model.zero_grad(set_to_none=True); del model, out, loss; gc.collect()
        if dev.type == "cuda":
            torch.cuda.empty_cache()
    report["pass"] = ok
    if a.out:
        Path(a.out).write_text(json.dumps(report, indent=1) + "\n")
    print("SMOKE_BF16_MIXED", "PASS" if ok else "FAIL", json.dumps({k: v["all_finite"] for k, v in report["results"].items()}), flush=True)
    return 0 if ok else 3


if __name__ == "__main__":
    sys.exit(main())
