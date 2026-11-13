"""t232u/t234u rerun: box-side decision after the G5 pod. Ids, counts and shas only for safety kinds (no row text is printed).
  python3 headext_g5.py decide --set set-t227.jsonl --pod-out OUT --arm-a-file F --expect-spec-sha SHA --log g5-decision.json --set-out set-t234.jsonl
- New-kind rows: A13 (non-safety: either checker flag deletes) / A23 (safety: both flags delete, one -> definition check) / A18,
  via decide_v3 on the v4 verdicts; the A13 30 % stop is evaluated per new kind.
- F1 re-arm candidates (rr-claim-vs-deny, non-safety): a candidate survives when neither checker flags it (A13), it is non-empty and
  in its length band, and it passes the F2 lexical gate (names and denies friend/therapist/coach; no 'not a person'/'not human').
  The lowest surviving candidate replaces the unit's B arm text (id, pair_unit and side unchanged). A unit with no surviving
  candidate is dropped whole (both arms) and recorded."""
from __future__ import annotations

import argparse, hashlib, json, re, sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import headext_slots as hs  # noqa: E402
import headext_filter as hf  # noqa: E402
import headext_contradict as hc  # noqa: E402

CHECKERS = ("seed-oss-36b", "nemotron-3-super")
WRITER = "qwen3-30b-a3b-2507"
OFF = re.compile(r"\bnot (a )?(person|human)\b", re.I)
DENY = re.compile(r"(\bnot\b|n't\b|\bnever\b)[^.]{0,40}\b(friend|therapist|coach)\b", re.I)


def sha(p) -> str:
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def jl(p):
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


def f2_lexical_ok(text: str) -> bool:
    return bool(text) and not OFF.search(text) and bool(DENY.search(text))


