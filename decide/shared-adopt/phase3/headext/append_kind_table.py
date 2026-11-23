#!/usr/bin/env python3
"""Append the head-extension kinds to tools/evaluator-training/primitives/kind-label-table.json (sizing addendum 4).
Existing entries are never changed (asserted); new keys must be absent. Each new entry carries `ext` (new-head labels).
Pair arms use the key <group>-a / <group>-b; the hate pair reuses the existing hate-eliminationist / hate-vs-sh-sh
entries (asserted equal to the slot-spec gold, not rewritten). Idempotent: a second run with the same spec is a no-op."""
import json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TABLE = HERE.parents[3] / "tools" / "evaluator-training" / "primitives" / "kind-label-table.json"


def spec_entries(spec):
    out = {}
    for k in spec["kinds"]:
        if k.get("pair"):
            for a in k["arms"]:
                out[a.get("kind") or f"{k['id']}-{a['arm'].lower()}"] = (a["gold"], f"headext {k['id']} arm {a['arm']}")
        else:
            out[k["id"]] = (k["gold"], f"headext {k['role']} kind ({k['head']})")
    return out


def entry(g, reason):
    return {"stance": g["stance"], "objects": list(g["objects"]), "qualifiers": list(g["qualifiers"]), "needsTiebreaker": False,
            "reason": reason + " (slot-spec gold; terse-register rows add explicit_register)", "ext": list(g["ext"])}


def main(spec_path=HERE / "headext-slot-spec.json", table_path=TABLE):
    spec = json.load(open(spec_path))
    raw = Path(table_path).read_text("utf-8")
    d = json.loads(raw)
    assert json.dumps(d, indent=1) + "\n" == raw, "table formatting would change"
    t = d["table"]
    before = json.dumps(t, sort_keys=True)
    added, reused = [], []
    for key, (g, reason) in spec_entries(spec).items():
        if key in t:
            e = t[key]
            same = (e["stance"], sorted(e["objects"]), sorted(e["qualifiers"]), sorted(e.get("ext", []))) == \
                   (g["stance"], sorted(g["objects"]), sorted(g["qualifiers"]), sorted(g["ext"]))
            assert same, f"existing entry {key} differs from slot-spec gold"
            reused.append(key)
        else:
            t[key] = entry(g, reason); added.append(key)
    old = json.loads(before)
    assert all(t[k] == v for k, v in old.items()), "an existing entry changed"
    Path(table_path).write_text(json.dumps(d, indent=1) + "\n", encoding="utf-8")
    return {"added": len(added), "reused": reused, "n_entries": len(t)}


if __name__ == "__main__":
    print(json.dumps(main()))
