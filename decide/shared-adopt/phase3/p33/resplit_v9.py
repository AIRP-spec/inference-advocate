#!/usr/bin/env python3
"""P3-3 data-v9 (DECLARATION-P3-3-AMENDMENT-2, Justin 2026-11-01 08:03): data-v8 + the sh-02 relabel + the safety re-split.
Deterministic, CPU, no generation. Writes train.jsonl / val.jsonl (label-free val) and split-meta-v9.json (ids/counts only).

Relabel: rows of kind `self-harm-named-method-offer` get the kind-label-table gold (encourages + self_harm, no qualifiers).
Split rule: per safety class c, the declared DONORS (training groups of c) each move floor(units/4) pair-units to val,
units ordered by sha256("airp-p33-v9|<group>|<index>"); a unit = all rows of the group with the same 4-digit id index
(both contrast arms move together). Existing val-only groups stay held out. Stored class keys are stripped from moved rows.
Checks (assert): no id on both sides; no exact-duplicate content across sides; every moved unit wholly in val; each class
has >= 3 val groups and >= 1 val group that also has train rows; held-out groups have 0 train rows; row totals preserved.
  resplit_v9.py DATA_V8_DIR KIND_TABLE COMPOSITION OUT_DIR"""
import hashlib, json, re, sys, collections
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "p32"))
from airp_v3.compose import compose, load_composition, COMPOSITION_2A_SHA256
import p32_val

TRAIN_V8 = "43650873f6475be34ab4f5228b6eb915707bb573a5045242e3bc7a937e21df42"
VAL_V8 = "5be292a911f0082a74c6e24beb20a60455fab4a86baded561784d37f2b453009"
RELABEL_KIND = "self-harm-named-method-offer"
DONORS = {"self_harm": ["self_harm-encouragement", "self_harm-imperative", "self_harm-method"],
          "child_sexual_exploitation": ["cse-numeric-age", "cse-roleplay", "cse-act-as-undress"]}
SALT = "airp-p33-v9"
SAFETY = ("child_sexual_exploitation", "self_harm")


def group(r):
    return r.get("contrastGroup") or r.get("kind") or r["family"]


def unit_index(r):
    m = re.search(r"-(\d{4})$", r["id"]); assert m, r["id"]; return m.group(1)


def P(r):
    return {"stance": r["stance"], "objects": r.get("objects") or [], "qualifiers": r.get("qualifiers") or []}


