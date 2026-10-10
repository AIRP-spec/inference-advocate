#!/usr/bin/env python3
"""Task 3 step 2: padding-free ('packed') ONNX export of a Laya checkpoint. Same weights, same maths as
laya.common.DecisionModel.forward; only the batch layout differs:
  padded (deployment baseline): [17 rows, longest-row] with pad tokens computed and masked.
  packed: rows bin-packed into [B bins, cap]; attention masked block-diagonally per segment (encoder
          additive finfo.min mask exactly like ModernBERT's _update_attention_mask; head bool mask like
          laya's key_padding_mask path), RoPE position ids restart at 0 per segment, the sliding window
          (|i-j| <= local_attention//2) is applied on within-segment positions, type embedding added per
          token from the token's row, markers / [CLS] gathered from the flat [B*cap] hidden states.
Still ONE session.run per response. Inputs: input_ids, seg_ids, position_ids [B,cap]; marker_pos (flat),
marker_mask [17,k]; row_start [17]; qtype [17]. Outputs logits [17,k], act_logits [17,2].
Checks torch packed vs torch padded on a sample before writing the ONNX, then ORT packed vs torch padded."""
import argparse, json, os, sys, time
os.environ.setdefault("TORCHDYNAMO_DISABLE", "1")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--suite", required=True); ap.add_argument("--questions", required=True)
    ap.add_argument("--opset", type=int, default=17); ap.add_argument("--check-items", type=int, default=40)
    a = ap.parse_args()
    import numpy as np, torch, torch.nn.functional as F, laya, transformers, onnx, onnxruntime as ort
    from laya_onnx_common import Encoder, load_inputs
    from pack_common import pack_rows
    torch.set_num_threads(4)
    os.makedirs(a.out, exist_ok=True)
    items, qs = load_inputs(a.suite, a.questions)
    enc = Encoder(a.ckpt, qs)
    agent = laya.Agent(a.ckpt, device="cpu")
    m = agent.model.eval()
    E = m.encoder
    half = E.config.local_attention // 2
    meta = {"ckpt": a.ckpt, "torch": torch.__version__, "transformers": transformers.__version__, "onnx": onnx.__version__,
            "onnxruntime": ort.__version__, "opset": a.opset, "attn_impl": E.config._attn_implementation,
            "agent_dtype": str(agent.dtype), "agent_amp": agent.amp_enabled, "local_attention": E.config.local_attention,
            "head_layers": len(m.head.layers) if m.head is not None else 0,
            "head_activation": str(m.head.layers[0].activation) if m.head is not None else None}
    print(json.dumps(meta), flush=True)

    class Packed(torch.nn.Module):
        def __init__(s, mm): super().__init__(); s.m = mm
        def forward(s, input_ids, seg_ids, position_ids, marker_pos, marker_mask, row_start, qtype):
            mm = s.m; E = mm.encoder
            B, L = input_ids.shape
            same = seg_ids[:, :, None] == seg_ids[:, None, :]                       # [B,L,L]
            near = (position_ids[:, :, None] - position_ids[:, None, :]).abs() <= half
            neg = torch.finfo(torch.float32).min
            zero = torch.zeros((), dtype=torch.float32)
            gmask = torch.where(same, zero, torch.full((), neg))[:, None]             # [B,1,L,L]
            smask = torch.where(same & near, zero, torch.full((), neg))[:, None]
            h = E.embeddings(input_ids=input_ids)
            for layer in E.layers:
                h = layer(h, attention_mask=gmask, sliding_window_mask=smask, position_ids=position_ids)[0]
            h = E.final_norm(h)
            d = h.size(-1)
            rows = qtype.shape[0]
            # type embedding per token from its row's qtype (pad tokens: row 0's, irrelevant: never attended)
            tok_q = qtype[seg_ids.clamp(min=0)]                                         # [B,L]
            h = h + mm.type_emb(tok_q)
            if mm.head is not None:
                keep = same[:, None]                                                    # [B,1,L,L] True = may attend
                for layer in mm.head.layers:
                    sa = layer.self_attn
                    x = layer.norm1(h)
                    qkv = F.linear(x, sa.in_proj_weight, sa.in_proj_bias)
                    qq, kk, vv = (t.unflatten(-1, (sa.num_heads, sa.head_dim)).transpose(1, 2) for t in qkv.chunk(3, dim=-1))
                    at = F.scaled_dot_product_attention(qq, kk, vv, attn_mask=keep)
                    at = at.transpose(1, 2).flatten(-2)
                    h = h + sa.out_proj(at)
                    h = h + layer.linear2(layer.activation(layer.linear1(layer.norm2(h))))
            flat = h.reshape(B * L, d)
            mgat = flat[marker_pos.clamp(min=0)]                                        # [rows,k,d]
            logits = mm.scorer(mgat).squeeze(-1).float()
            logits = logits.masked_fill(~marker_mask, -1e4)
            p = torch.softmax(logits, -1)
            k = marker_mask.sum(-1).clamp(min=2).float()
            ent = -(p * torch.log(p.clamp_min(1e-9))).sum(-1) / torch.log(k)
            top2 = p.topk(2, -1).values
            feats = torch.stack([top2[:, 0], top2[:, 0] - top2[:, 1], ent, k / 255.0], -1)
            pooled = flat[row_start].float()
            act = mm.act_head(torch.cat([pooled, feats], -1))
            return logits, act

    # sanity: head layer config is what the manual path assumes
    if m.head is not None:
        l0 = m.head.layers[0]
        assert l0.norm_first and l0.self_attn.batch_first and l0.self_attn.in_proj_weight is not None and l0.self_attn.bias_k is None
    P = Packed(m).eval()
    names = ["input_ids", "seg_ids", "position_ids", "marker_pos", "marker_mask", "row_start", "qtype"]
    def tpk(feed): return tuple(torch.from_numpy(feed[k]) for k in names)
    def tpd(feed): return tuple(torch.from_numpy(feed[k]) for k in ("input_ids", "attention_mask", "marker_pos", "marker_mask", "qtype"))
    # torch packed vs torch padded
    check = []
    idxs = list(range(0, 471, max(1, 471 // a.check_items)))[:a.check_items] + [470]
    with torch.no_grad():
        for i in idxs:
            rows, _ = enc.encode(items[i]["content"])
            pd, pk = enc.collate(rows), pack_rows(rows, enc.tok.pad_token_id)
            l1, a1 = m(*tpd(pd)); l2, a2 = P(*tpk(pk))
            mk = torch.from_numpy(pd["marker_mask"])
            dl = float((l1 - l2).abs()[mk].max()); da = float((a1 - a2).abs().max())
            check.append({"item": i, "padded_shape": list(pd["input_ids"].shape), "packed_shape": list(pk["input_ids"].shape),
                          "max_abs_logit_diff": dl, "max_abs_act_diff": da,
                          "argmax_same": bool(((l1.masked_fill(~mk, -1e9)).argmax(-1) == (l2.masked_fill(~mk, -1e9)).argmax(-1)).all())})
    meta["torch_packed_vs_padded"] = {"n": len(check), "max_abs_logit_diff": max(c["max_abs_logit_diff"] for c in check),
                                      "max_abs_act_diff": max(c["max_abs_act_diff"] for c in check),
                                      "argmax_all_same": all(c["argmax_same"] for c in check), "items": check}
    print("torch packed vs padded:", json.dumps({k: v for k, v in meta["torch_packed_vs_padded"].items() if k != "items"}), flush=True)
    if meta["torch_packed_vs_padded"]["max_abs_logit_diff"] > 1e-3:
        raise SystemExit("packed graph does not reproduce padded logits; refusing to export")
    out = os.path.join(a.out, "laya-fp32-packed.onnx")
    pk0 = pack_rows(enc.encode(items[0]["content"])[0], enc.tok.pad_token_id)
    torch.backends.mha.set_fastpath_enabled(False)
    t0 = time.time()
    with torch.no_grad():
        torch.onnx.export(P, tpk(pk0), out, dynamo=False, opset_version=a.opset, do_constant_folding=True,
                          input_names=names, output_names=["logits", "act_logits"],
                          dynamic_axes={"input_ids": {0: "bins", 1: "cap"}, "seg_ids": {0: "bins", 1: "cap"}, "position_ids": {0: "bins", 1: "cap"},
                                        "marker_pos": {0: "rows", 1: "k"}, "marker_mask": {0: "rows", 1: "k"}, "row_start": {0: "rows"},
                                        "qtype": {0: "rows"}, "logits": {0: "rows", 1: "k"}, "act_logits": {0: "rows"}})
    meta["export_sec"] = time.time() - t0
    so = ort.SessionOptions(); so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL; so.intra_op_num_threads = 4
    sess = ort.InferenceSession(out, so, providers=["CPUExecutionProvider"])
    oc = []
    with torch.no_grad():
        for i in idxs:
            rows, _ = enc.encode(items[i]["content"])
            pd, pk = enc.collate(rows), pack_rows(rows, enc.tok.pad_token_id)
            l1, a1 = m(*tpd(pd))
            l2, a2 = sess.run(["logits", "act_logits"], {k: pk[k] for k in names})
            mk = pd["marker_mask"]
            oc.append({"item": i, "max_abs_logit_diff": float(np.abs(l1.numpy() - l2)[mk].max()), "max_abs_act_diff": float(np.abs(a1.numpy() - a2).max())})
    meta["ort_packed_vs_torch_padded"] = {"n": len(oc), "max_abs_logit_diff": max(c["max_abs_logit_diff"] for c in oc),
                                          "max_abs_act_diff": max(c["max_abs_act_diff"] for c in oc), "items": oc}
    print("ORT packed vs torch padded:", json.dumps({k: v for k, v in meta["ort_packed_vs_torch_padded"].items() if k != "items"}), flush=True)
    json.dump(meta, open(os.path.join(a.out, "export-packed-meta.json"), "w"), indent=1)
    print("EXPORT_DONE", out, os.path.getsize(out), flush=True)

if __name__ == "__main__":
    main()
