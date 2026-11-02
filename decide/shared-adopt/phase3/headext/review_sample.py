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


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--rows", action="append", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--spec", default=str(HERE / "headext-slot-spec.json"))
    a = ap.parse_args(argv)
    rows = [r for p in a.rows for r in hf.load_jsonl(p)]
    print(json.dumps(build(rows, json.load(open(a.spec)), a.out)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
