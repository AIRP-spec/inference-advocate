#!/usr/bin/env python3
"""Task 1d: group-held-out train/val split for the Laya retrain (PRE-DECLARATIONS.md, Amendment A4).

Unit = corpus contrastGroup when present, else the label row's kind. Units go wholly to one side.
Deterministic: 200 seeded greedy starts "20261005:{i}" + hill-climb (Amendment B), lowest objective wins.
Output rows have the same schema as the Phase 2 split (build_split.py) so the trainpack consumes
them unchanged.

Usage: build_group_split.py LABELS CORPUS SUITE OUTDIR
"""
from __future__ import annotations

import hashlib
import json
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path

LABELS_SHA = "5bdae44cd2bc520c56b09b1478c64724cb6fa3b7be0c93a63bc7262a9b9cd282"
CORPUS_SHA = "712fd64d8829b4482858ef99666356de1e304c38f3a14ce85a3f6e5235aaab74"
SUITE_SHA = "6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4"
EXCLUDE = {"tr-mention-versus-use-refusal-naming-category-0001"}  # held-out content-hash collision (bnd-05)
STANCES = ("conveys_method", "depicts", "describes", "encourages", "endorses")
NOUL = ("violence_person", "self_harm", "sexual_activity", "financial_crime", "intrusion", "weapons",
        "profanity", "is_mention_not_use", "subject_is_minor", "exceeds_common_knowledge",
        "addresses_own_nature", "asserts_interior_state", "directed_at_user", "explicit_register",
        "targets_protected_characteristic", "untethered_to_content")
N_STARTS, LO, HI, TARGET = 200, 765, 845, 805


def sha_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()


def load_jsonl(p):
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


def joined(label, c):  # identical field set to build_split.build_joined_row
    return {
        "id": label["id"], "content": c["content"], "state": c["content"], "stance": label["stance"],
        "objects": list(label.get("objects") or []), "qualifiers": list(label.get("qualifiers") or []),
        "kind": label.get("kind"), "reason": label.get("reason"), "tiebreaker": label.get("tiebreaker"),
        "family": c.get("family"), "class": c.get("class"), "arm": c.get("arm"), "expect": c.get("expect"),
        "contrastGroup": c.get("contrastGroup"), "path": c.get("path"),
        "taxonomyVersion": c.get("taxonomyVersion"), "promptTemplateVersion": c.get("promptTemplateVersion"),
    }


