"""t227u (A31): box-side decision after the G4 offer top-up pod, and the derived offer-refusal negatives (item 2).
Never prints or reads row text (ids, counts and shas only).
  python3 headext_g4.py decide --set set-t221.jsonl --pod-out OUT --expect-spec-sha SHA --log g4-decision.json --set-out set-t227.jsonl
Rules: rows removed by the in-pod checker-delete stay removed; A23 (safety kinds): a G4 row is deleted only when BOTH checkers flag
it on the v3 (A25) contradiction check, one flag -> definition check (row stays); the A13 30 % stop is evaluated per kind and, if
it fires, the decision is written but no set is produced. The 65 rows of the derived negative kinds (spec `derived_ids`) are
retagged to their derived kind (kind + provenance.kind_spec; provenance.retag records the source kind). Earlier rows are kept."""
from __future__ import annotations

import argparse, hashlib, json, sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import headext_slots as hs  # noqa: E402
import headext_filter as hf  # noqa: E402
import headext_contradict as hc  # noqa: E402

CHECKERS = ("seed-oss-36b", "nemotron-3-super")
WRITER = "mistral-small-3.2"


def sha(p) -> str:
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def jl(p):
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


def retag(rows: list[dict], spec: dict) -> dict:
    """Moves each derived_ids row to its derived kind in place; every listed id must be present once, in a source kind."""
    want = {}
    for k in spec["kinds"]:
        for i in k.get("derived_ids", []):
            if i in want:
                raise hs.Blocked(f"{i} listed under two derived kinds")
            want[i] = k
    seen = Counter()
    for r in rows:
        k = want.get(r["id"])
        if not k:
            continue
        src = r["provenance"]["kind_spec"]
        if src not in k["derived_from_kinds"] or r.get("kind") != src or not r["content"]:
            raise hs.Blocked(f"{r['id']}: not a non-empty row of {k['derived_from_kinds']}")
        r["kind"] = k["id"]; r["provenance"]["kind_spec"] = k["id"]
        r["provenance"]["retag"] = {"from_kind": src, "by": k["derived"]}
        seen[r["id"]] += 1
    missing = sorted(set(want) - set(seen))
    if missing or any(v != 1 for v in seen.values()):
        raise hs.Blocked(f"derived ids missing from the set: {len(missing)}")
    return {"n": len(seen), "by_kind": dict(Counter(want[i]["id"] for i in seen))}


def decide(set_path, pod_out, spec_sha, log_path, set_out) -> dict:
    spec, _ = hs.load_pinned(hs.SPEC, spec_sha)
    pod_out = Path(pod_out)
    gen_p = pod_out / f"gen-g4-{WRITER}.jsonl"
    sent = {j["id"]: j["kind"] for j in hs.build_jobs(spec, "g4")}
    g4 = jl(gen_p)
    if any(r["id"] not in sent or r["provenance"].get("phase") != "g4" or r["provenance"]["slot_spec_sha256"] != spec_sha for r in g4):
        raise hs.Blocked("G4 rows file holds rows that are not G4 jobs of this spec")
    remaining = {r["id"] for r in g4}
    cd_deleted = sorted(set(sent) - remaining)   # never written, or removed by the in-pod checker-delete (unviewed)
    labels = {c: {r["id"]: r for r in jl(pod_out / f"labels-{c}-g4.jsonl")} for c in CHECKERS}
    v3 = {c: {v["id"]: v for v in jl(pod_out / f"contradict-v3-{c}-g4.jsonl")} for c in CHECKERS}
    g4kinds = {k["id"] for k in spec["kinds"] if k.get("g4_quota")}
    dec = hc.decide_v3(g4, spec, {}, v3, g4kinds, labels, hf.load_composer(), override=[], partial_ok=[])
    both = sorted(dec["a13"])
    base = jl(set_path)
    if {r["id"] for r in base} & remaining:
        raise hs.Blocked("G4 id collision with the working set")
    rt = retag(base, spec)
    kept_g4 = [r for r in g4 if r["id"] not in set(both)]
    out = {"amendment": "A31 (t227u)", "set_in_sha256": sha(set_path), "spec_sha256": spec_sha, "gen_sha256": sha(gen_p),
           "n_g4_jobs": len(sent), "jobs_by_kind": dict(Counter(sent.values())),
           "checker_delete_or_unwritten": {"n": len(cd_deleted), "by_kind": dict(Counter(sent[i] for i in cd_deleted)), "ids": cd_deleted},
           "empty_rows": sorted(r["id"] for r in g4 if not r["content"]),
           "a23_both_flag": {"n": len(both), "by_kind": dict(Counter(sent[i] for i in both)), "ids": both},
           "definition_check": {"n": len(dec["definition_check"]), "ids_by_kind": dec["definition_check_ids_by_kind"]},
           "per_kind_v3": dec["per_kind"], "stop_kinds_a13": dec["stop_kinds_a13"], "stop": dec["stop"],
           "label_coverage": {c: len(remaining & set(labels[c])) for c in CHECKERS},
           "v3_coverage": {c: len(remaining & set(v3[c])) for c in CHECKERS},
           "label_files": {c: sha(pod_out / f"labels-{c}-g4.jsonl") for c in CHECKERS},
           "verdict_files": {c: sha(pod_out / f"contradict-v3-{c}-g4.jsonl") for c in CHECKERS},
           "retag": rt, "g4_left_by_kind": dict(Counter(r["provenance"]["kind_spec"] for r in kept_g4))}
    if not dec["stop"]:
        rows = base + sorted(kept_g4, key=lambda r: r["id"])
        Path(set_out).write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
        out.update({"n_set_out": len(rows), "set_out_sha256": sha(set_out)})
    Path(log_path).write_text(json.dumps(out, indent=1) + "\n")
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    d = sp.add_parser("decide")
    for x in ("--set", "--pod-out", "--expect-spec-sha", "--log", "--set-out"):
        d.add_argument(x, required=True)
    a = ap.parse_args(argv)
    r = decide(a.set, a.pod_out, a.expect_spec_sha, a.log, a.set_out)
    print(json.dumps({k: r.get(k) for k in ("n_g4_jobs", "label_coverage", "v3_coverage", "stop", "stop_kinds_a13", "retag",
                                            "g4_left_by_kind", "n_set_out", "set_out_sha256")}
                     | {"checker_delete_or_unwritten": r["checker_delete_or_unwritten"]["n"], "a23_both": r["a23_both_flag"]["n"],
                        "definition_check": r["definition_check"]["n"], "empty": len(r["empty_rows"])}))
    return 3 if r["stop"] else 0


if __name__ == "__main__":
    sys.exit(main())
