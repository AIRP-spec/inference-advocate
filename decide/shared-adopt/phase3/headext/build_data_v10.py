#!/usr/bin/env python3
"""data-v10 pack builder (sizing addendum signed t217u, sections 6-7, as amended). Box only, $0. No text printed.

data-v9 train (pinned) + RH-overlay val (pinned, = data-v9 val with the 20 rh-denial rows relabelled) + the selected
generated rows (headext_filter.select) -> data-v10/{train,val}.jsonl + build report (counts, ids, shas).

Gold for new rows: slot-spec gold, produced through relabel-from-slots.mjs (mapKindToPrimitives over the appended
kind-label-table entries) and asserted equal to the slot spec; new-head labels in the separate `ext` field; terse-register
rows add explicit_register. Existing rows are copied byte-for-byte (no `ext` field => 0 on every new head; amendment 7
excluded kinds are masked at preprocess/scoring, never relabelled).

Asserts: pins; overlay differs from data-v9 val in exactly the 20 rh-denial rows; existing lines byte-identical; ids unique
and on one side only; no exact-content duplicate across sides; held-out groups (last group per head, offer-terse) have
0 train rows; register order; >= 60 in-distribution val positives per new head; >= 6 val pairs per new head; V3 row
counts; val rows carry no stored class key; p32_val.load_val_derived passes on val.
"""
from __future__ import annotations

import argparse, hashlib, json, subprocess, sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE / "pack"))
import headext_slots as hs  # noqa: E402
import headext_filter as hf  # noqa: E402
from common_shared import EXT_HEADS, is_excluded, load_excluded  # noqa: E402

V9_TRAIN_SHA = "13c86ea732f3bcc616b58e8ec5c846557fe6a8ccb91bb58b6ba505f140063a28"
V9_VAL_SHA = "964c2b2198572823846364c7f30d4e6c44d8c9bf09fc59a0731f0ce7af7ecd2d"
RH_OVERLAY_VAL_SHA = "a0b3b2f5201c7bc197e3987befe73f4968dbf54bce946627f1e2348ec141c1e0"
RELABEL = HERE.parents[3] / "tools" / "evaluator-training" / "primitives" / "relabel-from-slots.mjs"
TABLE = HERE.parents[3] / "tools" / "evaluator-training" / "primitives" / "kind-label-table.json"
STORED_CLASS_KEYS = ("expect", "verdict", "class", "expect_classes", "classes")
FLOOR_IN_DIST = 60
MIN_PAIRS = 6
V3_KINDS = {"a": ["ed-mention", "ed-class-refusal", "sub-mention", "sub-class-refusal"], "b": ["ad-professional-referral"],
            "c": ["cr-resource-in-fiction"]}


class BuildError(AssertionError):
    pass


def need(c, m):
    if not c:
        raise BuildError(m)


def sha_bytes(b):
    return hashlib.sha256(b).hexdigest()


def read_lines(p, pin=None):
    raw = Path(p).read_bytes()
    if pin is not None:
        need(sha_bytes(raw) == pin, f"{p} sha {sha_bytes(raw)} != pin {pin}")
    return [l for l in raw.decode("utf-8").split("\n") if l.strip()]


def relabel_kinds(kinds: list[str]) -> dict:
    """mapKindToPrimitives (relabel-from-slots.mjs) for each kind; ext read from the same table entry."""
    js = ("import(process.argv[1]).then(m=>{const ks=JSON.parse(process.argv[2]);const o={};"
          "for(const k of ks){const p=m.mapKindToPrimitives(k,null,null,null,null);o[k]={stance:p.stance,objects:p.objects,qualifiers:p.qualifiers}};"
          "console.log(JSON.stringify(o))})")
    r = subprocess.run(["node", "-e", js, RELABEL.as_uri(), json.dumps(kinds)], capture_output=True, text=True, check=True)
    out = json.loads(r.stdout)
    table = json.load(open(TABLE))["table"]
    for k in kinds:
        out[k]["ext"] = list(table[k].get("ext", []))
    return out


def group_of(r):
    return r.get("contrastGroup") or r.get("kind") or r.get("family")


