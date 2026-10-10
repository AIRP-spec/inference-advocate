#!/usr/bin/env python3
"""Step 3: export one Laya checkpoint to ONNX (fp32) and build a dynamic int8 copy.

Graph = laya.common.DecisionModel.forward unchanged (encoder -> +type_emb -> 2-layer head ->
gather at option markers -> scorer -> logits; act head), inputs/outputs named as laya's own
ONNXAgent expects (onnx_agent.py: input_ids, attention_mask, marker_pos, marker_mask, qtype ->
logits, act_logits). All axes dynamic: rows (questions x responses), seq, k (options).
One session.run with the 17 question rows of a response == one Agent.predict forward.

Env: TORCHDYNAMO_DISABLE=1; ModernBERT reference_compile=False (laya.Agent sets it from compile=False).
A watchdog aborts the process if MemAvailable drops below 900 MB (the box is shared).
"""
import argparse, json, os, sys, threading, time
os.environ.setdefault("TORCHDYNAMO_DISABLE", "1")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def watchdog(min_kb=900_000):
    def run():
        while True:
            for l in open("/proc/meminfo"):
                if l.startswith("MemAvailable"):
                    if int(l.split()[1]) < min_kb:
                        print("WATCHDOG: MemAvailable low, aborting", flush=True); os._exit(9)
            time.sleep(0.5)
    threading.Thread(target=run, daemon=True).start()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--suite", required=True); ap.add_argument("--questions", required=True)
    ap.add_argument("--opset", type=int, default=17)
    ap.add_argument("--skip-export", action="store_true"); ap.add_argument("--skip-int8", action="store_true")
    a = ap.parse_args()
    watchdog()
    import numpy as np, torch, laya, transformers, onnx, onnxruntime as ort
    from laya_onnx_common import Encoder, load_inputs
    os.makedirs(a.out, exist_ok=True)
    fp32, int8 = os.path.join(a.out, "laya-fp32.onnx"), os.path.join(a.out, "laya-int8-dynamic.onnx")
    items, qs = load_inputs(a.suite, a.questions)
    enc = Encoder(a.ckpt, qs)
    meta = {"ckpt": a.ckpt, "torch": torch.__version__, "transformers": transformers.__version__,
            "laya": laya.__version__ if hasattr(laya, "__version__") else "0.3.21", "onnx": onnx.__version__,
            "onnxruntime": ort.__version__, "opset": a.opset, "TORCHDYNAMO_DISABLE": os.environ.get("TORCHDYNAMO_DISABLE")}
    if not a.skip_export:
        agent = laya.Agent(a.ckpt, device="cpu")
        m = agent.model.eval()
        meta["reference_compile"] = getattr(m.encoder.config, "reference_compile", None)
        meta["param_dtypes"] = sorted({str(p.dtype) for p in m.parameters()})
        meta["agent_dtype"], meta["agent_amp"] = str(agent.dtype), agent.amp_enabled
        meta["n_params"] = sum(p.numel() for p in m.parameters())
        print(json.dumps(meta), flush=True)

        class Wrap(torch.nn.Module):
            def __init__(s, mm): super().__init__(); s.m = mm
            def forward(s, input_ids, attention_mask, marker_pos, marker_mask, qtype):
                return s.m(input_ids, attention_mask, marker_pos, marker_mask, qtype)
        w = Wrap(m).eval()
        # nn.TransformerEncoderLayer's eval fast path (aten::_transformer_encoder_layer_fwd) has no ONNX
        # symbolic; the regular path computes the same layer (same weights, same maths).
        torch.backends.mha.set_fastpath_enabled(False)
        meta["mha_fastpath_disabled_for_export"] = True
        b = enc.collate(enc.encode(items[0]["content"])[0])
        tb = tuple(torch.from_numpy(b[k]) for k in ("input_ids", "attention_mask", "marker_pos", "marker_mask", "qtype"))
        t0 = time.time()
        with torch.no_grad():
            torch.onnx.export(w, tb, fp32, dynamo=False, opset_version=a.opset, do_constant_folding=True,
                              input_names=["input_ids", "attention_mask", "marker_pos", "marker_mask", "qtype"],
                              output_names=["logits", "act_logits"],
                              dynamic_axes={"input_ids": {0: "rows", 1: "seq"}, "attention_mask": {0: "rows", 1: "seq"},
                                            "marker_pos": {0: "rows", 1: "k"}, "marker_mask": {0: "rows", 1: "k"},
                                            "qtype": {0: "rows"}, "logits": {0: "rows", 1: "k"}, "act_logits": {0: "rows"}})
        meta["export_sec"] = time.time() - t0
        print("exported", fp32, os.path.getsize(fp32), f"{meta['export_sec']:.0f}s", flush=True)
        # quick torch-vs-ORT smoke on items of different shape (batched 17 rows and a single row)
        so = ort.SessionOptions(); so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        sess = ort.InferenceSession(fp32, so, providers=["CPUExecutionProvider"])
        smoke = []
        for idx in (0, 100, 470):
            its, _ = enc.encode(items[idx]["content"])
            for rows in (its, its[:1], its[-1:]):
                bb = enc.collate(rows)
                with torch.no_grad():
                    tl, ta = m(*(torch.from_numpy(bb[k]) for k in ("input_ids", "attention_mask", "marker_pos", "marker_mask", "qtype")))
                ol, oa = sess.run(["logits", "act_logits"], bb)
                smoke.append({"item": idx, "rows": len(rows), "seq": int(bb["input_ids"].shape[1]),
                              "max_abs_logit_diff": float(np.abs(tl.numpy() - ol).max()),
                              "max_abs_act_diff": float(np.abs(ta.numpy() - oa).max())})
        meta["smoke"] = smoke; print(json.dumps(smoke), flush=True)
        del sess, agent, m, w
        import gc; gc.collect()
    if not a.skip_int8:
        from onnxruntime.quantization import QuantType, quantize_dynamic
        t0 = time.time()
        quantize_dynamic(fp32, int8, weight_type=QuantType.QInt8, per_channel=False, reduce_range=False,
                         op_types_to_quantize=["MatMul", "Gemm"])
        meta["int8"] = {"method": "onnxruntime.quantization.quantize_dynamic", "weight_type": "QInt8",
                        "activations": "dynamic uint8 (per-tensor, computed at run time)", "per_channel": False,
                        "reduce_range": False, "op_types_to_quantize": ["MatMul", "Gemm"],
                        "not_quantized": "embeddings (Gather), LayerNorm, softmax, attention score math",
                        "sec": time.time() - t0, "size": os.path.getsize(int8)}
        print("int8", int8, os.path.getsize(int8), flush=True)
    mp = os.path.join(a.out, "export-meta.json")
    old = json.load(open(mp)) if os.path.exists(mp) else {}
    old.update(meta); json.dump(old, open(mp, "w"), indent=1)
    print("EXPORT_DONE", flush=True)


if __name__ == "__main__":
    main()
