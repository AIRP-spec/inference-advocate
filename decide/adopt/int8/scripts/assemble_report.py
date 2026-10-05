#!/usr/bin/env python3
"""Assemble INT8-GATE.md + INT8-GATE.json from per-ckpt disagree-*.json and bench summaries."""
import json, os, glob, hashlib, time
from datetime import datetime, timezone, timedelta

ROOT = "/workspace/airp/decide/adopt/int8"
NPT = timezone(timedelta(hours=5, minutes=45))
FOCUS = [
    "ckpt-epoch-1.5-step-5766",  # selected
    "ckpt-epoch-2.0-step-7688",  # converged
    "ckpt-epoch-2.5-step-9610",
    "ckpt-epoch-2.6-step-10099",
]
EARLY = ["ckpt-epoch-0.5-step-1922", "ckpt-epoch-1.0-step-3844"]
ROLE = {
    "ckpt-epoch-1.5-step-5766": "selected",
    "ckpt-epoch-2.0-step-7688": "converged",
    "ckpt-epoch-2.5-step-9610": "converged",
    "ckpt-epoch-2.6-step-10099": "converged",
    "ckpt-epoch-0.5-step-1922": "early",
    "ckpt-epoch-1.0-step-3844": "early",
}

def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 22), b""):
            h.update(b)
    return h.hexdigest()

def load_disagree(name):
    p = os.path.join(ROOT, "gate", name, f"disagree-{name}.json")
    return json.load(open(p))

def emc(g):
    return f"{g['extras']}/{g['recallMisses']}/{g['cleanFires']}"

def cse(g):
    return "PASS" if g["pass"] else f"FAIL (missed={g['missed']} extra={g['extra']})"

