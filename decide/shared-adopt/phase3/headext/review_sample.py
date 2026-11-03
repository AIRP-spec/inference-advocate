#!/usr/bin/env python3
"""Hand-review sample (t217u amendment 6): 10 rows per NON-safety new head (rr, op, pe, sec, cr, ad) for Zimmer to read.
Not a gate. Built at a box path; the builder never prints or reads back row text (stdout = ids, counts and file sha only).
Selection: per head, the 10 rows with the lowest sha256(salt|review|id) among the given rows of that head's kinds.
  review_sample.py --rows ROWS.jsonl [--rows ...] --out /workspace/headext-review/sample.jsonl"""
from __future__ import annotations

import argparse, hashlib, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import headext_filter as hf  # noqa: E402

N_PER_HEAD = 10


def build(rows: list[dict], spec: dict, out_path) -> dict:
    kind_head = {k["id"]: k["head"] for k in spec["kinds"]}
    heads = spec["nonsafety_heads"]
    assert set(heads) == {"claims_relationship_role", "frames_as_own_opinion", "probes_user_emotion", "encourages_secrecy",
                          "refers_to_crisis_services", "advertises_product"}, "non-safety heads"
    key = lambda r: hashlib.sha256(f"{spec['split_salt']}|review|{r['id']}".encode()).hexdigest()
    out, ids = [], {}
    for h in heads:
        cand = sorted((r for r in rows if kind_head.get(r["provenance"]["kind_spec"]) == h), key=key)[:N_PER_HEAD]
        ids[h] = [r["id"] for r in cand]
        for r in cand:
            g = hf.gold_for(r, spec)
            out.append({"id": r["id"], "head": h, "kind": r["kind"], "kind_spec": r["provenance"]["kind_spec"],
                        "register": r["provenance"]["register"], "gold": {k: g[k] for k in ("stance", "objects", "qualifiers")},
                        "gold_head": g["ext"].get(h, 0), "content": r["content"]})
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    Path(out_path).write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in out), encoding="utf-8")
    return {"path": str(out_path), "sha256": hashlib.sha256(Path(out_path).read_bytes()).hexdigest(), "n": len(out),
            "ids": ids, "short": {h: N_PER_HEAD - len(v) for h, v in ids.items() if len(v) < N_PER_HEAD}, "gate": False}


def build_per_kind(rows: list[dict], spec: dict, out_path, ids_path=None) -> dict:
    """Second review sample (amendment t218u): 10 rows per RE-SPECIFIED kind (spec["respec_kinds"]) whose head is non-safety.
    Pair kinds: the lowest-key units, both arms, up to 10 rows. Same key as build(); not a gate."""
    kmap = {k["id"]: k for k in spec["kinds"]}
    nons = set(spec["nonsafety_heads"])
    respec = list(spec["respec_kinds"]) + [k for k in spec.get("respec_kinds_g3", []) if k not in spec["respec_kinds"]]  # t220u A24
    kinds = [k for k in respec if kmap[k]["head"] in nons and not k.startswith(("ed-", "sub-", "offer-", "cr-"))]
    key = lambda x: hashlib.sha256(f"{spec['split_salt']}|review2|{x}".encode()).hexdigest()
    out, ids = [], {}
    for kid in kinds:
        k = kmap[kid]
        cand = [r for r in rows if r["provenance"]["kind_spec"] == kid and r["content"]]
        if k.get("pair"):
            units = {}
            for r in cand:
                units.setdefault(r["pair_unit"], []).append(r)
            pick = []
            for u in sorted((u for u, v in units.items() if len(v) == 2), key=key):
                if len(pick) + 2 > N_PER_HEAD:
                    break
                pick += sorted(units[u], key=lambda r: r["arm"])
        else:
            pick = sorted(cand, key=lambda r: key(r["id"]))[:N_PER_HEAD]
        ids[kid] = [r["id"] for r in pick]
        for r in pick:
            g = hf.gold_for(r, spec)
            out.append({"id": r["id"], "head": k["head"], "kind": r["kind"], "kind_spec": kid, "arm": r.get("arm"),
                        "register": r["provenance"]["register"], "gold": {x: g[x] for x in ("stance", "objects", "qualifiers")},
                        "gold_head": g["ext"].get(k["head"], 0), "content": r["content"]})
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    Path(out_path).write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in out), encoding="utf-8")
    res = {"path": str(out_path), "sha256": hashlib.sha256(Path(out_path).read_bytes()).hexdigest(), "n": len(out), "kinds": kinds,
           "ids": ids, "short": {k: N_PER_HEAD - len(v) for k, v in ids.items() if len(v) < N_PER_HEAD}, "gate": False,
           "excluded_safety_adjacent": [k for k in respec if k not in kinds]}
    if ids_path:
        Path(ids_path).write_text(json.dumps(res, indent=1) + "\n")
    return res


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--rows", action="append", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--spec", default=str(HERE / "headext-slot-spec.json"))
    ap.add_argument("--per-respec-kind", action="store_true"); ap.add_argument("--ids-out")
    a = ap.parse_args(argv)
    rows = [r for p in a.rows for r in hf.load_jsonl(p)]
    spec = json.load(open(a.spec))
    print(json.dumps(build_per_kind(rows, spec, a.out, a.ids_out) if a.per_respec_kind else build(rows, spec, a.out)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
