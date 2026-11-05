"""t235u adopt: restore 11 units with author-written denial B, unpaired positives from 5 uptake candidates,
exclude 5 one-checker disputed rows from train/val, accept checker deletions already applied in set-t234."""
from __future__ import annotations
import argparse, json, hashlib
from pathlib import Path

UPTAKE = ["013", "022", "023", "031", "049"]
BARE = ["009", "011", "019", "027", "036", "052"]
ALL11 = BARE + UPTAKE
EXCLUDED = [
    "hx-cr-direct-vs-fiction-006-b", "hx-cr-direct-vs-fiction-007-b",
    "hx-cr-direct-vs-fiction-024-b", "hx-cr-direct-vs-fiction-034-b",
    "hx-cr-resource-in-fiction-dialogue-023",
]


def jl(p):
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def adopt(set_t234, set_t227, authored, gen, v4_seed, v4_nemo, out_set, excluded_path, log_path):
    base = jl(set_t234)
    old = {r["id"]: r for r in jl(set_t227)}
    auth = {r["id"]: r for r in jl(authored)}
    gen_rows = {r["id"]: r for r in jl(gen)}
    v4s = {v["id"]: v for v in jl(v4_seed)}
    v4n = {v["id"]: v for v in jl(v4_nemo)}

    # restore 11 pairs: A from t227 + authored B
    restored = []
    for u in ALL11:
        unit = f"hx-rr-claim-vs-deny-{u}"
        a, b = old[f"{unit}-a"], auth[f"{unit}-b"]
        restored.extend([a, b])

    # unpaired positives from uptake candidates: prefer r0 if it was the uptake sample, else first present
    unpaired = []
    for u in UPTAKE:
        unit = f"hx-rr-claim-vs-deny-{u}"
        pick = None
        for c in (0, 1):
            i = f"{unit}-b-r{c}"
            if i in gen_rows:
                pick = i; break
        if pick is None:
            raise SystemExit(f"missing uptake candidate for {unit}")
        src = gen_rows[pick]
        row = {
            "id": f"{pick}-unpaired",
            "content": src["content"],
            "kind": "rr-role-claim",  # non-pair positive for claims_relationship_role
            "provenance": {
                **{k: src["provenance"].get(k) for k in (
                    "family", "head", "register", "length", "cell", "n_words", "length_in_band", "empty",
                    "model_key", "hf_id", "revision", "slot_spec_sha256", "temperature", "finish_reason",
                    "host", "timestamp")},
                "kind_spec": "rr-role-claim",
                "role": "P",
                "unpaired_positive_of": pick,
                "ruling": "t235u-1",
                "source": "g5-rearm-uptake-candidate",
            },
        }
        unpaired.append(row)

    # excluded-disputed: record flagging checker + primitive; remove from pack set
    excluded = []
    for i in EXCLUDED:
        src = next(r for r in base if r["id"] == i)
        flags = []
        for name, table in (("seed-oss-36b", v4s), ("nemotron-3-super", v4n)):
            v = table.get(i) or {}
            if v.get("contradicts") is True:
                flags.append({"checker": name, "primitive": v.get("primitive")})
        excluded.append({
            "id": i, "status": "excluded-disputed", "ruling": "t235u-2",
            "flagging": flags, "kind_spec": src["provenance"]["kind_spec"],
            "note": "not read; not deleted; excluded from train and validation",
        })

    drop_ids = set(EXCLUDED)
    kept = [r for r in base if r["id"] not in drop_ids]
    # ensure the 11 units are not already present
    units = {f"hx-rr-claim-vs-deny-{u}" for u in ALL11}
    kept = [r for r in kept if r.get("pair_unit") not in units]
    ids = {r["id"] for r in kept}
    add = restored + unpaired
    if ids & {r["id"] for r in add}:
        raise SystemExit(f"id collision: {ids & {r['id'] for r in add}}")
    out = kept + sorted(add, key=lambda r: r["id"])
    Path(out_set).write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in out), encoding="utf-8")
    Path(excluded_path).write_text(json.dumps({"ruling": "t235u-2", "n": len(excluded), "rows": excluded}, indent=1) + "\n")
    log = {
        "ruling": "t235u",
        "set_in_sha256": sha(set_t234),
        "set_out_sha256": sha(out_set),
        "n_set_in": len(base), "n_set_out": len(out),
        "n_restored_pair_rows": len(restored), "n_unpaired_positives": len(unpaired),
        "n_excluded_disputed": len(excluded),
        "authored_denial_units": [f"hx-rr-claim-vs-deny-{u}" for u in ALL11],
        "unpaired_positive_ids": [r["id"] for r in unpaired],
        "bare_denial_candidates_dropped": [f"hx-rr-claim-vs-deny-{u}" for u in BARE],
        "excluded_disputed_ids": EXCLUDED,
        "checker_deletions_accepted": True,
        "reading": (
            "All 11 units get author-written denial B (A from set-t227). "
            "Five uptake candidates kept as unpaired positives under kind rr-role-claim. "
            "Six bare-denial candidates dropped. Five one-checker flags excluded-disputed."
        ),
    }
    Path(log_path).write_text(json.dumps(log, indent=1) + "\n")
    return log


def main(argv=None):
    ap = argparse.ArgumentParser()
    for x in ("--set-t234", "--set-t227", "--authored", "--gen", "--v4-seed", "--v4-nemo",
              "--out-set", "--excluded", "--log"):
        ap.add_argument(x, required=True)
    a = ap.parse_args(argv)
    r = adopt(a.set_t234, a.set_t227, a.authored, a.gen, a.v4_seed, a.v4_nemo, a.out_set, a.excluded, a.log)
    print(json.dumps({k: r[k] for k in ("n_set_in", "n_set_out", "n_restored_pair_rows", "n_unpaired_positives",
                                        "n_excluded_disputed", "set_out_sha256")}))


if __name__ == "__main__":
    main()
