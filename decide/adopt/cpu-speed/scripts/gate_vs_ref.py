#!/usr/bin/env python3
"""Task 3: gate a candidate build vs the current-best reference build (raw logits from bench2.py on the VPS);
composed item-level disagreement (shared compose via gate-laya-task1.mjs, default thresholds) and per-primitive
decision flips. Derived from decide/adopt/int8/scripts/gate_and_disagree.py; "fp32" = reference, "int8" = candidate
in internal names and output keys are renamed ref/cand."""
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
    ap.add_argument("--ref-raw", required=True)
    ap.add_argument("--cand-raw", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--label", required=True)
    ap.add_argument("--ref-name", default="ref"); ap.add_argument("--cand-name", default="cand")
    a = ap.parse_args()
    a.out_dir = os.path.abspath(a.out_dir); os.makedirs(a.out_dir, exist_ok=True)
    fp = load_raw(a.ref_raw); iq = load_raw(a.cand_raw)
    assert set(fp) == set(iq), (len(fp), len(iq), len(set(fp)^set(iq)))
    assert len(fp) == 471, len(fp)
    order = list(fp.keys())  # insertion = suite order from bench

    # probs files + gates
    pp_fp = os.path.join(a.out_dir, f"probs-{a.label}-{a.ref_name}.jsonl")
    pp_i8 = os.path.join(a.out_dir, f"probs-{a.label}-{a.cand_name}.jsonl")
    write_probs(pp_fp, fp, order); write_probs(pp_i8, iq, order)
    g_fp = run_gate(pp_fp, os.path.join(a.out_dir, f"gate-{a.label}-{a.ref_name}.json"), f"adopt-cpuspeed-{a.ref_name}")
    g_i8 = run_gate(pp_i8, os.path.join(a.out_dir, f"gate-{a.label}-{a.cand_name}.json"), f"adopt-cpuspeed-{a.cand_name}")

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
                flip_list.append({"id": i, "q": q, "ref": dr[q], "cand": dc[q]})
        items_flip += f_any

    # composed verdict disagreement from gate perItem.got
    by_fp = {x["id"]: x for x in g_fp["perItem"]}
    by_i8 = {x["id"]: x for x in g_i8["perItem"]}
    composed_disagree = []
    for i in order:
        a_got = sorted(by_fp[i]["got"]); b_got = sorted(by_i8[i]["got"])
        if a_got != b_got:
            composed_disagree.append({"id": i, "ref": a_got, "cand": b_got,
                                      "ref_prims": by_fp[i]["prims"], "cand_prims": by_i8[i]["prims"]})
        # also prims-level composed input disagreement
    prims_disagree = []
    for i in order:
        pa, pb = by_fp[i]["prims"], by_i8[i]["prims"]
        if (pa["stance"] != pb["stance"] or sorted(pa["objects"]) != sorted(pb["objects"])
                or sorted(pa["qualifiers"]) != sorted(pb["qualifiers"])):
            prims_disagree.append({"id": i, "ref": pa, "cand": pb})

    dl = 0.0
    for i in order:
        if fp[i].get("logits") and iq[i].get("logits"):
            dl = max(dl, max(float(np.max(np.abs(np.array(iq[i]["logits"][q]) - np.array(fp[i]["logits"][q])))) for q in fp[i]["logits"]))
    flip_rates = {q: flips.get(q, 0) / 471 for q in
                  (["stance"] + OBJECTS + QUALIFIERS)}

    out = {
        "label": a.label,
        "n": 471,
        "ref_name": a.ref_name, "cand_name": a.cand_name, "ref_raw": a.ref_raw,
        "cand_raw": a.cand_raw,
        "max_abs_prob_diff": dp, "max_abs_logit_diff": dl,
        "gate_ref": {"v2": g_fp["v2"], "v1_207": g_fp["v1_207"],
                      "cse": {k: g_fp["cse"][k] for k in ("n", "missed", "extra", "pass", "type")}},
        "gate_cand": {"v2": g_i8["v2"], "v1_207": g_i8["v1_207"],
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
        "probs_sha256_ref": g_fp.get("probsSha256"),
        "probs_sha256_cand": g_i8.get("probsSha256"),
    }
    op = os.path.join(a.out_dir, f"disagree-{a.label}.json")
    json.dump(out, open(op, "w"), indent=2)
    gf, gi = out["gate_ref"], out["gate_cand"]
    print(f"{a.label} {a.ref_name} v2 {gf['v2']['extras']}/{gf['v2']['recallMisses']}/{gf['v2']['cleanFires']} "
          f"v1 {gf['v1_207']['extras']}/{gf['v1_207']['recallMisses']}/{gf['v1_207']['cleanFires']} "
          f"CSE {'PASS' if gf['cse']['pass'] else 'FAIL'}")
    print(f"{a.label} {a.cand_name} v2 {gi['v2']['extras']}/{gi['v2']['recallMisses']}/{gi['v2']['cleanFires']} "
          f"v1 {gi['v1_207']['extras']}/{gi['v1_207']['recallMisses']}/{gi['v1_207']['cleanFires']} "
          f"CSE {'PASS' if gi['cse']['pass'] else 'FAIL'}")
    print(f"{a.label} composed_disagree={len(composed_disagree)} prim_flip_items={items_flip} "
          f"total_prim_flips={sum(flips.values())} max|dp|={dp:.4g}")
    print("DISAGREE_DONE", op)

if __name__ == "__main__":
    main()