def decide(set_path, pod_out, arm_a_file, spec_sha, log_path, set_out) -> dict:
    spec, _ = hs.load_pinned(hs.SPEC, spec_sha)
    pod_out = Path(pod_out)
    gen_p = pod_out / f"gen-g5-{WRITER}.jsonl"
    arm_a = jl(arm_a_file)
    jobs = hs.build_jobs(spec, "g5", arm_a)
    new_jobs = {j["id"]: j["kind"] for j in jobs if not j.get("rearm")}
    re_jobs = {f"{j['pair_unit']}-b-r{j['candidate']}": j for j in jobs if j.get("rearm")}
    g5 = jl(gen_p)
    for r in g5:
        if r["provenance"].get("phase") != "g5" or r["provenance"]["slot_spec_sha256"] != spec_sha:
            raise hs.Blocked("rows file holds rows that are not G5 rows of this spec")
        if not (r["id"] in re_jobs or (r.get("pair_unit") or r["id"]) in new_jobs):
            raise hs.Blocked(f"unknown G5 row {r['id']}")
    new_rows = [r for r in g5 if r["id"] not in re_jobs]
    re_rows = {r["id"]: r for r in g5 if r["id"] in re_jobs}
    labels = {c: {r["id"]: r for r in jl(pod_out / f"labels-{c}-gen.jsonl")} for c in CHECKERS}
    v4 = {c: {v["id"]: v for v in jl(pod_out / f"contradict-v4-{c}-gen.jsonl")} for c in CHECKERS}
    g5kinds = {k["id"] for k in spec["kinds"] if k.get("g5_quota")}
    dec = hc.decide_v3(new_rows, spec, {}, v4, g5kinds | {"rr-claim-vs-deny"}, labels, hf.load_composer(), override=[], partial_ok=[])
    deleted = set(dec["a13"]) | set(dec.get("a18") or {})
    # pair integrity: a pair unit loses both arms when either arm is deleted or empty
    units = Counter(r.get("pair_unit") for r in new_rows if r.get("pair_unit"))
    bad_units = {r["pair_unit"] for r in new_rows if r.get("pair_unit") and (r["id"] in deleted or not r["content"])}
    bad_units |= {u for u, n in units.items() if n != 2}
    kept_new = [r for r in new_rows if r["content"] and r["id"] not in deleted and r.get("pair_unit") not in bad_units]
    # re-arm
    re_dec = {}
    for a in arm_a:
        u = a["pair_unit"]; pick = None; why = {}
        for c in range(hs.REARM_CANDIDATES):
            i = f"{u}-b-r{c}"; r = re_rows.get(i)
            flags = [c_ for c_ in CHECKERS if (v4[c_].get(i) or {}).get("contradicts") is not False]
            reasons = ([] if r else ["missing"]) + ([] if not r or r["content"] else ["empty"]) + \
                      ([] if not r or r["provenance"].get("length_in_band") else ["length"]) + [f"flag:{x}" for x in flags] + \
                      ([] if not r or f2_lexical_ok(r["content"]) else ["f2_lexical"])
            why[i] = reasons
            if not reasons and pick is None:
                pick = i
        re_dec[u] = {"picked": pick, "candidates": why}
    base = jl(set_path)
    ids = {r["id"] for r in base}
    if ids & {r["id"] for r in kept_new}:
        raise hs.Blocked("G5 id collision with the working set")
    dropped_units = sorted(u for u, d in re_dec.items() if d["picked"] is None)
    out_rows = []
    for r in base:
        u = r.get("pair_unit")
        if u in re_dec:
            if u in dropped_units:
                continue
            if r.get("arm") == "B":
                c = re_rows[re_dec[u]["picked"]]
                r = {**r, "content": c["content"], "provenance": {**c["provenance"], "rearm_pick": re_dec[u]["picked"]}}
        out_rows.append(r)
    out = {"ruling": "t232u items 1-2, t234u items 2-5", "set_in_sha256": sha(set_path), "spec_sha256": spec_sha, "gen_sha256": sha(gen_p),
           "n_new_jobs": len(new_jobs), "n_rearm_jobs": len(re_jobs), "new_rows_written": len(new_rows), "rearm_rows_written": len(re_rows),
           "new_deleted": {"n": len(deleted), "ids": sorted(deleted)}, "pair_units_dropped": sorted(bad_units),
           "definition_check": {"n": len(dec["definition_check"]), "ids_by_kind": dec["definition_check_ids_by_kind"]},
           "per_kind": dec["per_kind"], "stop_kinds_a13": dec["stop_kinds_a13"], "stop": dec["stop"],
           "label_coverage": {c: len(set(labels[c]) & {r["id"] for r in g5}) for c in CHECKERS},
           "v4_coverage": {c: len(set(v4[c]) & {r["id"] for r in g5}) for c in CHECKERS},
           "label_files": {c: sha(pod_out / f"labels-{c}-gen.jsonl") for c in CHECKERS},
           "verdict_files": {c: sha(pod_out / f"contradict-v4-{c}-gen.jsonl") for c in CHECKERS},
           "rearm": re_dec, "rearm_units_dropped": dropped_units,
           "new_kept_by_kind": dict(Counter(r["provenance"]["kind_spec"] for r in kept_new))}
    if not dec["stop"]:
        rows = out_rows + sorted(kept_new, key=lambda r: r["id"])
        Path(set_out).write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
        out.update({"n_set_out": len(rows), "set_out_sha256": sha(set_out)})
    Path(log_path).write_text(json.dumps(out, indent=1) + "\n")
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    d = sp.add_parser("decide")
    for x in ("--set", "--pod-out", "--arm-a-file", "--expect-spec-sha", "--log", "--set-out"):
        d.add_argument(x, required=True)
    a = ap.parse_args(argv)
    r = decide(a.set, a.pod_out, a.arm_a_file, a.expect_spec_sha, a.log, a.set_out)
    print(json.dumps({k: r.get(k) for k in ("n_new_jobs", "n_rearm_jobs", "label_coverage", "v4_coverage", "stop", "stop_kinds_a13",
                                            "new_kept_by_kind", "rearm_units_dropped", "n_set_out", "set_out_sha256")}
                     | {"new_deleted": r["new_deleted"]["n"], "pair_units_dropped": len(r["pair_units_dropped"]),
                        "definition_check": r["definition_check"]["n"]}))
    return 3 if r["stop"] else 0


if __name__ == "__main__":
    sys.exit(main())
