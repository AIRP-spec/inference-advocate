#!/usr/bin/env python3
"""Gate fp32 and int8 raw probs; compute composed item-level disagreement and per-primitive flips."""
import argparse, json, os, subprocess, sys
import numpy as np

STANCES = ["conveys_method", "depicts", "describes", "encourages", "endorses"]
OBJECTS = ["violence_person", "self_harm", "sexual_activity", "financial_crime", "intrusion", "weapons", "profanity"]
QUALIFIERS = ["is_mention_not_use", "subject_is_minor", "exceeds_common_knowledge", "addresses_own_nature",
              "asserts_interior_state", "directed_at_user", "explicit_register", "targets_protected_characteristic",
              "untethered_to_content"]
GATE_REPO = "/workspace/inference-advocate-task1"

def softmax(z):
    z = np.asarray(z, dtype=np.float64); e = np.exp(z - z.max()); return e / e.sum()

def load_raw(p):
    """Accept bench raw (has logits) or already-probs jsonl."""
    rows = {}
    for l in open(p):
        if not l.strip(): continue
        r = json.loads(l)
        if "stance_probs" in r and "p_true" in r and "logits" not in r:
            rows[r["id"]] = {"stance_probs": r["stance_probs"], "p_true": r["p_true"], "logits": r.get("logits")}
            continue
        lg = r["logits"]
        rows[r["id"]] = {
            "logits": lg,
            "stance_probs": dict(zip(STANCES, map(float, softmax(lg["stance"])))),
            "p_true": {q: float(softmax(v)[1]) for q, v in lg.items() if q != "stance"},
        }
    return rows

def decisions(r):
    d = {q: r["p_true"][q] >= 0.5 for q in r["p_true"]}
    d["stance"] = max(STANCES, key=lambda s: r["stance_probs"][s])
    return d

def write_probs(path, rows, order):
    with open(path, "w") as f:
        for i in order:
            f.write(json.dumps({"id": i, "stance_probs": rows[i]["stance_probs"], "p_true": rows[i]["p_true"]}) + "\n")

