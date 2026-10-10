#!/usr/bin/env python3
"""3b latency harness for the shared-encoding ONNX. Mirrors followup/scripts/bench_lengths_laya.py (Task 3a):
one session.run per response (batch 1, no padding), per-item wall clock = tokenize + run + decode,
ORT intra 8 / inter 1 / sequential / allow_spinning 0 / ENABLE_ALL, p95 nearest rank,
20 untimed suite warm-up items, 2 untimed warm-up items per bucket.
--mode lengths: pinned buckets (20 items each);  --mode suite: the original short held-out suite (all items)."""
import argparse, json, math, os, platform, statistics, subprocess, sys, time

PIN_SHA = "6ad799d2d84f601833dc15c1b4d22aa48d9c38bf6edbfc494de4a2dc0d99cc4b"


def q(s, p):
    s = sorted(s); return s[min(len(s) - 1, max(0, math.ceil(p * len(s)) - 1))]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True); ap.add_argument("--ckpt", required=True, help="dir with tokenizer/ and shared_config.json")
    ap.add_argument("--suite", required=True); ap.add_argument("--questions", required=True)
    ap.add_argument("--mode", choices=("lengths", "suite"), default="lengths")
    ap.add_argument("--pinned", default=None); ap.add_argument("--buckets", default="50,200,500,1000")
    ap.add_argument("--out", required=True); ap.add_argument("--rep", default="r1")
    ap.add_argument("--warmup", type=int, default=20); ap.add_argument("--device", default="cpu")
    ap.add_argument("--intra", type=int, default=8)
    a = ap.parse_args()
    import numpy as np, onnxruntime as ort
    from transformers import AutoTokenizer
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from common_shared import encode_response, sha256_file, state_text
    if a.device == "cuda":
        ort.preload_dlls()
    sc = json.load(open(os.path.join(a.ckpt, "shared_config.json")))
    tok = AutoTokenizer.from_pretrained(os.path.join(a.ckpt, "tokenizer"))
    widths = sc["widths"]
    suite = json.load(open(a.suite))["items"]
    pre_load = open("/proc/loadavg").read().strip()
    so = ort.SessionOptions(); so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    so.intra_op_num_threads = a.intra; so.inter_op_num_threads = 1; so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    so.add_session_config_entry("session.intra_op.allow_spinning", "0")
    prov = ["CPUExecutionProvider"] if a.device == "cpu" else ["CUDAExecutionProvider", "CPUExecutionProvider"]
    t = time.perf_counter(); sess = ort.InferenceSession(a.model, so, providers=prov); load_s = time.perf_counter() - t

    def run_item(text):
        t0 = time.perf_counter()
        ids, ntok = encode_response(tok, text, sc["max_len"])
        x = np.asarray([ids], dtype=np.int64)
        t1 = time.perf_counter()
        out = sess.run(["logits"], {"input_ids": x})[0]
        t2 = time.perf_counter()
        # decode: stance argmax, 16 yes/no softmax P(true) (cheap, same work the Node path does)
        res = []
        for j, w in enumerate(widths):
            z = out[0, j, :w].astype(np.float64); e = np.exp(z - z.max()); res.append(int(np.argmax(e)) if w > 2 else float(e[1] / e.sum()))
        t3 = time.perf_counter()
        return ntok, len(ids), ((t3 - t0) * 1000, (t1 - t0) * 1000, (t2 - t1) * 1000, (t3 - t2) * 1000)

    tw = time.perf_counter()
    for it in suite[:a.warmup]: run_item(state_text(it))
    warm_s = time.perf_counter() - tw
    result = {"mode": a.mode}
    if a.mode == "lengths":
        if sha256_file(a.pinned) != PIN_SHA: raise SystemExit("pinned set SHA mismatch")
        rows = [json.loads(l) for l in open(a.pinned, encoding="utf-8")]
        result["buckets"] = {}
        for b in [int(x) for x in a.buckets.split(",")]:
            sel = [r for r in rows if r["bucket"] == b]; assert len(sel) == 20
            for r in sel[:2]: run_item(r["text"])
            recs = []
            for r in sel:
                ntok, L, (tt, te, tr, td) = run_item(r["text"])
                recs.append({"id": r["id"], "bucket": b, "laya_tokens": r["laya_tokens"], "state_tokens": ntok, "seq_len": L,
                             "truncated_tokens": max(0, ntok - (sc["max_len"] - 2)), "ms": tt, "tokenize_ms": te, "run_ms": tr, "decode_ms": td})
                print(f"{a.rep} b{b} {r['id']} {tt:.1f} ms L={L}", flush=True)
            ms = [x["ms"] for x in recs]
            result["buckets"][str(b)] = {"n": len(ms), "median_ms": statistics.median(ms), "p95_ms": q(ms, .95), "mean_ms": statistics.mean(ms),
                                         "min_ms": min(ms), "max_ms": max(ms), "items": recs}
        summary = {b: [v["median_ms"], v["p95_ms"]] for b, v in result["buckets"].items()}
    else:
        recs = []
        for it in suite:
            ntok, L, (tt, te, tr, td) = run_item(state_text(it))
            recs.append({"id": it["id"], "state_tokens": ntok, "seq_len": L, "ms": tt, "tokenize_ms": te, "run_ms": tr, "decode_ms": td})
        ms = [x["ms"] for x in recs]
        result["suite"] = {"n": len(ms), "median_ms": statistics.median(ms), "p95_ms": q(ms, .95), "mean_ms": statistics.mean(ms), "min_ms": min(ms), "max_ms": max(ms), "items": recs}
        summary = [result["suite"]["median_ms"], result["suite"]["p95_ms"]]
    cpu = subprocess.run(["lscpu"], capture_output=True, text=True).stdout
    result["meta"] = {"rep": a.rep, "device": a.device, "model": os.path.basename(a.model), "model_sha256": sha256_file(a.model),
                      "ort": {"intra_op": a.intra, "inter_op": 1, "execution_mode": "sequential", "allow_spinning": "0", "graph_optimization": "all", "providers": sess.get_providers()},
                      "layout": "single sequence, no padding", "one_pass": True, "max_len": sc["max_len"], "warmup_suite_items": a.warmup, "warmup_s": warm_s,
                      "session_load_s": load_s, "onnxruntime": ort.__version__, "numpy": np.__version__, "python": platform.python_version(), "host": platform.node(),
                      "cpu_model": [l.split(":", 1)[1].strip() for l in cpu.splitlines() if l.startswith("Model name")][0], "nproc": os.cpu_count(),
                      "loadavg_pre": pre_load, "loadavg_post": open("/proc/loadavg").read().strip(), "started_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    json.dump(result, open(a.out, "w"), indent=1)
    print("BENCH_DONE", json.dumps(summary), flush=True)


if __name__ == "__main__":
    main()