def main():
    labels_p, corpus_p, suite_p, out = map(Path, sys.argv[1:5])
    assert sha_file(labels_p) == LABELS_SHA, "labels SHA mismatch"
    assert sha_file(corpus_p) == CORPUS_SHA, "corpus SHA mismatch"
    assert sha_file(suite_p) == SUITE_SHA, "suite SHA mismatch"
    labels = load_jsonl(labels_p)
    corpus = {r["id"]: r for r in load_jsonl(corpus_p)}
    suite = json.load(open(suite_p))["items"]
    suite_ids = {i["id"] for i in suite}
    suite_hash = {hashlib.sha256(i["content"].encode()).hexdigest() for i in suite}

    rows = []
    for l in labels:
        if l["id"] in EXCLUDE:
            continue
        c = corpus[l["id"]]
        assert l["id"] not in suite_ids
        assert hashlib.sha256(c["content"].encode()).hexdigest() not in suite_hash, l["id"]
        rows.append(joined(l, c))
    assert len(rows) == 8055

    def unit(r):
        return ("g:" + r["contrastGroup"]) if r.get("contrastGroup") else ("k:" + str(r["kind"]))

    units = defaultdict(list)
    for r in rows:
        units[unit(r)].append(r)
    unit_keys = sorted(units)

    def pos(r):
        return set(r["objects"]) | set(r["qualifiers"])

    tot_prim = Counter(p for r in rows for p in pos(r) if p in NOUL)
    tot_st = Counter(r["stance"] for r in rows)
    prims = sorted(p for p, n in tot_prim.items() if n >= 100)
    ustats = {}
    for k in unit_keys:
        rr = units[k]
        ustats[k] = (len(rr), Counter(p for r in rr for p in pos(r) if p in NOUL), Counter(r["stance"] for r in rr))

    # Amendment B: random-greedy draws (A4) found no feasible split (is_mention_not_use and
    # targets_protected_characteristic positives sit in a few large units). Same constraints and
    # objective; search = best-improvement hill-climb (toggle one unit, or swap one in / one out)
    # from N_STARTS seeded greedy starts. Violations carry a penalty of 10 per unit of violation.
    import numpy as np
    cols = prims + ["st:" + s for s in STANCES]
    U = np.zeros((len(unit_keys), 1 + len(cols)))
    for ui, k in enumerate(unit_keys):
        sz, pc, sc = ustats[k]
        U[ui, 0] = sz
        for ci, c in enumerate(cols):
            U[ui, 1 + ci] = sc[c[3:]] if c.startswith("st:") else pc[c]
    tot = np.array([tot_prim[c] if not c.startswith("st:") else tot_st[c[3:]] for c in cols], dtype=float)
    is_prim = np.array([not c.startswith("st:") for c in cols])

    def score(V):  # V: (..., 1+len(cols)) summed val vectors -> (obj, penalty)
        n = V[..., 0]
        sh = V[..., 1:] / tot
        obj = np.abs(sh - 0.10).sum(-1)
        pen = np.where(is_prim, np.maximum(0, 0.05 - sh) + np.maximum(0, sh - 0.20), 0).sum(-1)
        pen = pen + (V[..., 1:][..., ~is_prim] < 1).sum(-1)
        pen = pen + np.maximum(0, LO - n) / 100.0 + np.maximum(0, n - HI) / 100.0
        return obj, pen

    best = None
    n_feasible = 0
    for i in range(N_STARTS):
        order = list(range(len(unit_keys)))
        random.Random(f"20261005:{i}").shuffle(order)
        x = np.zeros(len(unit_keys), dtype=bool)
        n = 0
        for ui in order:
            if n + U[ui, 0] > HI:
                continue
            x[ui] = True
            n += U[ui, 0]
            if n >= LO:
                break
        for _ in range(500):
            v = U[x].sum(0)
            o, pnl = score(v)
            cur = o + 10 * pnl
            sign = np.where(x, -1.0, 1.0)
            Vt = v + sign[:, None] * U                     # toggles
            ot, pt = score(Vt)
            ct = ot + 10 * pt
            ins, outs = np.where(~x)[0], np.where(x)[0]
            Vs = v + U[ins][:, None, :] - U[outs][None, :, :]  # swaps
            os_, ps_ = score(Vs)
            cs = os_ + 10 * ps_
            bt = ct.min() if len(ct) else np.inf
            bs = cs.min() if cs.size else np.inf
            if min(bt, bs) >= cur - 1e-12:
                break
            if bt <= bs:
                x[int(ct.argmin())] ^= True
            else:
                a, b = np.unravel_index(int(cs.argmin()), cs.shape)
                x[ins[a]] = True
                x[outs[b]] = False
        v = U[x].sum(0)
        o, pnl = score(v)
        if pnl > 0:
            continue
        n_feasible += 1
        if best is None or o < best[0] - 1e-12:
            sel = [unit_keys[ui] for ui in np.where(x)[0]]
            vp, vs = Counter(), Counter()
            for k in sel:
                vp.update(ustats[k][1]); vs.update(ustats[k][2])
            shares = {p: vp[p] / tot_prim[p] for p in prims}
            best = (float(o), i, sel, int(v[0]), shares, dict(vs))
    if best is None:
        raise SystemExit("no feasible split under Amendment A4/B constraints")
    obj, draw, sel, n, shares, vs = best
    val_units = set(sel)
    train = sorted([r for k in unit_keys if k not in val_units for r in units[k]], key=lambda r: r["id"])
    val = sorted([r for k in sel for r in units[k]], key=lambda r: r["id"])
    assert len(train) + len(val) == 8055 and not ({r["id"] for r in train} & {r["id"] for r in val})

    tr_groups = {r["contrastGroup"] for r in train if r.get("contrastGroup")}
    va_groups = {r["contrastGroup"] for r in val if r.get("contrastGroup")}
    tr_kinds = {r["kind"] for r in train}
    out.mkdir(parents=True, exist_ok=True)

    def dump(p, rr):
        with open(p, "w", encoding="utf-8") as f:
            for r in rr:
                f.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")
    dump(out / "train.jsonl", train)
    dump(out / "val.jsonl", val)
    meta = {
        "splitVersion": "laya-airp-group-v1",
        "splitMethod": "by_unit(contrastGroup else kind), whole units held out",
        "predeclared": "tools/evaluator-training/laya/PRE-DECLARATIONS.md Amendment A4",
        "labels_sha256": LABELS_SHA, "corpus_sha256": CORPUS_SHA, "suite_sha256": SUITE_SHA,
        "excluded": sorted(EXCLUDE), "eligible_n": len(rows),
        "train_n": len(train), "val_n": len(val),
        "train_sha256": sha_file(out / "train.jsonl"), "val_sha256": sha_file(out / "val.jsonl"),
        "n_units": len(unit_keys), "n_val_units": len(sel), "val_units": sorted(sel),
        "search": "Amendment B hill-climb", "n_starts": N_STARTS, "n_feasible": n_feasible, "chosen_start": draw, "objective": obj,
        "primitive_val_share": shares, "primitives_constrained": prims,
        "val_stance_counts": vs, "total_stance_counts": dict(tot_st),
        "val_positive_counts": dict(Counter(p for r in val for p in pos(r))),
        "train_positive_counts": dict(Counter(p for r in train for p in pos(r))),
        "checks": {
            "contrastGroups_in_both": len(tr_groups & va_groups),
            "val_rows_with_group": sum(1 for r in val if r.get("contrastGroup")),
            "val_rows_whose_kind_in_train": sum(1 for r in val if r["kind"] in tr_kinds),
            "val_kinds_also_in_train": sorted({r["kind"] for r in val if r["kind"] in tr_kinds}),
            "train_val_id_disjoint": True,
            "held_out_ids_or_content_in_split": 0,
        },
    }
    json.dump(meta, open(out / "split-meta.json", "w"), indent=2)
    print(json.dumps({k: meta[k] for k in ("train_n", "val_n", "train_sha256", "val_sha256", "chosen_start",
                                           "objective", "n_feasible", "n_val_units", "checks")}, indent=1))


if __name__ == "__main__":
    main()
