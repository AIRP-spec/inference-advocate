#!/usr/bin/env python3
"""Step 3 CPU latency: Laya ONNX on onnxruntime, full 471-item held-out v2, one response at a time.

Modes (both legitimate for Laya, whose input is question-conditioned -- see laya_onnx_common):
  batched : ONE session.run per response, all 17 question rows in one padded batch.
            == laya Agent.predict / ONNXAgent.predict (one forward call per response).
  perq    : 17 session.run calls per response, one unpadded question row each (per-question cost).

Protocol: verify model SHA; build session (ORT_ENABLE_ALL, intra_op=--threads, inter_op=1, sequential);
warm up on the first --warmup suite items (untimed); then time every one of the 471 items in suite
order. Per-item time = encode (tokenize + laya build_sequence x17 + collate) + session.run(s) +
decode to T=1 probabilities, wall clock (time.perf_counter). p95 = nearest rank s[ceil(.95n)-1].
Raw per-item logits/probabilities are written for parity and gating."""
import argparse, json, math, os, platform, statistics, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def q(s, p):
    s = sorted(s); return s[min(len(s) - 1, max(0, math.ceil(p * len(s)) - 1))]


def summ(v):
    return {"n": len(v), "median_ms": statistics.median(v), "p95_ms": q(v, 0.95), "mean_ms": statistics.mean(v),
            "min_ms": min(v), "max_ms": max(v), "sum_s": sum(v) / 1000}


def main():
    ap = argparse.ArgumentParser()
    for k in ("ckpt", "model", "expect_sha", "suite", "questions", "out", "label"):
        ap.add_argument("--" + k.replace("_", "-"), dest=k, required=True)
    ap.add_argument("--raw-out", default=None); ap.add_argument("--mode", choices=["batched", "perq"], default="batched")
    ap.add_argument("--threads", type=int, default=8); ap.add_argument("--warmup", type=int, default=20)
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    import numpy as np, onnxruntime as ort
    from laya_onnx_common import Encoder, load_inputs, decode, sha256_file
    pre_load = open("/proc/loadavg").read().strip()
    got = sha256_file(a.model)
    if got != a.expect_sha: raise SystemExit(f"model SHA {got} != {a.expect_sha}")
    items, qs = load_inputs(a.suite, a.questions)
    if a.limit: items = items[:a.limit]
    enc = Encoder(a.ckpt, qs)
    so = ort.SessionOptions()
    so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    so.intra_op_num_threads = a.threads; so.inter_op_num_threads = 1
    so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    t = time.perf_counter(); sess = ort.InferenceSession(a.model, so, providers=["CPUExecutionProvider"]); load_s = time.perf_counter() - t

    def run_item(content):
        t0 = time.perf_counter()
        rows, ntok = enc.encode(content)
        t1 = time.perf_counter()
        if a.mode == "batched":
            logits = sess.run(["logits"], enc.collate(rows))[0]; per_q = None
        else:
            logits, per_q = [], []
            for r in rows:
                tq = time.perf_counter(); logits.append(sess.run(["logits"], enc.collate([r]))[0][0]); per_q.append((time.perf_counter() - tq) * 1000)
        t2 = time.perf_counter()
        rec = decode(enc.ids, rows, logits)
        t3 = time.perf_counter()
        return rec, rows, ntok, ((t3 - t0) * 1000, (t1 - t0) * 1000, (t2 - t1) * 1000, (t3 - t2) * 1000), per_q

    tw = time.perf_counter()
    for it in items[:a.warmup]: run_item(it["content"])
    warm_s = time.perf_counter() - tw
    tot, encm, runm, decm, perq_all, recs = [], [], [], [], [], []
    t_start = time.time()
    for i, it in enumerate(items):
        rec, rows, ntok, (tt, te, tr, td), per_q = run_item(it["content"])
        tot.append(tt); encm.append(te); runm.append(tr); decm.append(td)
        if per_q: perq_all.extend(per_q)
        lens = [len(r["ids"]) for r in rows]
        recs.append({"id": it["id"], "state_tokens": ntok, "row_lens": lens, "padded_seq": max(lens),
                     "truncated": any(l >= 1024 for l in lens), "ms": tt, **rec})
        if (i + 1) % 50 == 0: print(f"{a.label} {i+1}/{len(items)} median so far {statistics.median(tot):.1f} ms", flush=True)
    wall = time.time() - t_start
    cpu = subprocess.run(["lscpu"], capture_output=True, text=True).stdout
    model_name = [l.split(":", 1)[1].strip() for l in cpu.splitlines() if l.startswith("Model name")][0]
    st = [r["state_tokens"] for r in recs]
    info = {"label": a.label, "mode": a.mode, "model": os.path.basename(a.model), "model_sha256": got,
            "ckpt": os.path.basename(a.ckpt.rstrip("/")), "n": len(tot), "warmup_items": a.warmup, "warmup_s": warm_s,
            "per_item": summ(tot), "encode": summ(encm), "session_run": summ(runm), "decode": summ(decm),
            "per_question_run": summ(perq_all) if perq_all else None,
            "threads": {"intra_op": a.threads, "inter_op": 1, "execution_mode": "sequential", "spinning": "ORT default"},
            "graph_optimization": "ORT_ENABLE_ALL", "session_load_s": load_s, "wall_s": wall,
            "onnxruntime": ort.__version__, "numpy": np.__version__, "python": platform.python_version(),
            "host": platform.node(), "cpu_model": model_name, "nproc": os.cpu_count(),
            "lscpu": cpu, "loadavg_pre": pre_load, "loadavg_post": open("/proc/loadavg").read().strip(),
            "tokens": {"state_tokens_max": max(st), "state_tokens_median": statistics.median(st),
                       "over_1024_state_tokens": sum(x > 1024 for x in st), "share_over_1024": sum(x > 1024 for x in st) / len(st),
                       "rows_truncated_items": sum(r["truncated"] for r in recs),
                       "padded_seq_max": max(r["padded_seq"] for r in recs), "padded_seq_median": statistics.median(r["padded_seq"] for r in recs),
                       "row_len_total_median": statistics.median(sum(r["row_lens"]) for r in recs)},
            "started_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t_start))}
    json.dump({"summary": info, "per_item_ms": tot, "encode_ms": encm, "run_ms": runm, "decode_ms": decm,
               "per_question_run_ms": perq_all or None, "ids": [r["id"] for r in recs]}, open(a.out, "w"), indent=1)
    if a.raw_out:
        with open(a.raw_out, "w") as f:
            for r in recs: f.write(json.dumps(r) + "\n")
    print(json.dumps({k: v for k, v in info.items() if k != "lscpu"}), flush=True)
    print("BENCH_DONE", flush=True)


if __name__ == "__main__":
    main()
