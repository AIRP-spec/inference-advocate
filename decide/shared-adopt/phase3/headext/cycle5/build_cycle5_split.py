#!/usr/bin/env python3
"""DECLARATION-HX-CYCLE5-t245u split rebuild: data-v10g -> data-v10h. CPU, $0, no generation, no row text printed.
Pure re-assignment of existing rows between train and val; bytes of every row are copied unchanged (no field is edited,
added or removed on any row). Output order: surviving rows keep their v10g order; rows moved onto a side are appended
in v10g order. Writes train.jsonl, val.jsonl, split-meta-v10h.json (ids, groups, counts, shas only).

Rule (declared, DECLARATION-HX-CYCLE5-t245u.md section 3):
 R1. Every val group of the self_harm offer family that has 0 train rows in v10g (OFFER_HELD) moves wholly to train.
 R2. One new held-out group is drawn from the offer-family groups that have train rows (DRAW_POOL): the group with the
     lowest sha256("airp-hx-cycle5-t245u|<group>"). All of its train rows and val rows go to val (the group then has 0 train rows).
 R3. Everything else is unchanged. CSE grouping unchanged.
Asserts: pins; no id on both sides; ids preserved; no exact-content duplicate across sides; moved rows keep bytes; val rows
carry no stored class key; held-out groups have 0 train rows; self_harm val positives span >= 3 groups with >= 1 group that
has train rows (P3-3 split rule, 2026-11-01-p33-validation-split-rule.md, rule 2)."""
import hashlib, json, sys, collections
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "p32"))
V10G_TRAIN = "dd9f7841ef2576422db9941f5beb23f957f6b4147dbdee88c33f0a07b994a5a7"
V10G_VAL = "cffe55215c18cfdd17c38f8ad2173869fe7ea06f2149b73b94b378add3a561a7"
SALT = "airp-hx-cycle5-t245u"
OFFER_HELD = ["self-harm-named-method-offer", "offer-terse", "offer-terse-refusal-neg"]
DRAW_POOL = ["offer-clinical", "offer-colloquial"]
STORED_CLASS_KEYS = ("expect", "verdict", "class", "expect_classes", "classes")
SAFETY = ("child_sexual_exploitation", "self_harm")


def group(r):
    return r.get("contrastGroup") or r.get("kind") or r["family"]


def sha(b):
    return hashlib.sha256(b).hexdigest()


def draw():
    return sorted(DRAW_POOL, key=lambda g: sha(f"{SALT}|{g}".encode()))[0]


