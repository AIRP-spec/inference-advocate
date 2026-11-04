#!/usr/bin/env python3
"""A30 (t226u item 1): no-GPU equivalence of encoder attention sdpa (default) vs eager on a trained checkpoint.

Scores one checkpoint on the data-v10 validation rows (pinned sha) in several modes and compares them. Raw logits only;
decisions are p32_val.decide (argmax stance, p(yes) >= 0.5) and classes are composition 2a (sha-pinned). No gold is read;
no text is printed (ids and numbers only). Never v3 / v3-safety.

Modes  <dtype>-b<batch>-<attn>:
  fp32-b1-*   fp32, batch 1, no padding, no autocast (= the pinned infer_raw_shared path)
  bf16-b1-*   bf16 autocast, batch 1, no padding
  bf16-b16-*  bf16 autocast, batches of 16 in file order, right padding (training-like; the NaN reproduction)

  attn_equiv.py run --ckpt DIR --val VAL --mode M --out DIR          (one mode; writes <out>/<mode>.jsonl)
  attn_equiv.py compare --out DIR --composition 2a.json > result.json   (declared pairs and tolerance below)

TOLERANCE (declared before any comparison was run, A30): for logit pairs (ref, x),
  |x - ref| <= TOL_REL * max(1, |ref|),  TOL_REL = 1.6e-2 (torch.testing's bf16 rtol; floor at magnitude 1).
GATE pairs (both must hold: 0 rows with a differing composed verdict, 0 nonfinite logits, every logit within TOL):
  P1 fp32-b1-sdpa vs fp32-b1-eager;  P2 bf16-b1-sdpa vs bf16-b1-eager.
Also gated: bf16-b16-eager has 0 nonfinite logits.
REPORT-ONLY: P3 bf16-b16-eager vs bf16-b1-eager (padding under eager), P4 bf16-b16-eager vs fp32-b1-sdpa, and the
bf16-b16-sdpa nonfinite row count (the reproduction)."""
from __future__ import annotations

import argparse, hashlib, json, math, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "pack"))
sys.path.append(str(HERE.parent / "p32"))  # after pack/: p32 has its own shared_model.py

VAL_SHA = "bb522c9e28754459669ebb63076dddc0e2dca7190d4b5c5e2a9e929c32bd067a"
TOL_REL = 1.6e-2
GATE_PAIRS = [("fp32-b1-sdpa", "fp32-b1-eager"), ("bf16-b1-sdpa", "bf16-b1-eager")]
REPORT_PAIRS = [("bf16-b1-eager", "bf16-b16-eager"), ("fp32-b1-sdpa", "bf16-b16-eager")]
MODES = ["fp32-b1-sdpa", "fp32-b1-eager", "bf16-b1-sdpa", "bf16-b1-eager", "bf16-b16-sdpa", "bf16-b16-eager"]


def run(a):
    import torch
    from transformers import AutoTokenizer
    from common_shared import encode_response, load_jsonl, state_text
    from shared_model import build_for_inference
    raw = Path(a.val).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == VAL_SHA, "val sha differs from the pin"
    rows = load_jsonl(a.val)
    dt, b, attn = a.mode.split("-"); bsz = int(b[1:])
    torch.set_num_threads(a.threads)
    model, sc = build_for_inference(a.ckpt, "cpu", attn=attn)
    assert model.encoder.config._attn_implementation == attn
    tok = AutoTokenizer.from_pretrained(str(Path(a.ckpt) / "tokenizer"))
    qids, widths = sc["qids"], sc["widths"]
    enc = [encode_response(tok, state_text(r), sc["max_len"])[0] for r in rows]
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    t0 = time.time(); n_pad_long = 0
    with open(out / f"{a.mode}.jsonl", "w") as f:
        for i in range(0, len(rows), bsz):
            seqs = enc[i:i + bsz]; L = max(len(s) for s in seqs)
            ids = torch.full((len(seqs), L), tok.pad_token_id, dtype=torch.long)
            att = torch.zeros((len(seqs), L), dtype=torch.long)
            for j, s in enumerate(seqs):
                ids[j, :len(s)] = torch.tensor(s); att[j, :len(s)] = 1
                n_pad_long += (L - len(s)) > 128
            with torch.no_grad(), torch.autocast("cpu", dtype=torch.bfloat16, enabled=(dt == "bf16")):
                o = model(ids, att if bsz > 1 else None).float()
            for j in range(len(seqs)):
                rec = {"id": rows[i + j]["id"], "seq_len": len(seqs[j]), "pad": L - len(seqs[j]),
                       "logits": {q: [float(x) for x in o[j, k, :widths[k]]] for k, q in enumerate(qids)}}
                f.write(json.dumps(rec) + "\n")
    meta = {"mode": a.mode, "n": len(rows), "attn": attn, "dtype": dt, "batch": bsz, "rows_padded_over_128": n_pad_long,
            "sec": round(time.time() - t0, 1), "torch": torch.__version__, "threads": a.threads,
            "ckpt_model_sha256": hashlib.sha256((Path(a.ckpt) / "model.safetensors").read_bytes()).hexdigest()}
    (out / f"{a.mode}.meta.json").write_text(json.dumps(meta, indent=1) + "\n")
    print(json.dumps(meta), flush=True)