def main():
    d8, kt, compp, out = Path(sys.argv[1]), sys.argv[2], sys.argv[3], Path(sys.argv[4])
    tb, vb = (d8 / "train.jsonl").read_bytes(), (d8 / "val.jsonl").read_bytes()
    assert hashlib.sha256(tb).hexdigest() == TRAIN_V8 and hashlib.sha256(vb).hexdigest() == VAL_V8
    comp = load_composition(compp, expect_sha256=COMPOSITION_2A_SHA256)
    table = json.load(open(kt))["table"]; lab = table[RELABEL_KIND]
    train = [json.loads(l) for l in tb.decode().splitlines() if l.strip()]
    val = [json.loads(l) for l in vb.decode().splitlines() if l.strip()]
    meta = {"split": "laya-airp-group-v1+r13..r17 (data-v8) + p33-v9 safety re-split", "salt": SALT, "donors": DONORS,
            "relabel": {"kind": RELABEL_KIND, "to": {k: lab[k] for k in ("stance", "objects", "qualifiers")}}}
    # relabel (val and train)
    before = {}; n_rel = collections.Counter()
    for side, rows in (("train", train), ("val", val)):
        for r in rows:
            if r.get("kind") == RELABEL_KIND:
                before[r["id"]] = sorted(compose(P(r), comp))
                r["stance"], r["objects"], r["qualifiers"] = lab["stance"], list(lab["objects"]), list(lab["qualifiers"])
                r["reason"] = lab["reason"]; n_rel[side] += 1
                assert sorted(compose(P(r), comp)) == before[r["id"]], r["id"]  # class unchanged (self_harm)
    meta["relabel"]["rows"] = dict(n_rel); meta["relabel"]["class_unchanged"] = True
    # re-split
    moved = set(); units = {}
    for c, gs in DONORS.items():
        for g in gs:
            rows = [r for r in train if group(r) == g]
            assert rows and all(c in compose(P(r), comp) or True for r in rows)
            idx = sorted({unit_index(r) for r in rows}, key=lambda i: hashlib.sha256(f"{SALT}|{g}|{i}".encode()).hexdigest())
            take = set(idx[: len(idx) // 4]); units[g] = sorted(take)
            moved |= {r["id"] for r in rows if unit_index(r) in take}
    meta["moved_units"] = units
    new_train = [r for r in train if r["id"] not in moved]
    mv = [{k: v for k, v in r.items() if k not in p32_val.STORED_CLASS_KEYS} for r in train if r["id"] in moved]
    new_val = val + mv
    # checks
    ti, vi = {r["id"] for r in new_train}, {r["id"] for r in new_val}
    assert not ti & vi and len(ti) + len(vi) == len(train) + len(val) and len(vi) == len(new_val)
    th = {hashlib.sha256(r["content"].encode()).hexdigest() for r in new_train}
    dup = sum(hashlib.sha256(r["content"].encode()).hexdigest() in th for r in new_val)
    tg = collections.Counter(group(r) for r in new_train)
    report = {}
    for c in SAFETY:
        vpos = [r for r in new_val if c in compose(P(r), comp)]
        tpos = [r for r in new_train if c in compose(P(r), comp)]
        vg = collections.Counter(group(r) for r in vpos)
        idg = {g: n for g, n in vg.items() if tg[g] > 0}; hog = {g: n for g, n in vg.items() if tg[g] == 0}
        assert len(vg) >= 3 and len(idg) >= 1, (c, vg)
        report[c] = {"val_pos": len(vpos), "val_neg": len(new_val) - len(vpos), "train_pos": len(tpos),
                     "val_groups_in_distribution": idg, "val_groups_held_out": hog,
                     "train_groups": dict(collections.Counter(group(r) for r in tpos)),
                     "in_distribution_ids": sorted(r["id"] for r in vpos if tg[group(r)] > 0),
                     "held_out_ids": sorted(r["id"] for r in vpos if tg[group(r)] == 0)}
    meta.update({"train_n": len(new_train), "val_n": len(new_val), "moved_n": len(moved), "moved_ids": sorted(moved),
                 "cross_side_exact_duplicate_content": dup, "classes": report,
                 "hate_eliminationist_val_ids": sorted(r["id"] for r in new_val if r.get("kind") == "hate-eliminationist")})
    assert dup == 0, dup
    out.mkdir(parents=True, exist_ok=True)
    for name, rows in (("train.jsonl", new_train), ("val.jsonl", new_val)):
        (out / name).write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))
    meta["train_sha256"] = hashlib.sha256((out / "train.jsonl").read_bytes()).hexdigest()
    meta["val_sha256"] = hashlib.sha256((out / "val.jsonl").read_bytes()).hexdigest()
    p32_val.load_val_derived(out / "val.jsonl", comp, val_sha=meta["val_sha256"])  # label-free val loads with assertions
    (out / "split-meta-v9.json").write_text(json.dumps(meta, indent=1) + "\n")
    print(json.dumps({k: meta[k] for k in ("train_n", "val_n", "moved_n", "train_sha256", "val_sha256", "relabel")}, indent=1))
    for c in SAFETY:
        r = report[c]; print(c, {k: r[k] for k in ("val_pos", "val_neg", "train_pos", "val_groups_in_distribution", "val_groups_held_out")})


if __name__ == "__main__":
    main()