def new_row(sel: dict, spec: dict, lab: dict) -> dict:
    g = hf.gold_for(sel, spec)
    reg_q = spec["register_qualifiers"].get(sel["provenance"]["register"], [])
    base_q = [q for q in g["qualifiers"] if q not in reg_q or q in lab["qualifiers"]]
    need((g["stance"], sorted(g["objects"]), sorted(base_q)) == (lab["stance"], sorted(lab["objects"]), sorted(lab["qualifiers"])),
         f"{sel['id']}: slot-spec gold != relabel-from-slots for kind {sel['kind']}")
    need(sorted(h for h, v in g["ext"].items() if v) == sorted(lab["ext"]), f"{sel['id']}: ext != table")
    p = sel["provenance"]
    r = {"id": sel["id"], "family": p["family"], "kind": sel["kind"]}
    if sel.get("contrastGroup"):
        r.update({"contrastGroup": sel["contrastGroup"], "arm": sel["arm"], "pair": sel["pair_unit"], "pair_id": sel["pair_unit"]})
    r.update({"register": p["register"], "length": p["length"], "content": sel["content"], "state": sel["content"],
              "taxonomyVersion": "v0.4.0", "promptTemplateVersion": "headext-v10-1", "stance": g["stance"],
              "objects": g["objects"], "qualifiers": g["qualifiers"], "ext": g["ext"], "tiebreaker": False,
              "reason": "headext slot-spec gold (relabel-from-slots)", "path": "headext-generated",
              "source": {"model_key": p["model_key"], "revision": p["revision"], "slot_spec_sha256": p["slot_spec_sha256"],
                         "kind_spec": p["kind_spec"], "cell": p["cell"], "sample": p["sample"]}})
    if sel.get("contrastGroup"):
        r["source"]["pair_id"] = sel["pair_unit"]  # A28 (t221u): pair id on both arms, row + provenance
    k = hf.kind_by_id(spec)[p["kind_spec"]]
    if k.get("ext_excluded"):  # t227u (A31): derived offer-refusal negatives
        need(set(k["ext_excluded"]) <= set(spec["heads"]) and not any(g["ext"][h] for h in k["ext_excluded"]), f"{sel['id']}: ext_excluded")
        r["ext_excluded"] = list(k["ext_excluded"])
        r["source"]["retag"] = p.get("retag")
    return r


def is_pos(head, r):
    return int((r.get("ext") or {}).get(head, 0)) == 1


def build(v9_train, overlay_val, v9_val, sel_train, sel_val, spec_path, spec_sha, out_dir, p32_pack=None):
    spec, _ = hs.load_pinned(spec_path, spec_sha)
    need([r["id"] for r in spec["registers"]] == ["clinical", "colloquial", "terse"], "register order")
    tr_lines = read_lines(v9_train, V9_TRAIN_SHA)
    va_lines = read_lines(overlay_val, RH_OVERLAY_VAL_SHA)
    v9va = [json.loads(l) for l in read_lines(v9_val, V9_VAL_SHA)]
    ov = [json.loads(l) for l in va_lines]
    need([r["id"] for r in ov] == [r["id"] for r in v9va], "overlay ids/order differ from data-v9 val")
    diff = [a["id"] for a, b in zip(ov, v9va) if a != b]
    need(len(diff) == 20 and all("rh-denial" in i for i in diff), f"overlay differs in {len(diff)} rows (expected the 20 rh-denial rows)")
    st = [json.loads(l) for l in open(sel_train, encoding="utf-8") if l.strip()]
    sv = [json.loads(l) for l in open(sel_val, encoding="utf-8") if l.strip()]
    labs = relabel_kinds(sorted({r["kind"] for r in st + sv}))
    ntr = sorted((new_row(r, spec, labs[r["kind"]]) for r in st), key=lambda r: r["id"])
    nva = sorted((new_row(r, spec, labs[r["kind"]]) for r in sv), key=lambda r: r["id"])
    out_dir = Path(out_dir); out_dir.mkdir(parents=True, exist_ok=True)
    dump = lambda rows: "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows)
    train_text = "\n".join(tr_lines) + "\n" + dump(ntr)
    val_text = "\n".join(va_lines) + "\n" + dump(nva)
    (out_dir / "train.jsonl").write_text(train_text, encoding="utf-8")
    (out_dir / "val.jsonl").write_text(val_text, encoding="utf-8")
    return check(out_dir, spec, tr_lines, va_lines, p32_pack) | {"spec_sha256": spec_sha}


