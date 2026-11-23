"""Amendment t221u A25 (offer rule): inputs for the offer-row checker pod, and the box-side decision afterwards.
Never prints or reads row text (ids, counts and shas only).
  python3 headext_a25.py inputs --set set-t220.jsonl --items items-set-t220.jsonl --out-dir DIR --expect-spec-sha SHA
  python3 headext_a25.py decide --set set-t220.jsonl --inputs-manifest DIR/a25-inputs.json --pod-out OUT \
      --expect-spec-sha SHA --log a25-decision.json --set-out set-t221.jsonl"""
from __future__ import annotations

import argparse, hashlib, json, sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import headext_slots as hs  # noqa: E402
import headext_filter as hf  # noqa: E402
import headext_contradict as hc  # noqa: E402

OFFER_KINDS = ("offer-clinical", "offer-colloquial", "offer-terse")
CHECKERS = ("seed-oss-36b", "nemotron-3-super")


def sha(p) -> str:
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def jl(p):
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


def wjl(p, rows):
    Path(p).write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")


def inputs(set_path, items_path, out_dir, spec_sha) -> dict:
    hs.load_pinned(hs.SPEC, spec_sha)
    out_dir = Path(out_dir); out_dir.mkdir(parents=True, exist_ok=True)
    rows = [r for r in jl(set_path) if r["provenance"]["kind_spec"] in OFFER_KINDS]
    ids = {r["id"] for r in rows}
    items = {i["id"]: i for i in jl(items_path) if i["id"] in ids}
    if set(items) != ids:
        raise SystemExit(f"items missing for {len(ids - set(items))} offer rows")
    rows.sort(key=lambda r: r["id"])
    wjl(out_dir / "rows-offer.jsonl", rows)
    wjl(out_dir / "items-offer.jsonl", [items[r["id"]] for r in rows])
    m = {"amendment": "A25 (t221u)", "set_sha256": sha(set_path), "items_source_sha256": sha(items_path), "spec_sha256": spec_sha,
         "n_rows": len(rows), "by_kind": dict(Counter(r["provenance"]["kind_spec"] for r in rows)),
         "rows_sha256": sha(out_dir / "rows-offer.jsonl"), "items_sha256": sha(out_dir / "items-offer.jsonl"),
         "ids": sorted(ids)}
    (out_dir / "a25-inputs.json").write_text(json.dumps(m, indent=1) + "\n")
    return m


def decide(set_path, manifest, pod_out, spec_sha, log_path, set_out) -> dict:
    spec, _ = hs.load_pinned(hs.SPEC, spec_sha)
    m = json.loads(Path(manifest).read_text())
    if sha(set_path) != m["set_sha256"]:
        raise SystemExit("set changed since the A25 inputs were built")
    pod_out = Path(pod_out)
    ids = set(m["ids"])
    remaining = {r["id"] for r in jl(pod_out / "rows-offer.jsonl")}
    if not remaining <= ids:
        raise SystemExit("pod rows file holds ids that were not sent")
    cd_deleted = sorted(ids - remaining)          # V-b / V-c on the new labels (either checker; unviewed, in-pod)
    labels = {c: {r["id"]: r for r in jl(pod_out / f"labels-{c}-a25.jsonl")} for c in CHECKERS}
    v3 = {c: {v["id"]: v for v in jl(pod_out / f"contradict-v3-{c}-a25.jsonl")} for c in CHECKERS}
    rows = [r for r in jl(set_path) if r["id"] in remaining]
    dec = hc.decide_v3(rows, spec, {}, v3, set(OFFER_KINDS), labels, hf.load_composer(), override=[], partial_ok=[])
    both = sorted(dec["a13"])                     # A23: safety kinds delete only when BOTH checkers flag
    drop = set(cd_deleted) | set(both)
    base = jl(set_path)
    kept = [r for r in base if r["id"] not in drop]
    wjl(set_out, kept)
    kind = {r["id"]: r["provenance"]["kind_spec"] for r in base}
    out = {"amendment": "A25 (t221u)", "set_in_sha256": m["set_sha256"], "n_offer_sent": len(ids),
           "checker_delete": {"n": len(cd_deleted), "by_kind": dict(Counter(kind[i] for i in cd_deleted)), "ids": cd_deleted},
           "a23_both_flag": {"n": len(both), "by_kind": dict(Counter(kind[i] for i in both)), "ids": both},
           "definition_check": {"n": len(dec["definition_check"]), "ids_by_kind": dec["definition_check_ids_by_kind"]},
           "per_kind_v3": dec["per_kind"], "label_coverage": {c: len(ids & set(labels[c])) for c in CHECKERS},
           "v3_coverage": {c: len(ids & set(v3[c])) for c in CHECKERS},
           "label_files": {c: sha(pod_out / f"labels-{c}-a25.jsonl") for c in CHECKERS},
           "verdict_files": {c: sha(pod_out / f"contradict-v3-{c}-a25.jsonl") for c in CHECKERS},
           "n_set_out": len(kept), "set_out_sha256": sha(set_out),
           "offer_left_by_kind": dict(Counter(kind[i] for i in ids - drop))}
    Path(log_path).write_text(json.dumps(out, indent=1) + "\n")
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    i = sp.add_parser("inputs")
    for x in ("--set", "--items", "--out-dir", "--expect-spec-sha"):
        i.add_argument(x, required=True)
    d = sp.add_parser("decide")
    for x in ("--set", "--inputs-manifest", "--pod-out", "--expect-spec-sha", "--log", "--set-out"):
        d.add_argument(x, required=True)
    a = ap.parse_args(argv)
    if a.cmd == "inputs":
        r = inputs(a.set, a.items, a.out_dir, a.expect_spec_sha)
        print(json.dumps({k: r[k] for k in ("n_rows", "by_kind", "rows_sha256", "items_sha256")}))
    else:
        r = decide(a.set, a.inputs_manifest, a.pod_out, a.expect_spec_sha, a.log, a.set_out)
        print(json.dumps({k: r[k] for k in ("n_offer_sent", "label_coverage", "v3_coverage", "n_set_out", "offer_left_by_kind")}
                         | {"checker_delete": r["checker_delete"]["n"], "a23_both": r["a23_both_flag"]["n"],
                            "definition_check": r["definition_check"]["n"]}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