def load(p):
    return {o["id"]: o for o in (json.loads(l) for l in open(p) if l.strip())}


def compare(a):
    from p32_val import decide
    from airp_v3.compose import compose, load_composition, COMPOSITION_2A_SHA256
    comp = load_composition(a.composition, expect_sha256=COMPOSITION_2A_SHA256)
    out = Path(a.out)
    preds = {m: load(out / f"{m}.jsonl") for m in MODES if (out / f"{m}.jsonl").exists()}

    def finite(rec):
        return all(math.isfinite(x) for v in rec["logits"].values() for x in v)

    def verdict(rec):
        d = decide(rec)
        return d, sorted(compose(d, comp))

    def pair(ra, rb):
        A, B = preds[ra], preds[rb]
        assert A.keys() == B.keys()
        nonfin = [i for i in A if not finite(A[i]) or not finite(B[i])]
        vdiff, pdiff, over, mx, sm, n, worst = [], 0, 0, 0.0, 0.0, 0, 0.0
        for i in A:
            if i in nonfin:
                continue
            (da, ca), (db, cb) = verdict(A[i]), verdict(B[i])
            if ca != cb:
                vdiff.append(i)
            if da != db:
                pdiff += 1
            for q, va in A[i]["logits"].items():
                for x, y in zip(va, B[i]["logits"][q]):
                    d = abs(y - x); tol = TOL_REL * max(1.0, abs(x))
                    mx = max(mx, d); sm += d; n += 1; worst = max(worst, d / tol); over += d > tol
        return {"ref": ra, "other": rb, "rows": len(A), "rows_nonfinite": len(nonfin), "nonfinite_ids": nonfin[:50],
                "composed_verdict_differing_rows": len(vdiff), "composed_verdict_differing_ids": vdiff,
                "primitive_decision_differing_rows": pdiff, "logits_compared": n, "max_abs_diff": mx,
                "mean_abs_diff": sm / n if n else None, "logits_over_tol": over, "max_diff_over_tol": worst}

    res = {"tolerance": f"|x-ref| <= {TOL_REL} * max(1,|ref|)", "val_sha256": VAL_SHA, "composition_sha256": COMPOSITION_2A_SHA256,
           "modes": {m: json.loads((out / f"{m}.meta.json").read_text()) for m in preds}, "gate": [], "report": []}
    for ra, rb in GATE_PAIRS:
        r = pair(ra, rb); r["pass"] = r["rows_nonfinite"] == 0 and r["composed_verdict_differing_rows"] == 0 and r["logits_over_tol"] == 0
        res["gate"].append(r)
    for ra, rb in REPORT_PAIRS:
        res["report"].append(pair(ra, rb))
    nf = lambda m: sum(1 for r in preds[m].values() if not finite(r))
    res["bf16_b16_eager_nonfinite_rows"] = nf("bf16-b16-eager")
    res["bf16_b16_sdpa_nonfinite_rows_reproduction"] = nf("bf16-b16-sdpa")
    res["pass"] = all(g["pass"] for g in res["gate"]) and res["bf16_b16_eager_nonfinite_rows"] == 0
    print(json.dumps(res, indent=1))
    return 0 if res["pass"] else 2


def main():
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest="cmd", required=True)
    r = sp.add_parser("run"); r.add_argument("--ckpt", required=True); r.add_argument("--val", required=True)
    r.add_argument("--mode", required=True, choices=MODES); r.add_argument("--out", required=True); r.add_argument("--threads", type=int, default=8)
    c = sp.add_parser("compare"); c.add_argument("--out", required=True); c.add_argument("--composition", required=True)
    a = ap.parse_args()
    return run(a) if a.cmd == "run" else compare(a)


if __name__ == "__main__":
    sys.exit(main() or 0)
