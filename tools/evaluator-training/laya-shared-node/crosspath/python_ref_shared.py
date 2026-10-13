#!/usr/bin/env python3
"""Cross-path test, Python side, shared-encoding model: the 3b gate path.

Same code path as tools/evaluator-training/laya-shared/onnx_raw.py and bench_shared.py (decide 3b, the run
that produced 17/19/13 and the ONNX-vs-torch parity 471/471): encode_response from common_shared.py
(laya 0.3.21 encode_text on serialize_state(state) with the mask token replaced by a space, no special
tokens, cut to max_len - 2, then [CLS] ... [SEP]), batch 1, no padding, ONE onnxruntime session.run per
response, ORT_ENABLE_ALL, intra 8 / inter 1 / sequential / allow_spinning 0. The decode (temperature,
thresholds, stance order, primitive kinds) comes from the pins file and equals the 3b primary decode
(laya_raw_to_primitives.py: T = 1, P(true) >= 0.5, stance argmax). Composition is NOT done here:
compare.mjs composes both paths' primitives through the one shared compose().

Per item it writes the raw logits, the primitives, and feed_sha256 = SHA-256 over b"input_ids:1xL:" +
the little-endian int64 ids (sharedFeedSha256 in laya-shared-evaluator.ts computes the same bytes from
the Node feed), so the test covers the tokenization and the feed, not only the logits.

Usage: python_ref_shared.py --bundle DIR --pins PINS.json --pins-sha HEX --suite SUITE.json
                            --ids IDS.json|all --out OUT.jsonl [--threads 8]
Requires: laya==0.3.21, transformers, onnxruntime 1.22.1, numpy (the 3b / 3a VPS venv).
"""
import argparse, hashlib, json, os, platform, statistics, time
import numpy as np

SUITE_SHA = "6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4"


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 22), b""):
            h.update(b)
    return h.hexdigest()


def softmax(z, t):
    z = np.asarray(z, dtype=np.float64) / t
    e = np.exp(z - z.max())
    return e / e.sum()


def feed_sha256(ids):
    a = np.asarray(ids, dtype="<i8")
    h = hashlib.sha256()
    h.update(f"input_ids:1x{a.shape[0]}:".encode())
    h.update(np.ascontiguousarray(a).tobytes())
    return h.hexdigest()


def encode_response(tok, state, max_len):
    """== decide 3b common_shared.encode_response."""
    from laya.common import encode_text, serialize_state
    ids = encode_text(tok, serialize_state(state).replace(tok.mask_token, " "), add_special_tokens=False)["input_ids"]
    room = max(0, max_len - 2)
    return [tok.cls_token_id] + ids[:room] + [tok.sep_token_id], len(ids)


def decide(lg, pins):
    sp = softmax(lg[pins["stanceQuestion"]], pins["temperature"]["choice"])
    stance = pins["stanceOrder"][int(np.argmax(sp))]   # first maximum, as the Node decode
    fired = lambda q: float(softmax(lg[q], pins["temperature"]["noul"])[1]) >= pins["thresholds"]["noul"][q]
    k = pins["primitiveKinds"]
    return {"stance": stance, "objects": [q for q in k["objects"] if fired(q)], "qualifiers": [q for q in k["qualifiers"] if fired(q)]}


def main():
    ap = argparse.ArgumentParser()
    for k in ("bundle", "pins", "pins_sha", "suite", "ids", "out"):
        ap.add_argument("--" + k.replace("_", "-"), dest=k, required=True)
    ap.add_argument("--threads", type=int, default=8)
    a = ap.parse_args()
    import onnxruntime as ort
    from transformers import AutoTokenizer
    if sha256_file(a.pins) != a.pins_sha: raise SystemExit("pins sha mismatch")
    pins = json.load(open(a.pins))
    if sha256_file(a.suite) != SUITE_SHA: raise SystemExit("suite sha mismatch")
    model = os.path.join(a.bundle, pins["onnx"]["file"])
    for rel, sha in pins["bundle"].items():
        if sha256_file(os.path.join(a.bundle, rel)) != sha: raise SystemExit(f"bundle file {rel} sha mismatch")
    if sha256_file(model) != pins["onnx"]["sha256"]: raise SystemExit("onnx sha mismatch")
    sc = json.load(open(os.path.join(a.bundle, "shared_config.json")))
    assert sc["qids"] == pins["heads"]["order"] and sc["widths"] == pins["heads"]["widths"] and sc["max_len"] == pins["maxLen"]
    tok = AutoTokenizer.from_pretrained(os.path.join(a.bundle, "tokenizer"))
    so = ort.SessionOptions(); so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    so.intra_op_num_threads = a.threads; so.inter_op_num_threads = 1; so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    so.add_session_config_entry("session.intra_op.allow_spinning", "0")
    sess = ort.InferenceSession(model, so, providers=["CPUExecutionProvider"])
    suite = json.load(open(a.suite))["items"]
    by = {it["id"]: it for it in suite}
    ids = [it["id"] for it in suite] if a.ids == "all" else json.load(open(a.ids))["ids"]
    order, widths = pins["heads"]["order"], pins["heads"]["widths"]
    ms = []
    with open(a.out, "w") as f:
        for i in ids:
            it = by[i]
            t0 = time.perf_counter()
            seq, ntok = encode_response(tok, it.get("state") or it.get("content") or "", pins["maxLen"])
            o = sess.run(["logits"], {"input_ids": np.asarray([seq], dtype=np.int64)})[0][0]
            lg = {q: [float(x) for x in o[j, :widths[j]]] for j, q in enumerate(order)}
            prims = decide(lg, pins)
            ms.append((time.perf_counter() - t0) * 1000)
            f.write(json.dumps({"id": i, "path": "python", "logits": lg, "prims": prims, "feed_sha256": feed_sha256(seq),
                                "inputTokens": len(seq), "responseTokens": ntok, "ms": ms[-1]}) + "\n")
    s = sorted(ms)
    print(json.dumps({"n": len(ms), "median_ms": statistics.median(ms), "p95_ms": s[min(len(s) - 1, max(0, -(-95 * len(s) // 100) - 1))],
                      "onnxruntime": ort.__version__, "python": platform.python_version(), "host": platform.node()}))
    print("PYTHON_REF_DONE")


if __name__ == "__main__":
    main()