def main(train_p, val_p, comp_p, out):
    from airp_v3.compose import compose, load_composition, COMPOSITION_2A_SHA256
    tb, vb = Path(train_p).read_bytes(), Path(val_p).read_bytes()
    assert sha(tb) == V10G_TRAIN and sha(vb) == V10G_VAL, "v10g pin"
    tl = [l for l in tb.decode().split("\n") if l.strip()]; vl = [l for l in vb.decode().split("\n") if l.strip()]
    tr = [json.loads(l) for l in tl]; va = [json.loads(l) for l in vl]
    tg0 = collections.Counter(group(r) for r in tr)
    for g in OFFER_HELD:
        assert tg0[g] == 0, f"{g} already has train rows"
    drawn = draw()
    assert tg0[drawn] > 0
    to_train = [(l, r) for l, r in zip(vl, va) if group(r) in OFFER_HELD]
    to_val_from_train = [(l, r) for l, r in zip(tl, tr) if group(r) == drawn]
    keep_val = [l for l, r in zip(vl, va) if group(r) not in OFFER_HELD]
    val_extra_from_val_ok = [r for r in va if group(r) == drawn]  # drawn group's val rows stay in val
    new_tl = [l for l, r in zip(tl, tr) if group(r) != drawn] + [l for l, _ in to_train]
    new_vl = keep_val + [l for l, _ in to_val_from_train]
    ntr = [json.loads(l) for l in new_tl]; nva = [json.loads(l) for l in new_vl]
    ids_t, ids_v = [r["id"] for r in ntr], [r["id"] for r in nva]
    assert len(set(ids_t)) == len(ids_t) and len(set(ids_v)) == len(ids_v) and not set(ids_t) & set(ids_v)
    assert sorted(ids_t + ids_v) == sorted([r["id"] for r in tr] + [r["id"] for r in va]), "row set changed"
    ct = {r.get("state") or r.get("content") for r in ntr}
    assert not [1 for r in nva if (r.get("state") or r.get("content")) in ct], "exact-content duplicate across sides"
    for r in nva:
        for k in STORED_CLASS_KEYS:
            assert k not in r, (r["id"], k)
    tg = collections.Counter(group(r) for r in ntr)
    for g in OFFER_HELD:
        assert tg[g] > 0
    assert tg[drawn] == 0
    comp = load_composition(comp_p, expect_sha256=COMPOSITION_2A_SHA256)
    def P(r): return {"stance": r["stance"], "objects": r.get("objects") or [], "qualifiers": r.get("qualifiers") or []}
    meta = {"split": "data-v10h = data-v10g + DECLARATION-HX-CYCLE5-t245u split rebuild", "salt": SALT, "offer_held_moved_to_train": OFFER_HELD,
            "draw_pool": {g: sha(f"{SALT}|{g}".encode()) for g in DRAW_POOL}, "drawn_held_out_group": drawn,
            "train_n": len(ntr), "val_n": len(nva), "n_moved_to_train": len(to_train), "n_moved_to_val": len(to_val_from_train),
            "moved_to_train_ids": sorted(r["id"] for _, r in to_train), "moved_to_val_ids": sorted(r["id"] for _, r in to_val_from_train),
            "v10g_train_sha256": V10G_TRAIN, "v10g_val_sha256": V10G_VAL, "classes": {}}
    for c in SAFETY:
        vpos = [r for r in nva if c in compose(P(r), comp)]; tpos = [r for r in ntr if c in compose(P(r), comp)]
        vg = collections.Counter(group(r) for r in vpos)
        idg = {g: n for g, n in vg.items() if tg[g] > 0}; hog = {g: n for g, n in vg.items() if tg[g] == 0}
        assert len(vg) >= 3 and len(idg) >= 1, (c, vg)
        assert hog, f"{c}: no held-out group"
        meta["classes"][c] = {"val_pos": len(vpos), "val_neg": len(nva) - len(vpos), "train_pos": len(tpos),
                              "val_groups_in_distribution": idg, "val_groups_held_out": hog,
                              "train_groups": dict(collections.Counter(group(r) for r in tpos)),
                              "in_distribution_ids": sorted(r["id"] for r in vpos if tg[group(r)] > 0),
                              "held_out_ids": sorted(r["id"] for r in vpos if tg[group(r)] == 0)}
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    (out / "train.jsonl").write_bytes(("\n".join(new_tl) + "\n").encode()); (out / "val.jsonl").write_bytes(("\n".join(new_vl) + "\n").encode())
    meta["train_sha256"] = sha((out / "train.jsonl").read_bytes()); meta["val_sha256"] = sha((out / "val.jsonl").read_bytes())
    (out / "split-meta-v10h.json").write_text(json.dumps(meta, indent=1, sort_keys=True) + "\n")
    print(json.dumps({k: meta[k] for k in ("drawn_held_out_group", "train_n", "val_n", "n_moved_to_train", "n_moved_to_val", "train_sha256", "val_sha256")}))
    for c in SAFETY:
        r = meta["classes"][c]; print(c, {k: r[k] for k in ("val_pos", "val_neg", "train_pos", "val_groups_in_distribution", "val_groups_held_out")})


if __name__ == "__main__":
    main(*sys.argv[1:5])
