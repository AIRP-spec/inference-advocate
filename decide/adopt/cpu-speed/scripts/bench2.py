#!/usr/bin/env python3
"""Task 3 (Laya adoption) CPU-speed bench. Derived from decide/step3/scripts/bench_ort.py (sha 9c051044...),
same protocol (SHA-checked model + suite + questions; warm-up untimed; every one of the 471 held-out v2 items
timed in suite order; per-item = encode + session.run + decode, wall clock; p95 nearest rank), plus:
  --intra/--inter/--exec/--spin/--affinity/--opt : ONNX Runtime session settings (Task 3 step 1)
  --layout padded|packed : padded = laya collate (17 rows padded to longest) [deployment baseline];
                           packed = same 17 rows bin-packed into padded-free segments (needs a packed export).
  Always ONE session.run per response (one pass)."""
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
    ap.add_argument("--raw-out", default=None)
    ap.add_argument("--layout", choices=["padded", "packed"], default="padded")
    ap.add_argument("--intra", type=int, default=8); ap.add_argument("--inter", type=int, default=1)
    ap.add_argument("--exec", dest="exec_mode", choices=["seq", "par"], default="seq")
    ap.add_argument("--spin", choices=["default", "0", "1"], default="default")
    ap.add_argument("--affinity", default=None, help="ORT session.intra_op_thread_affinities string")
    ap.add_argument("--opt", choices=["all", "extended", "basic", "disable"], default="all")
    ap.add_argument("--pack-cap", choices=["max", "costmin"], default="max")
    ap.add_argument("--max-len", type=int, default=1024); ap.add_argument("--head-max-len", type=int, default=256)
    ap.add_argument("--warmup", type=int, default=20); ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--start", type=int, default=0)
    a = ap.parse_args()
    import numpy as np, onnxruntime as ort
    from laya_onnx_common import Encoder, load_inputs, decode, sha256_file
    from pack_common import pack_rows
    pre_load = open("/proc/loadavg").read().strip()
    got = sha256_file(a.model)
    if got != a.expect_sha: raise SystemExit(f"model SHA {got} != {a.expect_sha}")
    items, qs = load_inputs(a.suite, a.questions)
    warm_items = items[:a.warmup]
    if a.limit: items = items[a.start:a.start + a.limit]
    enc = Encoder(a.ckpt, qs)
    so = ort.SessionOptions()
    so.graph_optimization_level = {"all": ort.GraphOptimizationLevel.ORT_ENABLE_ALL, "extended": ort.GraphOptimizationLevel.ORT_ENABLE_EXTENDED,
                                   "basic": ort.GraphOptimizationLevel.ORT_ENABLE_BASIC, "disable": ort.GraphOptimizationLevel.ORT_DISABLE_ALL}[a.opt]
    so.intra_op_num_threads = a.intra; so.inter_op_num_threads = a.inter
    so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL if a.exec_mode == "seq" else ort.ExecutionMode.ORT_PARALLEL
    if a.spin != "default": so.add_session_config_entry("session.intra_op.allow_spinning", a.spin)
    if a.affinity: so.add_session_config_entry("session.intra_op_thread_affinities", a.affinity)
    t = time.perf_counter(); sess = ort.InferenceSession(a.model, so, providers=["CPUExecutionProvider"]); load_s = time.perf_counter() - t
    in_names = [i.name for i in sess.get_inputs()]

    def run_item(content):
        t0 = time.perf_counter()
        rows, ntok = enc.encode(content, max_len=a.max_len, head_max_len=a.head_max_len)
        feed = enc.collate(rows) if a.layout == "padded" else pack_rows(rows, enc.tok.pad_token_id, a.pack_cap)
        t1 = time.perf_counter()
        logits = sess.run(["logits"], {k: feed[k] for k in in_names})[0]
        t2 = time.perf_counter()
        rec = decode(enc.ids, rows, logits)
        t3 = time.perf_counter()
        return rec, rows, ntok, feed["input_ids"].shape, ((t3 - t0) * 1000, (t1 - t0) * 1000, (t2 - t1) * 1000, (t3 - t2) * 1000)

    tw = time.perf_counter()
    for it in warm_items: run_item(it["content"])
    warm_s = time.perf_counter() - tw
    tot, encm, runm, decm, recs = [], [], [], [], []
    t_start = time.time()
    for i, it in enumerate(items):
        rec, rows, ntok, shp, (tt, te, tr, td) = run_item(it["content"])
        tot.append(tt); encm.append(te); runm.append(tr); decm.append(td)
        lens = [len(r["ids"]) for r in rows]
        recs.append({"id": it["id"], "state_tokens": ntok, "row_lens": lens, "padded_seq": max(lens), "feed_shape": list(shp),
                     "truncated": any(l >= a.max_len for l in lens), "ms": tt, **rec})
        if (i + 1) % 50 == 0: print(f"{a.label} {i+1}/{len(items)} median so far {statistics.median(tot):.1f} ms load {open('/proc/loadavg').read().split()[0]}", flush=True)
    wall = time.time() - t_start
    cpu = subprocess.run(["lscpu"], capture_output=True, text=True).stdout
    model_name = [l.split(":", 1)[1].strip() for l in cpu.splitlines() if l.startswith("Model name")][0]
    st = [r["state_tokens"] for r in recs]
    info = {"label": a.label, "layout": a.layout, "one_pass": True, "model": os.path.basename(a.model), "model_sha256": got,
            "ckpt": os.path.basename(a.ckpt.rstrip("/")), "n": len(tot), "start": a.start, "warmup_items": len(warm_items), "warmup_s": warm_s,
            "per_item": summ(tot), "encode": summ(encm), "session_run": summ(runm), "decode": summ(decm),
            "ort": {"intra_op": a.intra, "inter_op": a.inter, "execution_mode": a.exec_mode, "allow_spinning": a.spin,
                    "intra_op_thread_affinities": a.affinity, "graph_optimization": a.opt},
            "pack_cap": a.pack_cap, "max_len": a.max_len, "head_max_len": a.head_max_len,
            "session_load_s": load_s, "wall_s": wall, "onnxruntime": ort.__version__, "numpy": np.__version__,
            "python": platform.python_version(), "host": platform.node(), "cpu_model": model_name, "nproc": os.cpu_count(),
            "loadavg_pre": pre_load, "loadavg_post": open("/proc/loadavg").read().strip(),
            "tokens": {"state_tokens_max": max(st), "state_tokens_median": statistics.median(st),
                       "rows_truncated_items": sum(r["truncated"] for r in recs),
                       "padded_seq_max": max(r["padded_seq"] for r in recs), "padded_seq_median": statistics.median(r["padded_seq"] for r in recs),
                       "feed_tokens_median": statistics.median(r["feed_shape"][0] * r["feed_shape"][1] for r in recs),
                       "row_len_total_median": statistics.median(sum(r["row_lens"]) for r in recs)},
            "started_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t_start))}
    json.dump({"summary": info, "per_item_ms": tot, "encode_ms": encm, "run_ms": runm, "decode_ms": decm,
               "ids": [r["id"] for r in recs]}, open(a.out, "w"), indent=1)
    if a.raw_out:
        with open(a.raw_out, "w") as f:
            for r in recs: f.write(json.dumps(r) + "\n")
    print(json.dumps(info), flush=True)
    print("BENCH_DONE", flush=True)

if __name__ == "__main__":
    main()
