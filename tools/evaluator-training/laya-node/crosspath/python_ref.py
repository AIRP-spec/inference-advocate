#!/usr/bin/env python3
"""Cross-path test, Python side: the gate path that produced the fp32 5766 numbers (16/20/13).

Same code path as decide/adopt int8/scripts/bench_ort.py --mode batched (sha 9c051044...) and
laya_onnx_common.py (sha 52ca0a68...): laya 0.3.21 Agent._encode_state (tokenize the state once,
laya.common.build_sequence per question, max_len 1024 / head_max_len 256), collate_items padding,
ONE onnxruntime session.run per response over all 17 rows, ORT_ENABLE_ALL, inter_op 1, sequential.
Decode and decisions use the pins file (temperature, thresholds, stance order); composition is
NOT done here: the Node test composes both paths' primitives through the one shared compose().

Layouts (pins file `layout.kind`): padded (default) = the path above. packed = the S2c build: the same
rows bin-packed by pack_common.pack_rows (vendored here, sha pinned in the pins file and checked below),
fed to the packed graph with ORT intra-op spinning off when the pins say so. The packed run also writes
feed_sha256 per item (SHA-256 over every feed tensor, see feed_sha256()), which the Node path computes
from its own feed; compare.mjs requires them equal, so the test covers the packed feed, not only logits.

Usage: python_ref.py --bundle DIR --pins PINS.json --pins-sha HEX --suite SUITE.json --ids IDS.json
                     --out OUT.jsonl [--threads N]
Requires: laya==0.3.21, transformers, onnxruntime, numpy (decide/step3 venv-export).
"""
import argparse, hashlib, json, os, sys, time
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

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


PACKED_NAMES = ["input_ids", "seg_ids", "position_ids", "marker_pos", "marker_mask", "row_start", "qtype"]


