#!/usr/bin/env python3
"""SECONDARY mode (declaration §5): fit temperature (stance, yes/no) and per-primitive thresholds on VALIDATION raw logits only,
apply to held-out. Reported beside the primary (T=1, 0.5/argmax) results; never used to select or decide.
Usage: fit_secondary.py --raw-dir <dir of ckpt/{val,heldout}.jsonl> --val val.jsonl --questions q.json --out-dir D"""
import argparse, json, math
from pathlib import Path
import numpy as np
import torch

OBJECTS = ["violence_person", "self_harm", "sexual_activity", "financial_crime", "intrusion", "weapons", "profanity"]
QUALS = ["is_mention_not_use", "subject_is_minor", "exceeds_common_knowledge", "addresses_own_nature", "asserts_interior_state",
         "directed_at_user", "explicit_register", "targets_protected_characteristic", "untethered_to_content"]


def fit_one_temp(sel):  # notebook / airp_laya_common.fit_one_temp
    if len(sel) < 10:
        return 1.0
    kmax = max(len(z) for z, _ in sel)
    Z = torch.full((len(sel), kmax), -1e4); T = torch.zeros((len(sel), kmax))
    for i, (z, t) in enumerate(sel):
        Z[i, : len(z)] = torch.tensor(z); T[i, : len(t)] = torch.tensor(t, dtype=torch.float32)
    log_t = torch.zeros(1, requires_grad=True)
    opt = torch.optim.LBFGS([log_t], lr=0.1, max_iter=100)
    def closure():
        opt.zero_grad(); loss = -(T * torch.log_softmax(Z / log_t.exp(), -1)).sum(-1).mean(); loss.backward(); return loss
    opt.step(closure)
    return float(torch.clamp(log_t.exp(), 0.1, 10.0).item())


def best_f1_threshold(scores, labels):  # same search as fit_thresholds.search_threshold (best F1, ties -> lower thr)
    cand = sorted(set([0.0, 0.5, 1.0] + [float(s) for s in scores]))
    best_f1, best_thr = -1.0, 0.5
    s = np.asarray(scores); y = np.asarray(labels)
    for thr in cand:
        pred = s >= thr
        tp = int((pred & (y == 1)).sum()); fp = int((pred & (y == 0)).sum()); fn = int((~pred & (y == 1)).sum())
        p = tp / (tp + fp) if tp + fp else 0.0; r = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * p * r / (p + r) if p + r else 0.0
        if f1 > best_f1 or (f1 == best_f1 and thr < best_thr):
            best_f1, best_thr = f1, thr
    return best_thr


def softmax(z, T=1.0):
    z = np.asarray(z, dtype=np.float64) / T; z = z - z.max(); e = np.exp(z); return e / e.sum()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw-dir", required=True); ap.add_argument("--val", required=True); ap.add_argument("--questions", required=True)
    ap.add_argument("--out-dir", required=True)
    a = ap.parse_args()
    qs = json.load(open(a.questions)); stance_keys = list(qs["stance"]["criteria"].keys())
    val = {json.loads(l)["id"]: json.loads(l) for l in open(a.val) if l.strip()}
    out = Path(a.out_dir); out.mkdir(parents=True, exist_ok=True)
    fits = {}
    for ckd in sorted(p for p in Path(a.raw_dir).iterdir() if p.is_dir()):
        vr = [json.loads(l) for l in open(ckd / "val.jsonl") if l.strip()]
        st_sel, nl_sel, scores, labels = [], [], {q: [] for q in OBJECTS + QUALS}, {q: [] for q in OBJECTS + QUALS}
        for r in vr:
            g = val[r["id"]]
            st_sel.append((r["logits"]["stance"], [1.0 if k == g["stance"] else 0.0 for k in stance_keys]))
            pos = set(g.get("objects") or []) | set(g.get("qualifiers") or [])
            for q in OBJECTS + QUALS:
                nl_sel.append((r["logits"][q], [0.0, 1.0] if q in pos else [1.0, 0.0]))
        T_st, T_nl = fit_one_temp(st_sel), fit_one_temp(nl_sel)
        for r in vr:
            g = val[r["id"]]; pos = set(g.get("objects") or []) | set(g.get("qualifiers") or [])
            for q in OBJECTS + QUALS:
                scores[q].append(float(softmax(r["logits"][q], T_nl)[1])); labels[q].append(1 if q in pos else 0)
        thr = {q: (best_f1_threshold(scores[q], labels[q]) if sum(labels[q]) > 0 else 0.5) for q in OBJECTS + QUALS}
        fits[ckd.name] = {"T_stance": T_st, "T_noul": T_nl, "thresholds": thr, "fit_on": "val only", "n_val": len(vr)}
        d = out / "primary-secondary" / ckd.name; d.mkdir(parents=True, exist_ok=True)
        for split, name in (("val", "val-primitives.jsonl"), ("heldout", "heldout-primitives.jsonl")):
            rows = []
            for r in (json.loads(l) for l in open(ckd / f"{split}.jsonl") if l.strip()):
                sp = softmax(r["logits"]["stance"], T_st); stance = stance_keys[int(np.argmax(sp))]
                objs = [q for q in OBJECTS if softmax(r["logits"][q], T_nl)[1] >= thr[q]]
                quals = [q for q in QUALS if softmax(r["logits"][q], T_nl)[1] >= thr[q]]
                rows.append({"id": r["id"], "stance": stance, "objects": objs, "qualifiers": quals})
            (d / name).write_text("\n".join(json.dumps(x) for x in rows) + "\n")
        print(ckd.name, "T_stance", round(T_st, 3), "T_noul", round(T_nl, 3))
    json.dump(fits, open(out / "secondary-fits.json", "w"), indent=1)


if __name__ == "__main__":
    main()