def run_gate(probs, out, label):
    res = subprocess.run(
        ["node", "tools/evaluator-training/laya/gate-laya-task1.mjs",
         "--probs", probs, "--thresholds", "default", "--label", label, "--out", out],
        cwd=GATE_REPO, capture_output=True, text=True)
    if res.returncode:
        print(res.stdout); print(res.stderr); raise SystemExit(f"gate failed {label}")
    return json.load(open(out))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fp32-raw", required=True)
    ap.add_argument("--int8-raw", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--label", required=True)
    a = ap.parse_args()
    os.makedirs(a.out_dir, exist_ok=True)
    fp = load_raw(a.fp32_raw); iq = load_raw(a.int8_raw)
    assert set(fp) == set(iq), (len(fp), len(iq), len(set(fp)^set(iq)))
    assert len(fp) == 471, len(fp)
    order = list(fp.keys())  # insertion = suite order from bench

    # probs files + gates
    pp_fp = os.path.join(a.out_dir, f"probs-{a.label}-fp32.jsonl")
    pp_i8 = os.path.join(a.out_dir, f"probs-{a.label}-int8.jsonl")
    write_probs(pp_fp, fp, order); write_probs(pp_i8, iq, order)
    g_fp = run_gate(pp_fp, os.path.join(a.out_dir, f"gate-{a.label}-fp32.json"), f"adopt-int8-{a.label}-fp32")
    g_i8 = run_gate(pp_i8, os.path.join(a.out_dir, f"gate-{a.label}-int8.json"), f"adopt-int8-{a.label}-int8")

    # per-primitive decision flips
    flips = {}; items_flip = 0; flip_list = []
    dp = 0.0
    for i in order:
        r, c = fp[i], iq[i]
        dp = max(dp, max(abs(c["p_true"][q] - r["p_true"][q]) for q in r["p_true"]),
                 max(abs(c["stance_probs"][s] - r["stance_probs"][s]) for s in STANCES))
        dr, dc = decisions(r), decisions(c)
        f_any = False
        for q in dr:
            if dr[q] != dc[q]:
                flips[q] = flips.get(q, 0) + 1; f_any = True
                flip_list.append({"id": i, "q": q, "fp32": dr[q], "int8": dc[q]})
        items_flip += f_any

    # composed verdict disagreement from gate perItem.got
    by_fp = {x["id"]: x for x in g_fp["perItem"]}
    by_i8 = {x["id"]: x for x in g_i8["perItem"]}
    composed_disagree = []
    for i in order:
        a_got = sorted(by_fp[i]["got"]); b_got = sorted(by_i8[i]["got"])
        if a_got != b_got:
            composed_disagree.append({"id": i, "fp32": a_got, "int8": b_got,
                                      "fp32_prims": by_fp[i]["prims"], "int8_prims": by_i8[i]["prims"]})
        # also prims-level composed input disagreement
    prims_disagree = []
    for i in order:
        pa, pb = by_fp[i]["prims"], by_i8[i]["prims"]
        if (pa["stance"] != pb["stance"] or sorted(pa["objects"]) != sorted(pb["objects"])
                or sorted(pa["qualifiers"]) != sorted(pb["qualifiers"])):
            prims_disagree.append({"id": i, "fp32": pa, "int8": pb})

    flip_rates = {q: flips.get(q, 0) / 471 for q in
                  (["stance"] + OBJECTS + QUALIFIERS)}

    out = {
        "label": a.label,
        "n": 471,
        "fp32_raw": a.fp32_raw,
        "int8_raw": a.int8_raw,
        "max_abs_prob_diff": dp,
        "gate_fp32": {"v2": g_fp["v2"], "v1_207": g_fp["v1_207"],
                      "cse": {k: g_fp["cse"][k] for k in ("n", "missed", "extra", "pass", "type")}},
        "gate_int8": {"v2": g_i8["v2"], "v1_207": g_i8["v1_207"],
                      "cse": {k: g_i8["cse"][k] for k in ("n", "missed", "extra", "pass", "type")}},
        "primitive_decision_flips": {
            "total_flips": sum(flips.values()),
            "items_with_any_flip": items_flip,
            "by_primitive": flips,
            "rate_by_primitive": flip_rates,
        },
        "composed_verdict_disagreement": {
            "n_items": len(composed_disagree),
            "rate": len(composed_disagree) / 471,
            "items": composed_disagree,
        },
        "thresholded_prims_disagreement": {
            "n_items": len(prims_disagree),
            "rate": len(prims_disagree) / 471,
        },
        "probs_sha256_fp32": g_fp.get("probsSha256"),
        "probs_sha256_int8": g_i8.get("probsSha256"),
    }
    op = os.path.join(a.out_dir, f"disagree-{a.label}.json")
    json.dump(out, open(op, "w"), indent=2)
    gf, gi = out["gate_fp32"], out["gate_int8"]
    print(f"{a.label} fp32 v2 {gf['v2']['extras']}/{gf['v2']['recallMisses']}/{gf['v2']['cleanFires']} "
          f"v1 {gf['v1_207']['extras']}/{gf['v1_207']['recallMisses']}/{gf['v1_207']['cleanFires']} "
          f"CSE {'PASS' if gf['cse']['pass'] else 'FAIL'}")
    print(f"{a.label} int8 v2 {gi['v2']['extras']}/{gi['v2']['recallMisses']}/{gi['v2']['cleanFires']} "
          f"v1 {gi['v1_207']['extras']}/{gi['v1_207']['recallMisses']}/{gi['v1_207']['cleanFires']} "
          f"CSE {'PASS' if gi['cse']['pass'] else 'FAIL'}")
    print(f"{a.label} composed_disagree={len(composed_disagree)} prim_flip_items={items_flip} "
          f"total_prim_flips={sum(flips.values())} max|dp|={dp:.4g}")
    print("DISAGREE_DONE", op)

if __name__ == "__main__":
    main()
