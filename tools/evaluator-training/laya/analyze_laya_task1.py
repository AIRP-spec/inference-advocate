#!/usr/bin/env python3
"""Task 1: offline analysis of raw Laya logits (infer_raw.py output). No model, no torch.

Per checkpoint:
  * validation metrics at default 0.5 / argmax: per-primitive P/R/F1, macro-F1 (Amendment A2), stance acc
  * condition 2b thresholds: fit_thresholds.search_threshold on the checkpoint's OWN val probs
    (imported from the trainpack, not re-implemented), zero-val-positive primitives keep 0.5 (A1)
  * temperatures fitted on val (notebook fit_one_temp objective: soft-CE over T in [0.1, 10])
  * ECE (A3) on val and held-out, at T=1 and at the val-fitted T
  * held-out probabilities JSONL for gate-laya-task1.mjs, + thresholds JSON
  * token-length stats (ModernBERT tokenizer counts recorded by infer_raw.py)
Usage: analyze_laya_task1.py --raw DIR --val VAL.jsonl --suite SUITE.json --proxies P.json
                             --trainpack DIR --out DIR [--archived-gate-out DIR]
"""
import argparse, json, math, sys
from pathlib import Path
import numpy as np

STANCES = ["conveys_method", "depicts", "describes", "encourages", "endorses"]
NOUL = ["violence_person", "self_harm", "sexual_activity", "financial_crime", "intrusion", "weapons", "profanity",
        "is_mention_not_use", "subject_is_minor", "exceeds_common_knowledge", "addresses_own_nature",
        "asserts_interior_state", "directed_at_user", "explicit_register", "targets_protected_characteristic",
        "untethered_to_content"]
OBJECTS = set(NOUL[:7])