def feed_sha256(feed):
    """Same bytes as packedFeedSha256 in laya-packed.ts: name:dims: + little-endian int64 (uint8 for the bool mask)."""
    h = hashlib.sha256()
    for n in PACKED_NAMES:
        a = feed[n]
        a = a.astype("uint8") if a.dtype == bool else a.astype("<i8")
        h.update(f"{n}:{'x'.join(map(str, a.shape))}:".encode())
        h.update(np.ascontiguousarray(a).tobytes())
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    for k in ("bundle", "pins", "pins_sha", "suite", "ids", "out"):
        ap.add_argument("--" + k.replace("_", "-"), dest=k, required=True)
    ap.add_argument("--threads", type=int, default=8)
    ap.add_argument("--rows-out", default=None, help="packed only: also write each item's 17 token rows + feed hash (model-free golden for the packing test)")
    a = ap.parse_args()
    import onnxruntime as ort
    from transformers import AutoTokenizer
    import laya
    from laya.agent import Agent
    from laya.common import QTYPES, build_sequence, encode_text, render_options, serialize_state

    if sha256_file(a.pins) != a.pins_sha:
        raise SystemExit("pins SHA mismatch")
    pins = json.load(open(a.pins))
    model = os.path.join(a.bundle, pins["onnx"]["file"])
    for rel, want in [(pins["onnx"]["file"], pins["onnx"]["sha256"])] + list(pins["bundle"].items()):
        got = sha256_file(os.path.join(a.bundle, rel))
        if got != want:
            raise SystemExit(f"SHA mismatch {rel}: {got} != {want}")
    if sha256_file(a.suite) != SUITE_SHA:
        raise SystemExit("suite SHA mismatch")
    qs = pins["questions"]["definitions"]
    order = pins["questions"]["order"]
    assert list(qs.keys()) == order
    items = {it["id"]: it for it in json.load(open(a.suite))["items"]}
    ids = json.load(open(a.ids))["ids"]

    tok = AutoTokenizer.from_pretrained(os.path.join(a.bundle, "tokenizer"))
    for q in order:
        Agent._check_question(q, qs[q])
    internal = {q: Agent._to_internal(qs[q]) for q in order}
    so = ort.SessionOptions()
    so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    so.intra_op_num_threads = a.threads
    so.inter_op_num_threads = 1
    so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    layout = (pins.get("layout") or {}).get("kind", "padded")
    if (pins.get("ort") or {}).get("allowSpinning") is False:
        so.add_session_config_entry("session.intra_op.allow_spinning", "0")
    if layout == "packed":
        from pack_common import pack_rows, COST_A, COST_B
        lay = pins["layout"]
        if sha256_file(os.path.join(os.path.dirname(os.path.abspath(__file__)), "pack_common.py")) != lay["packCommonSha256"]:
            raise SystemExit("pack_common.py does not match layout.packCommonSha256")
        if (lay["costA"], lay["costB"]) != (COST_A, COST_B):
            raise SystemExit("pins cost model differs from pack_common")
    sess = ort.InferenceSession(model, so, providers=["CPUExecutionProvider"])

    def encode(state):
        sids = encode_text(tok, serialize_state(state).replace(tok.mask_token, " "), add_special_tokens=False)["input_ids"]
        rows = []
        for q in order:
            seq, markers = build_sequence(tok, state, internal[q], pins["maxLen"], pins["headMaxLen"],
                                          truncate_left=isinstance(state, list), state_ids=sids)
            assert len(markers) == len(render_options(internal[q]))
            rows.append({"ids": seq, "markers": markers, "qtype": QTYPES[internal[q]["t"]]})
        return rows

    def collate(rows):
        n, L = len(rows), max(len(r["ids"]) for r in rows)
        k = max(len(r["markers"]) for r in rows)
        f = {"input_ids": np.full((n, L), tok.pad_token_id, dtype=np.int64), "attention_mask": np.zeros((n, L), dtype=np.int64),
             "marker_pos": np.zeros((n, k), dtype=np.int64), "marker_mask": np.zeros((n, k), dtype=bool),
             "qtype": np.array([r["qtype"] for r in rows], dtype=np.int64)}
        for i, r in enumerate(rows):
            f["input_ids"][i, :len(r["ids"])] = r["ids"]; f["attention_mask"][i, :len(r["ids"])] = 1
            f["marker_pos"][i, :len(r["markers"])] = r["markers"]; f["marker_mask"][i, :len(r["markers"])] = True
        return f

    def feed_for(rows):
        return pack_rows(rows, tok.pad_token_id, pins["layout"]["packCap"]) if layout == "packed" else collate(rows)

    names = [i.name for i in sess.get_inputs()]
    f0 = feed_for(encode("Hello."))
    sess.run(["logits"], {k: f0[k] for k in names})  # warm-up, discarded
    so_ = pins["stanceOrder"]; th = pins["thresholds"]["noul"]; T = pins["temperature"]
    rows_f = open(a.rows_out, "w") if a.rows_out else None
    with open(a.out, "w") as out:
        for iid in ids:
            t0 = time.perf_counter()
            rows = encode(items[iid]["content"])
            feed = feed_for(rows)
            lg = sess.run(["logits"], {k: feed[k] for k in names})[0]
            if rows_f is not None:
                rows_f.write(json.dumps({"id": iid, "rows": [{"ids": [int(x) for x in r["ids"]], "markers": [int(x) for x in r["markers"]], "qtype": int(r["qtype"])} for r in rows],
                                         "feed_sha256": feed_sha256(feed), "bins": int(feed["input_ids"].shape[0]), "cap": int(feed["input_ids"].shape[1])}) + "\n")
            ms = (time.perf_counter() - t0) * 1000
            logits = {q: [float(x) for x in lg[j][:len(rows[j]["markers"])]] for j, q in enumerate(order)}
            sp = softmax(logits[pins["stanceQuestion"]], T["choice"])
            stance = so_[int(np.argmax(sp))]  # first maximum, pinned order
            p_true = {q: float(softmax(logits[q], T["noul"])[1]) for q in th}
            fired = lambda q: p_true[q] >= th[q]
            prims = {"stance": stance, "objects": [q for q in pins["primitiveKinds"]["objects"] if fired(q)],
                     "qualifiers": [q for q in pins["primitiveKinds"]["qualifiers"] if fired(q)]}
            out.write(json.dumps({"id": iid, "path": "python", "logits": logits, "p_true": p_true,
                                  "stance_probs": dict(zip(so_, map(float, sp))), "prims": prims,
                                  "row_lens": [len(r["ids"]) for r in rows], "ms": ms, "layout": layout,
                                  **({"feed_sha256": feed_sha256(feed), "bins": int(feed["input_ids"].shape[0]),
                                      "cap": int(feed["input_ids"].shape[1])} if layout == "packed" else {})}) + "\n")
    meta = {"onnxruntime": ort.__version__, "laya": getattr(laya, "__version__", "?"), "numpy": np.__version__,
            "python": sys.version.split()[0], "n": len(ids)}
    print(json.dumps(meta), flush=True)
    print("PYREF_DONE", flush=True)


if __name__ == "__main__":
    main()