def main():
    rows = []
    for name in FOCUS + EARLY:
        dp = os.path.join(ROOT, "gate", name, f"disagree-{name}.json")
        if not os.path.exists(dp):
            continue
        d = json.load(open(dp))
        # latency from benches if present
        lat = {}
        for var in ("fp32", "int8"):
            bp = os.path.join(ROOT, "results", f"bench-{name}-{var}-batched.json")
            if os.path.exists(bp):
                s = json.load(open(bp))["summary"]["per_item"]
                lat[var] = {"median_ms": s["median_ms"], "p95_ms": s["p95_ms"]}
        onnx = {}
        for var, fn in (("fp32", "laya-fp32.onnx"), ("int8", "laya-int8-dynamic.onnx")):
            op = os.path.join(ROOT, "onnx", name, fn)
            onnx[var] = {"path": op, "sha256": sha(op), "bytes": os.path.getsize(op)}
        wpath = f"/workspace/airp/decide/step4/out/laya/extract/checkpoints/{name}/model.safetensors"
        rows.append({
            "checkpoint": name,
            "role": ROLE[name],
            "weight_sha256": sha(wpath),
            "onnx": onnx,
            "gate_fp32": d["gate_fp32"],
            "gate_int8": d["gate_int8"],
            "composed_disagree_n": d["composed_verdict_disagreement"]["n_items"],
            "composed_disagree_rate": d["composed_verdict_disagreement"]["rate"],
            "primitive_flip_items": d["primitive_decision_flips"]["items_with_any_flip"],
            "primitive_flips_total": d["primitive_decision_flips"]["total_flips"],
            "primitive_flip_rates": d["primitive_decision_flips"]["rate_by_primitive"],
            "primitive_flips_by_primitive": d["primitive_decision_flips"]["by_primitive"],
            "max_abs_prob_diff": d["max_abs_prob_diff"],
            "latency_box_batched": lat,
            "disagree_path": dp,
        })

    # Verdict: selected + converged must match within a couple items AND CSE clean
    focus_rows = [r for r in rows if r["role"] in ("selected", "converged")]
    ok_match = all(r["composed_disagree_n"] <= 2 for r in focus_rows)
    ok_cse = all(r["gate_int8"]["cse"]["pass"] for r in focus_rows)
    deploy_int8 = ok_match and ok_cse and len(focus_rows) >= 4
    if deploy_int8:
        verdict = ("int8 matches fp32 within a couple of held-out items on selected+converged "
                   "and CSE stays clean → int8 is the deployment build; use the VPS int8 one-pass "
                   "median (~1.2 s from step3 on task1 architecture / re-measure on deciding weights) as the real CPU number.")
    else:
        reasons = []
        if not ok_match:
            reasons.append(
                "composed item-level disagreement is far above a couple of items: "
                + ", ".join(f"{r['checkpoint'].split('-')[-1]}={r['composed_disagree_n']}" for r in focus_rows)
            )
        if not ok_cse:
            reasons.append(
                "CSE named gate fails on int8 for: "
                + ", ".join(r["checkpoint"].split("-")[-1] for r in focus_rows if not r["gate_int8"]["cse"]["pass"])
            )
        verdict = ("int8 is NOT the deployment build. " + " ".join(reasons)
                   + " Keep fp32 ONNX (or torch) for accuracy; the ~1.2 s int8 CPU figure is not a measured "
                   "number for a model that answers like fp32 on these deciding-run checkpoints.")

    out = {
        "task": "2a",
        "brief": "BRIEF-laya-adoption-2026-10-06.md",
        "brief_sha256": "59e142801dac5b4312826162af2e28af092f8250e81a536f442812d5e7f1a6f1",
        "generated_npt": datetime.now(NPT).isoformat(),
        "architecture": "one ORT session.run with 17 padded question-conditioned rows per response (batched)",
        "quantization": {
            "method": "onnxruntime.quantization.quantize_dynamic",
            "weight_type": "QInt8",
            "activations": "dynamic uint8 per-tensor at runtime",
            "per_channel": False,
            "op_types_to_quantize": ["MatMul", "Gemm"],
        },
        "suite_sha256": "6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4",
        "questions_sha256": "f519fa8e4763cc95acef3d134f984941c263043bad4abfd2a827c69e560650ee",
        "compose": "@airp/evaluator-local compose + scoreHeldOutGateDual via gate-laya-task1.mjs (default thresholds)",
        "archive_tgz_sha256": "fa5d8931b6b02b1c26adadad3fe944aae1e90e779a445eabf55ae1123482afb1",
        "note_prior_step3": "Step3 int8 gate was on task1 retrain ckpt-9610 (weight sha 3a88d65f…), NOT deciding-run 5766/9610. Those numbers are not reused.",
        "checkpoints": rows,
        "deployment_verdict": {
            "int8_is_deployment_build": deploy_int8,
            "text": verdict,
        },
    }
    json.dump(out, open(os.path.join(ROOT, "..", "INT8-GATE.json"), "w"), indent=2)

    # Markdown
    lines = []
    lines.append("# Task 2a: int8 ONNX gate (deciding-run Laya checkpoints)")
    lines.append("")
    lines.append(f"Brief: `decide/adopt/BRIEF-laya-adoption-2026-10-06.md` (sha256 `59e142801dac5b4312826162af2e28af092f8250e81a536f442812d5e7f1a6f1`). Generated {datetime.now(NPT).strftime('%Y-%m-%d %H:%M')} NPT.")
    lines.append("")
    lines.append("## Verdict")
    lines.append("")
    lines.append(verdict)
    lines.append("")
    lines.append("## Method")
    lines.append("")
    lines.append("- Weights from deciding-run archive `laya-step4-out.tgz` (sha256 `fa5d8931…`), verified member-for-member against box extract.")
    lines.append("- Export: `export_onnx.py` (opset 17, dynamic axes, MHA fastpath off); int8 = `quantize_dynamic` QInt8 MatMul/Gemm.")
    lines.append("- Inference: ORT CPU, `ORT_ENABLE_ALL`, intra_op=8, **batched** = one `session.run` with 17 padded question rows (one pass per response).")
    lines.append("- Compose/gate: shared `@airp/evaluator-local` via `gate-laya-task1.mjs`, default thresholds. CSE named gate unchanged.")
    lines.append("- Do **not** reuse Step 3 int8 gate numbers (those were task1 retrain 9610, different train).")
    lines.append("")
    lines.append("## Per-checkpoint gate (E/M/C = extras / recall misses / clean fires)")
    lines.append("")
    lines.append("| Ckpt | Role | fp32 v2 E/M/C | fp32 v1-207 | fp32 CSE | int8 v2 E/M/C | int8 v1-207 | int8 CSE | composed disagree (of 471) |")
    lines.append("|---|---|---|---|---|---|---|---|---|")
    for r in rows:
        step = r["checkpoint"].split("-")[-1]
        gf, gi = r["gate_fp32"], r["gate_int8"]
        lines.append(
            f"| {step} | {r['role']} | {emc(gf['v2'])} | {emc(gf['v1_207'])} | {cse(gf['cse'])} | "
            f"{emc(gi['v2'])} | {emc(gi['v1_207'])} | {cse(gi['cse'])} | **{r['composed_disagree_n']}** |"
        )
    lines.append("")
    lines.append("## Item-level disagreement (fp32 vs int8)")
    lines.append("")
    lines.append("Composed verdict = sorted `got` class set after shared compose. Per-primitive flip = thresholded decision differs (P≥0.5 or stance argmax).")
    lines.append("")
    for r in rows:
        step = r["checkpoint"].split("-")[-1]
        lines.append(f"### {r['checkpoint']} ({r['role']})")
        lines.append(f"- Composed disagree: **{r['composed_disagree_n']}** / 471 ({r['composed_disagree_rate']:.1%})")
        lines.append(f"- Items with any primitive flip: {r['primitive_flip_items']}; total primitive flips: {r['primitive_flips_total']}; max\\|Δp\\|={r['max_abs_prob_diff']:.4g}")
        lines.append("- Per-primitive flip counts (rate = count/471):")
        lines.append("")
        lines.append("| Primitive | Flips | Rate |")
        lines.append("|---|---:|---:|")
        for q, n in sorted(r["primitive_flips_by_primitive"].items(), key=lambda kv: -kv[1]):
            lines.append(f"| {q} | {n} | {n/471:.1%} |")
        lines.append("")
    lines.append("## Latency notes")
    lines.append("")
    lines.append("- Accuracy gates in this report used **box** ORT (host `grok-bot-vm`). Box medians below are incidental.")
    lines.append("- For CPU speed claims cite **Nepal VPS Step3** one-pass int8 **1209 ms median** / fp32 **2379 ms** (task1-architecture measurement on Xeon Gold 5418Y). That int8 speed does **not** qualify as the deployment number when int8 disagrees with fp32 on deciding-run checkpoints.")
    lines.append("")
    lines.append("### Box CPU latency (batched one-pass, incidental)")
    lines.append("")
    lines.append("| Ckpt | fp32 median / p95 ms | int8 median / p95 ms |")
    lines.append("|---|---|---|")
    for r in rows:
        lat = r.get("latency_box_batched") or {}
        fp = lat.get("fp32"); i8 = lat.get("int8")
        def fmt(x):
            return f"{x['median_ms']:.0f} / {x['p95_ms']:.0f}" if x else "—"
        lines.append(f"| {r['checkpoint'].split('-')[-1]} | {fmt(fp)} | {fmt(i8)} |")
    lines.append("")
    lines.append("## Paths and SHAs")
    lines.append("")
    lines.append("| Artifact | SHA256 |")
    lines.append("|---|---|")
    for r in rows:
        lines.append(f"| {r['checkpoint']} weights `model.safetensors` | `{r['weight_sha256']}` |")
        lines.append(f"| {r['checkpoint']} `laya-fp32.onnx` | `{r['onnx']['fp32']['sha256']}` |")
        lines.append(f"| {r['checkpoint']} `laya-int8-dynamic.onnx` | `{r['onnx']['int8']['sha256']}` |")
    lines.append("")
    lines.append("Local tree: `/workspace/airp/decide/adopt/int8/`. Archive: `/root/primitives-evaluator/decide-2026-10-06/adopt/int8/` on Nepal VPS with MANIFEST.")
    lines.append("")
    md = "\n".join(lines) + "\n"
    open(os.path.join(ROOT, "..", "INT8-GATE.md"), "w").write(md)
    print("Wrote INT8-GATE.md and INT8-GATE.json")
    print("VERDICT:", verdict)

if __name__ == "__main__":
    main()
