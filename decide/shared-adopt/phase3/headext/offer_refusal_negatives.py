"""Ruling t226u item 2: the offer rows the checkers flagged as refusals (V-d:stance_refusal in the pack-v10c filter) leave the
offer shape. Each is kept as a NEGATIVE only if BOTH checkers' primitives compose (composition 2a) to no class; any whose
primitives (either checker) compose to self_harm is deleted, id logged. Text is never read or printed: ids, kinds, classes.
  python3 offer_refusal_negatives.py --filter-local F --labels SEED NEMO --out evidence/t226u/offer-refusals.json"""
import argparse, hashlib, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from headext_filter import load_composer  # noqa: E402


def sha(p): return hashlib.sha256(open(p, "rb").read()).hexdigest()


def labels(p):
    return {o["id"]: o.get("primitives") for o in (json.loads(l) for l in open(p) if l.strip())}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--filter-local", required=True); ap.add_argument("--labels", nargs=2, required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    fl = json.load(open(a.filter_local)); comp = load_composer()
    flagged = sorted(i for i, rs in fl["dropped"].items() if i.startswith("hx-offer-") and "V-d:stance_refusal" in rs)
    other = sorted(i for i in flagged if fl["dropped"][i] != ["V-d:stance_refusal"])
    L = {Path(p).name.split("-a25")[0].replace("labels-", ""): labels(p) for p in a.labels}
    keep, delete, missing = [], [], []
    per = {}
    for i in flagged:
        cls = {}
        for c, lab in L.items():
            if i not in lab or not isinstance(lab[i], dict): missing.append(i); break
            cls[c] = sorted(comp(lab[i]))
        else:
            per[i] = cls
            (delete if any("self_harm" in v for v in cls.values()) else keep if all(not v for v in cls.values()) else missing).append(i)
    kind = lambda i: i.rsplit("-", 1)[0].replace("hx-", "")
    by = lambda ids: {k: sorted(x for x in ids if kind(x) == k) for k in sorted({kind(x) for x in ids})}
    rep = {"ruling": "t226u item 2", "filter_local_sha256": sha(a.filter_local),
           "labels_sha256": {c: sha(p) for c, p in zip(L, a.labels)}, "composition": "2a",
           "n_flagged": len(flagged), "flagged_by_kind": {k: len(v) for k, v in by(flagged).items()},
           "n_with_other_reasons": len(other), "with_other_reasons": other,
           "n_kept_negative": len(keep), "kept_negative_by_kind": by(keep),
           "n_deleted_self_harm": len(delete), "deleted_self_harm_ids": delete,
           "n_undecided": len(missing), "undecided_ids": sorted(set(missing)),
           "composed_classes_nonempty": {i: c for i, c in per.items() if any(c.values())}}
    Path(a.out).write_text(json.dumps(rep, indent=1, sort_keys=True) + "\n")
    print(json.dumps({k: rep[k] for k in ("n_flagged", "flagged_by_kind", "n_with_other_reasons", "n_kept_negative",
                                          "n_deleted_self_harm", "deleted_self_harm_ids", "n_undecided")}))


if __name__ == "__main__":
    main()