def check(out_dir, spec, tr_lines, va_lines, p32_pack=None) -> dict:
    out_dir = Path(out_dir)
    tl = read_lines(out_dir / "train.jsonl"); vl = read_lines(out_dir / "val.jsonl")
    need(tl[: len(tr_lines)] == tr_lines and vl[: len(va_lines)] == va_lines, "existing rows not byte-identical")
    tr = [json.loads(l) for l in tl]; va = [json.loads(l) for l in vl]
    for r in tr[: len(tr_lines)] + va[: len(va_lines)]:
        need("ext" not in r, f"existing row {r['id']} carries ext (new-head gold must be 0, mapped list empty)")
    ids_t, ids_v = [r["id"] for r in tr], [r["id"] for r in va]
    need(len(set(ids_t)) == len(ids_t) and len(set(ids_v)) == len(ids_v), "duplicate ids")
    need(not set(ids_t) & set(ids_v), "id on both sides")
    ct = {r.get("state") or r.get("content") for r in tr}
    need(not [r["id"] for r in va if (r.get("state") or r.get("content")) in ct], "exact-content duplicate across sides")
    for r in va:
        for k in STORED_CLASS_KEYS:
            need(k not in r, f"val row {r['id']} carries stored class key {k}")
    for side in (tr, va):
        arms = defaultdict(set)
        for r in side:
            if r.get("pair") and r.get("path") == "headext-generated":
                need(r.get("pair_id") == r["pair"] == r["source"].get("pair_id"), f"{r['id']}: pair_id missing or differs (A28)")
                arms[r["pair_id"]].add(r["arm"])
        need(all(v == {"A", "B"} for v in arms.values()), "a pair_id without both arms on one side (A28)")
    train_groups = Counter(group_of(r) for r in tr)
    held_kinds = {g[-1] for g in spec["head_groups"].values()} | {k["id"] for k in spec["kinds"] if k.get("held_out")}
    for k in held_kinds:
        need(train_groups.get(k, 0) == 0, f"held-out group {k} has train rows")
    need(spec["kinds"][[k["id"] for k in spec["kinds"]].index("offer-terse")]["registers"] == ["terse"], "offer-terse register")
    excluded = load_excluded()
    rep = {"n_train": len(tr), "n_val": len(va), "n_new_train": len(tr) - len(tr_lines), "n_new_val": len(va) - len(va_lines),
           "train_sha256": sha_bytes((out_dir / "train.jsonl").read_bytes()), "val_sha256": sha_bytes((out_dir / "val.jsonl").read_bytes()),
           "heads": {}, "v3_rows": {}, "excluded_existing": {}, "below_floor": []}
    for h in EXT_HEADS:
        pos = [r for r in va if is_pos(h, r)]
        ind = [r for r in pos if train_groups.get(group_of(r), 0) > 0]
        held = [r for r in pos if train_groups.get(group_of(r), 0) == 0]
        pairs = defaultdict(set)
        for r in va:
            if r.get("pair") and r.get("contrastGroup") in spec["head_groups"][h]:
                pairs[r["pair"]].add(r["arm"])
        n_pairs = sum(1 for v in pairs.values() if v == {"A", "B"})
        rep["heads"][h] = {"val_pos_in_distribution": len(ind), "val_pos_held_out": len(held), "val_pairs": n_pairs,
                           "train_pos": sum(1 for r in tr if is_pos(h, r)),
                           "held_out_groups": sorted({group_of(r) for r in held})}
        rep["excluded_existing"][h] = {"train": sum(1 for r in tr if is_excluded(h, r, excluded)),
                                       "val": sum(1 for r in va if is_excluded(h, r, excluded))}
        if len(ind) < FLOOR_IN_DIST or n_pairs < MIN_PAIRS:
            rep["below_floor"].append(h)
    for c, ks in V3_KINDS.items():
        rep["v3_rows"][c] = sum(1 for r in va if r.get("kind") in ks)
    rep["offer"] = {k: {"train": sum(1 for r in tr if r.get("kind") == k), "val": sum(1 for r in va if r.get("kind") == k)}
                    for k in ("offer-clinical", "offer-colloquial", "offer-terse", "self-harm-named-method-offer",
                              "offer-refusal-neg", "offer-terse-refusal-neg")}
    rep["hate_pairs"] = {s: len({r["pair"] for r in rows if r.get("contrastGroup") == "hate-elim-vs-self-harm" and "pair" in r})
                         for s, rows in (("train", tr), ("val", va))}
    if p32_pack:
        sys.path.insert(0, str(p32_pack))
        import p32_val
        from airp_v3.compose import load_composition
        comp = load_composition(Path(p32_pack) / "spec" / "composition-2a.json")
        rows = p32_val.load_val_derived(out_dir / "val.jsonl", comp, val_sha=None)
        rep["p32_val_rows"] = len(rows)
    return rep


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for a in ("--v9-train", "--overlay-val", "--v9-val", "--sel-train", "--sel-val", "--expect-spec-sha", "--out-dir"):
        ap.add_argument(a, required=True)
    ap.add_argument("--p32-pack", default=None)
    ap.add_argument("--report", default=None)
    a = ap.parse_args(argv)
    rep = build(a.v9_train, a.overlay_val, a.v9_val, a.sel_train, a.sel_val, hs.SPEC, a.expect_spec_sha, a.out_dir, a.p32_pack)
    if a.report:
        Path(a.report).write_text(json.dumps(rep, indent=1) + "\n")
    print(json.dumps({k: rep[k] for k in ("n_train", "n_val", "n_new_train", "n_new_val", "below_floor", "train_sha256", "val_sha256")}))
    return 1 if rep["below_floor"] else 0


if __name__ == "__main__":
    sys.exit(main())
