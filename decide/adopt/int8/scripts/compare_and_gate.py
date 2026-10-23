#!/usr/bin/env python3
"""Step 3 parity + int8 gate.
1. Converts every variant's per-item raw logits to the gate input format (task1 analyze_laya_task1.py:
   softmax at T=1; {"id","stance_probs","p_true"}).
2. Parity vs the torch fp32 reference (laya Agent.predict, CPU fp32 eager): max |dp| over all 16 noul
   P(true) + 5 stance probs, max |dlogit|, decision flips at default thresholds (P>=0.5; stance argmax).
3. Gates each variant with the task1 gate script UNCHANGED (tools/evaluator-training/laya/gate-laya-task1.mjs
   at 2319b62: shared compose() + scoreHeldOutGateDual from @airp/evaluator-local, default thresholds).
Writes <out>/parity.json, <out>/gate-<variant>.json, <out>/probs-<variant>.jsonl."""
import argparse, json, os, subprocess, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from laya_onnx_common import softmax
STANCES = ["conveys_method", "depicts", "describes", "encourages", "endorses"]
GATE_REPO = "/workspace/inference-advocate-task1"  # commit 2319b62 == base of decide/step3-cpu
ap = argparse.ArgumentParser()
ap.add_argument("--ref", required=True); ap.add_argument("--variant", action="append", required=True, help="name=path")
ap.add_argument("--out", required=True)
a = ap.parse_args(); a.out = os.path.abspath(a.out); os.makedirs(a.out, exist_ok=True)

def load(p):
    rows = {}
    for l in open(p):
        if not l.strip(): continue
        r = json.loads(l); lg = r["logits"]
        rows[r["id"]] = {"logits": lg, "stance_probs": dict(zip(STANCES, map(float, softmax(lg["stance"])))),
                         "p_true": {q: float(softmax(v)[1]) for q, v in lg.items() if q != "stance"}}
    assert len(rows) == 471, (p, len(rows))
    return rows

def decisions(r):
    d = {q: p >= 0.5 for q, p in r["p_true"].items()}
    d["stance"] = max(STANCES, key=lambda s: r["stance_probs"][s]); return d

ref = load(a.ref); out = {"reference": a.ref, "variants": {}}
variants = [("torch-fp32-ref", a.ref)] + [tuple(v.split("=", 1)) for v in a.variant]
for name, path in variants:
    rows = ref if name == "torch-fp32-ref" else load(path)
    pp = os.path.join(a.out, f"probs-{name}.jsonl")
    with open(pp, "w") as f:
        for i in ref:  # suite order is preserved by the reference file
            f.write(json.dumps({"id": i, "stance_probs": rows[i]["stance_probs"], "p_true": rows[i]["p_true"]}) + "\n")
    dp, dl, flips, items_flip, flip_list = 0.0, 0.0, {}, 0, []
    for i, r in ref.items():
        c = rows[i]
        dp = max(dp, max(abs(c["p_true"][q] - r["p_true"][q]) for q in r["p_true"]),
                 max(abs(c["stance_probs"][s] - r["stance_probs"][s]) for s in STANCES))
        dl = max(dl, max(float(np.max(np.abs(np.array(c["logits"][q]) - np.array(r["logits"][q])))) for q in r["logits"]))
        dr, dc = decisions(r), decisions(c); f_any = False
        for q in dr:
            if dr[q] != dc[q]:
                flips[q] = flips.get(q, 0) + 1; f_any = True
                flip_list.append({"id": i, "q": q, "ref": dr[q], "variant": dc[q],
                                  "ref_p": r["p_true"].get(q, r["stance_probs"]), "variant_p": c["p_true"].get(q, c["stance_probs"])})
        items_flip += f_any
    g = os.path.join(a.out, f"gate-{name}.json")
    res = subprocess.run(["node", "tools/evaluator-training/laya/gate-laya-task1.mjs", "--probs", pp, "--thresholds", "default",
                          "--label", f"step3-{name}-default", "--out", g], cwd=GATE_REPO, capture_output=True, text=True)
    if res.returncode: print(res.stderr); raise SystemExit(f"gate failed for {name}")
    gj = json.load(open(g))
    out["variants"][name] = {"path": path, "max_abs_prob_diff_vs_ref": dp, "max_abs_logit_diff_vs_ref": dl,
                             "decision_flips_vs_ref_total": sum(flips.values()), "decision_flips_by_primitive": flips,
                             "items_with_any_flip": items_flip, "flips": flip_list,
                             "gate_v2": gj["v2"], "gate_v1_207": gj["v1_207"], "cse": {k: gj["cse"][k] for k in ("n", "missed", "extra", "pass")},
                             "probs_sha256": gj["probsSha256"]}
    v = out["variants"][name]
    print(f"{name:28s} max|dp|={dp:.3g} max|dlogit|={dl:.3g} flips={v['decision_flips_vs_ref_total']} items={items_flip} "
          f"v2 {gj['v2']['extras']}/{gj['v2']['recallMisses']}/{gj['v2']['cleanFires']} v1-207 {gj['v1_207']['extras']}/{gj['v1_207']['recallMisses']}/{gj['v1_207']['cleanFires']} CSE {'PASS' if gj['cse']['pass'] else 'FAIL'} {gj['cse']['missed']}/{gj['cse']['extra']}", flush=True)
json.dump(out, open(os.path.join(a.out, "parity.json"), "w"), indent=1)
print("COMPARE_DONE")