def softmax(z, T=1.0):
    z = np.asarray(z, dtype=np.float64) / T
    z = z - z.max(-1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(-1, keepdims=True)


def fit_temp(Z, Y):
    """argmin_T mean soft-CE(softmax(Z/T), Y), T in [0.1, 10] (same objective/clamp as fit_one_temp)."""
    Z, Y = np.asarray(Z, float), np.asarray(Y, float)
    if len(Z) < 10:
        return 1.0
    def loss(lt):
        return -(Y * np.log(softmax(Z, math.exp(lt)) + 1e-300)).sum(-1).mean()
    a, b = math.log(0.1), math.log(10.0)
    g = (math.sqrt(5) - 1) / 2
    c, d = b - g * (b - a), a + g * (b - a)
    for _ in range(100):
        if loss(c) < loss(d):
            b = d
        else:
            a = c
        c, d = b - g * (b - a), a + g * (b - a)
    return float(math.exp((a + b) / 2))


def ece(conf, correct, bins=10):
    conf, correct = np.asarray(conf, float), np.asarray(correct, float)
    if len(conf) == 0:
        return None
    idx = np.minimum((conf * bins).astype(int), bins - 1)
    tot = 0.0
    for b in range(bins):
        m = idx == b
        if m.any():
            tot += m.sum() / len(conf) * abs(correct[m].mean() - conf[m].mean())
    return float(tot)


def prf(pred, gold):
    pred, gold = np.asarray(pred, bool), np.asarray(gold, bool)
    tp = int((pred & gold).sum()); fp = int((pred & ~gold).sum()); fn = int((~pred & gold).sum())
    p = tp / (tp + fp) if tp + fp else None
    r = tp / (tp + fn) if tp + fn else None
    f = (2 * p * r / (p + r)) if (p and r) else (0.0 if (tp + fn) else None)
    return {"tp": tp, "fp": fp, "fn": fn, "n_pos": tp + fn, "precision": p, "recall": r, "f1": f}


def load_jsonl(p):
    return [json.loads(l) for l in open(p) if l.strip()]


def main():
    ap = argparse.ArgumentParser()
    for k in ("raw", "val", "suite", "proxies", "trainpack", "out"):
        ap.add_argument("--" + k, required=True)
    ap.add_argument("--archived-gate-out", default=None)
    a = ap.parse_args()
    sys.path.insert(0, a.trainpack)
    from fit_thresholds import search_threshold  # the trainpack's own procedure
    val = {r["id"]: r for r in load_jsonl(a.val)}
    suite = json.load(open(a.suite))["items"]
    suite_by = {i["id"]: i for i in suite}
    proxies = json.load(open(a.proxies))["primitives"]
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    summary = {}
    for ckd in sorted(Path(a.raw).iterdir(), key=lambda p: int(p.name.split("step-")[-1])):
        ck = ckd.name
        V = load_jsonl(ckd / "val.jsonl"); H = load_jsonl(ckd / "heldout.jsonl")
        assert len(V) == len(val) and len(H) == len(suite)
        res = {"checkpoint": ck}
        # ---- temperatures on val
        Zc = [r["logits"]["stance"] for r in V]
        Yc = [[1.0 if s == val[r["id"]]["stance"] else 0.0 for s in STANCES] for r in V]
        Zn, Yn = [], []
        for r in V:
            pos = set(val[r["id"]]["objects"]) | set(val[r["id"]]["qualifiers"])
            for q in NOUL:
                Zn.append(r["logits"][q]); Yn.append([0.0, 1.0] if q in pos else [1.0, 0.0])
        T = {"choice": fit_temp(Zc, Yc), "noul": fit_temp(Zn, Yn)}
        res["temperatures_val_fit"] = T
        # ---- val metrics at 0.5 + 2b thresholds
        vm, thr2b, f1s = {}, {}, []
        for q in NOUL:
            p = [float(softmax(r["logits"][q])[1]) for r in V]
            g = [q in (set(val[r["id"]]["objects"]) | set(val[r["id"]]["qualifiers"])) for r in V]
            m = prf([x >= 0.5 for x in p], g)
            vm[q] = m
            if m["n_pos"]:
                f1s.append(m["f1"])
                t, f1, hr, _ = search_threshold(p, [int(x) for x in g])
                thr2b[q] = float(t)
            else:
                thr2b[q] = 0.5
        st_acc = float(np.mean([STANCES[int(np.argmax(r["logits"]["stance"]))] == val[r["id"]]["stance"] for r in V]))
        res["val"] = {"n": len(V), "macro_f1_at_0.5": float(np.mean(f1s)), "n_primitives_in_macro": len(f1s),
                      "stance_accuracy": st_acc, "per_primitive_at_0.5": vm}
        res["thresholds_2b"] = thr2b
        # ---- ECE
        def ece_split(rows, gold_fn, stance_gold=None):
            outd = {}
            for Tname, Tc, Tn in (("T1", 1.0, 1.0), ("Tfit", T["choice"], T["noul"])):
                d = {}
                for q in NOUL:
                    gold = [gold_fn(r, q) for r in rows]
                    if all(x is None for x in gold):
                        continue
                    pp = [float(softmax(r["logits"][q], Tn)[1]) for r, gg in zip(rows, gold) if gg is not None]
                    gg = [x for x in gold if x is not None]
                    conf = [max(x, 1 - x) for x in pp]
                    corr = [(x >= 0.5) == y for x, y in zip(pp, gg)]
                    d[q] = ece(conf, corr)
                if stance_gold:
                    ps = [softmax(r["logits"]["stance"], Tc) for r in rows]
                    d["stance"] = ece([x.max() for x in ps], [STANCES[int(x.argmax())] == stance_gold(r) for x, r in zip(ps, rows)])
                outd[Tname] = d
            return outd
        res["ece_val"] = ece_split(V, lambda r, q: q in (set(val[r["id"]]["objects"]) | set(val[r["id"]]["qualifiers"])),
                                   lambda r: val[r["id"]]["stance"])
        def ho_gold(r, q):
            key = ("object:" if q in OBJECTS else "qualifier:") + q
            if key not in proxies:
                return None
            return any(c in suite_by[r["id"]]["expect"] for c in proxies[key]["expectIncludes"])
        res["ece_heldout"] = ece_split(H, ho_gold)
        # ---- held-out probs for node gate (T=1; thresholds are applied on the same scale they were fitted on)
        with open(out / f"heldout-probs-{ck}.jsonl", "w") as f:
            for r in H:
                sp = softmax(r["logits"]["stance"])
                f.write(json.dumps({"id": r["id"], "stance_probs": dict(zip(STANCES, map(float, sp))),
                                    "p_true": {q: float(softmax(r["logits"][q])[1]) for q in NOUL}}) + "\n")
        json.dump({"name": f"2b per-checkpoint val refit ({ck})", "noul": thr2b}, open(out / f"thresholds-2b-{ck}.json", "w"), indent=1)
        # ---- tokens
        toks = [r["state_tokens"] for r in H]
        res["heldout_tokens"] = {"max_state_tokens": max(toks), "over_1024": sum(t > 1024 for t in toks),
                                 "truncated_any_question": sum(bool(r["truncated"]) for r in H), "max_seq_len": max(r["seq_len_max"] for r in H)}
        # ---- consistency vs archived gate outputs (default decisions are temperature-invariant)
        if a.archived_gate_out:
            ag = Path(a.archived_gate_out) / f"gate-primitives-{ck}.jsonl"
            if ag.exists():
                arch = {x["id"]: x for x in load_jsonl(ag)}
                n_dec = n_agree = 0
                st_agree = 0
                for r in H:
                    x = arch[r["id"]]
                    st_agree += STANCES[int(np.argmax(r["logits"]["stance"]))] == x["stance"]
                    for q in NOUL:
                        n_dec += 1
                        n_agree += (softmax(r["logits"][q])[1] >= 0.5) == (x["probs"][q]["noul"] >= 0.5)
                res["archived_consistency"] = {"noul_decisions": n_dec, "agree": int(n_agree), "stance_agree": int(st_agree), "n": len(H)}
        summary[ck] = res
        print(ck, "val macroF1@0.5=%.4f stance=%.4f T=%s" % (res["val"]["macro_f1_at_0.5"], st_acc, {k: round(v, 3) for k, v in T.items()}),
              res.get("archived_consistency", ""), res["heldout_tokens"], flush=True)
    sel = max(summary.values(), key=lambda r: (round(r["val"]["macro_f1_at_0.5"], 12), r["val"]["stance_accuracy"],
                                              -int(r["checkpoint"].split("step-")[-1])))
    json.dump({"selected_by_val_macro_f1": sel["checkpoint"], "rule": "PRE-DECLARATIONS A2", "checkpoints": summary},
              open(out / "analysis.json", "w"), indent=1)
    print("SELECTED", sel["checkpoint"])


if __name__ == "__main__":
    main()
