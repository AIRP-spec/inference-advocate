#!/usr/bin/env python3
"""Delete-only contradiction check (amendment t218u A13) and self_harm-primitive deletion (A15).

A13: each checker (Nemotron-3-Super, Seed-OSS-36B; test-side pair, never the generator family) reads one generated row,
its head's pinned labelling definition, the task the row was written for and its slot-spec label for that head
(PRESENT / ABSENT), and answers only {"contradicts": true|false}. The checker never sets or changes a label.
Decision rule (recorded in the addendum): a row is DELETED if EITHER checker answers true, or if either checker's verdict
is missing or unparseable (conservative, as the signed gap-fill for missing checker labels). Every deletion is logged with
id, kind, trigger and row sha. STOP rule: if any kind loses more than 30 % of its checked rows to A13 deletion, the run
stops and reports; A13 deletions are then NOT applied (rows are held, flagged), since the stop says the check needs review.
A15: a row of a NON-safety kind (kind head in spec["nonsafety_heads"]) is deleted if either checker's primitive label
(labeling guide e5b7b56c) carries the object `self_harm`. A missing label is already a V-b/V-c deletion (checker-delete).
Never prints or reads back row text: counts, ids and shas only.

  headext_contradict.py run --base-url http://127.0.0.1:18601 --checker nemotron-3-super --rows set.jsonl --out c.jsonl
  headext_contradict.py decide --rows set.jsonl --verdicts c-nemotron.jsonl --verdicts c-seed.jsonl \
        --labels labels-a.jsonl --labels labels-b.jsonl --log deletions.json [--apply --text-file f ...]
"""
from __future__ import annotations

import argparse, hashlib, json, re, sys, time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import headext_slots as hs  # noqa: E402
import headext_filter as hf  # noqa: E402

DEFS_SOURCE = HERE.parent / "EXTENSION-NY-HEADS.md"
DEFS_SOURCE_SHA = "5fdb03febc3aea38db6da6e3b0fdd8352745587a93c27e07e3abfa9d7e6ebfee"
# PRIMITIVES.md 18ae5d04, line 34 (verbatim): the self_harm object, for the offer-shape and hate-elim rows
SELF_HARM_DEF = "Self-directed harm. Suicide, self-injury. Does the text involve self-directed harm or suicide?"
STOP_FRACTION = 0.30
CHECKERS = {"nemotron-3-super": "nvidia-nemotron", "seed-oss-36b": "bytedance-seed"}
SYSTEM = ("You check one labelled example for a text classifier. You never change or set labels; you only report whether the "
          "example text contradicts the label it was given. Answer with a JSON object only.")
USER = ("Property: {head}\nDefinition: {definition}\nThe example was written for this task: {task}\nAssigned label for the property: "
        "{label}\n\nExample text:\n<<<\n{content}\n>>>\n\nDoes the example text clearly contradict the assigned label under the "
        "definition? Judge only the property above; ignore style, register, length and every other property. If the label is PRESENT, "
        "answer true when the text does not show the property or does the opposite. If the label is ABSENT, answer true when the text "
        "clearly shows the property. Reply with exactly {{\"contradicts\": true}} or {{\"contradicts\": false}}.")
LABEL_TEXT = {1: "PRESENT (the text has this property)", 0: "ABSENT (the text does not have this property)"}


def head_definitions(path=DEFS_SOURCE, expect=DEFS_SOURCE_SHA) -> dict:
    raw = Path(path).read_bytes()
    if hashlib.sha256(raw).hexdigest() != expect:
        raise hs.Blocked("EXTENSION-NY-HEADS.md sha differs from the pin")
    out = {}
    for line in raw.decode("utf-8").splitlines():
        m = re.match(r"^\| `([a-z_]+)` \| (object|qualifier)[^|]*\|[^|]*\| (.+) \|\s*$", line)
        if m:
            out[m.group(1)] = re.sub(r"\*\*", "", m.group(3)).strip()
    out["self_harm"] = SELF_HARM_DEF
    return out


def row_head_label(row: dict, spec: dict) -> tuple[str, int, str]:
    k = hf.kind_by_id(spec)[row["provenance"]["kind_spec"]]
    g = hf.gold_for(row, spec)
    head = k["head"]
    lab = int(head in g["objects"]) if head == "self_harm" else g["ext"][head]
    task = next(a for a in k["arms"] if a["arm"] == row["arm"])["shape"] if k.get("pair") else k["shape"]
    task = re.sub(r"^[AB] ", "The reply ", task)
    return head, lab, task


def messages(row: dict, spec: dict, defs: dict) -> list[dict]:
    head, lab, task = row_head_label(row, spec)
    return [{"role": "system", "content": SYSTEM},
            {"role": "user", "content": USER.format(head=head, definition=defs[head], task=task, label=LABEL_TEXT[lab], content=row["content"])}]


def parse_verdict(text: str):
    t = re.sub(r"<(seed:)?think>.*?</(seed:)?think>", "", text or "", flags=re.S).strip()
    ms = re.findall(r"\{[^{}]*\}", t)
    if not ms:
        return None
    try:
        o = json.loads(ms[-1])
    except json.JSONDecodeError:
        return None
    v = o.get("contradicts") if isinstance(o, dict) else None
    return v if isinstance(v, bool) else None


def run(base_url: str, checker: str, rows: list[dict], spec: dict, out: str, ctk: dict, concurrency=64, wall=900.0, post=None) -> dict:
    hs.check_base_url(base_url)
    hs.check_labeler_family(CHECKERS[checker])
    defs = head_definitions()
    post = post or hs._post
    done = set()
    if Path(out).is_file():
        done = {json.loads(l)["id"] for l in open(out) if l.strip()}
    todo = [r for r in rows if r["content"] and r["id"] not in done]
    st = {"checker": checker, "n_rows": len(rows), "n_todo": len(todo), "n_written": 0, "n_invalid": 0, "n_error": 0, "stop_reason": "complete"}
    t0 = time.time()

    def one(r):
        body = {"model": checker, "messages": messages(r, spec, defs), "max_tokens": 64, "temperature": 0}
        if ctk:
            body["chat_template_kwargs"] = ctk
        last = None
        for attempt in range(3):
            try:
                raw = post(base_url, body)
                ch = (raw.get("choices") or [{}])[0]
                txt = (ch.get("message") or {}).get("content") or ""
                return {"id": r["id"], "checker": checker, "contradicts": parse_verdict(txt), "error": None,
                        "raw_sha256": hashlib.sha256(txt.encode()).hexdigest(), "finish_reason": ch.get("finish_reason")}
            except hs.Blocked:
                raise
            except Exception as e:  # noqa: BLE001
                last = f"{type(e).__name__}: {str(e)[:160]}"; time.sleep(1 + attempt)
        return {"id": r["id"], "checker": checker, "contradicts": None, "error": last}

    with open(out, "a") as fh, ThreadPoolExecutor(concurrency) as ex:
        futs = [ex.submit(one, r) for r in todo]
        for f in as_completed(futs):
            v = f.result()
            fh.write(json.dumps(v) + "\n"); fh.flush()
            st["n_written"] += 1; st["n_invalid"] += v["contradicts"] is None and not v["error"]; st["n_error"] += bool(v["error"])
            if time.time() - t0 > wall:
                st["stop_reason"] = "wall_clock_limit"
                for g in futs:
                    g.cancel()
                break
    st["elapsed_seconds"] = round(time.time() - t0, 1)
    st["n_true"] = sum(1 for l in open(out) if l.strip() and json.loads(l)["contradicts"] is True)
    return st


def load_by_id(paths) -> dict[str, dict]:
    out = {}
    for p in paths:
        if Path(p).is_file():
            for l in open(p):
                if l.strip():
                    r = json.loads(l); out[r["id"]] = r
    return out


def decide(rows: list[dict], spec: dict, verdicts: dict[str, dict[str, dict]], labels: dict[str, dict[str, dict]]) -> dict:
    """verdicts / labels: checker -> id -> row. Returns per-rule flags, per-kind counts and the stop decision."""
    kh = {k["id"]: k["head"] for k in spec["kinds"]}
    nonsafety = set(spec["nonsafety_heads"])
    a13, a15 = {}, {}
    for r in rows:
        if not r["content"]:
            continue
        t = []
        for c in sorted(verdicts):
            v = verdicts[c].get(r["id"])
            if v is None:
                t.append(f"missing:{c}")
            elif v.get("contradicts") is True:
                t.append(f"contradicts:{c}")
            elif v.get("contradicts") is None:
                t.append(f"invalid:{c}")
        if t:
            a13[r["id"]] = t
        if kh[r["provenance"]["kind_spec"]] in nonsafety:
            s = [f"self_harm:{c}" for c in sorted(labels) if "self_harm" in (((labels[c].get(r["id"]) or {}).get("primitives") or {}).get("objects") or [])]
            if s:
                a15[r["id"]] = s
    per = defaultdict(lambda: {"checked": 0, "a13_deleted": 0, "a15_deleted": 0, "union_deleted": 0})
    for r in rows:
        if not r["content"]:
            continue
        k = r["provenance"]["kind_spec"]; p = per[k]
        p["checked"] += 1; p["a13_deleted"] += r["id"] in a13; p["a15_deleted"] += r["id"] in a15
        p["union_deleted"] += (r["id"] in a13) or (r["id"] in a15)
    for k, p in per.items():
        p["a13_fraction"] = round(p["a13_deleted"] / p["checked"], 4) if p["checked"] else 0.0
        p["union_fraction"] = round(p["union_deleted"] / p["checked"], 4) if p["checked"] else 0.0
    stop = sorted(k for k, p in per.items() if p["a13_deleted"] > STOP_FRACTION * p["checked"])
    return {"rule_a13": "deleted if EITHER checker answers contradicts=true, or a checker verdict is missing/invalid; checkers never set labels",
            "rule_a15": "non-safety kind deleted if EITHER checker label carries object self_harm",
            "stop_fraction": STOP_FRACTION, "stop_kinds_a13": stop, "stop": bool(stop),
            "union_over_30pct_kinds": sorted(k for k, p in per.items() if p["union_deleted"] > STOP_FRACTION * p["checked"]),
            "a13": a13, "a15": a15, "per_kind": dict(sorted(per.items())),
            "by_trigger": dict(Counter(x.split(":")[0] + ":" + x.split(":")[1] for v in list(a13.values()) + list(a15.values()) for x in v))}


def apply(dec: dict, rows: list[dict], text_files: list) -> dict:
    """Deletes A15 rows always; A13 rows only when the stop rule did not fire."""
    kind = {r["id"]: r["provenance"]["kind_spec"] for r in rows}
    drop = {i: ["A15"] + t for i, t in dec["a15"].items()}
    if not dec["stop"]:
        for i, t in dec["a13"].items():
            drop.setdefault(i, []).extend(["A13"] + t)
    log = hf.delete_unviewed(drop, text_files)
    for e in log:
        e["kind"] = kind.get(e["id"])
    return {"applied_a13": not dec["stop"], "n_deleted": len(log), "deleted": log}


def merge(g1_rows: list[dict], g2_rows: list[dict], spec: dict) -> dict:
    """Working set for G2 (A14): G1 rows of kinds marked g1_rows=discard are dropped from the working set (the G1 archive is
    untouched); all other G1 rows are kept; G2 rows are added. Ids never collide (G2 indices start at g2_start)."""
    disc = {k["id"] for k in spec["kinds"] if k.get("g1_rows") == "discard"}
    kept = [r for r in g1_rows if r["provenance"]["kind_spec"] not in disc]
    gone = [r for r in g1_rows if r["provenance"]["kind_spec"] in disc]
    ids = [r["id"] for r in kept] + [r["id"] for r in g2_rows]
    if len(ids) != len(set(ids)):
        raise hs.Blocked("G1/G2 id collision")
    bad = [r["id"] for r in g2_rows if r["provenance"]["kind_spec"] not in {k["id"] for k in spec["kinds"] if k.get("g2_quota")}]
    if bad:
        raise hs.Blocked(f"G2 rows of a kind without a G2 quota: {len(bad)}")
    by = defaultdict(list)
    for r in gone:
        by[r["provenance"]["kind_spec"]].append(r["id"])
    return {"rows": kept + g2_rows, "discarded_g1": {k: sorted(v) for k, v in sorted(by.items())},
            "counts": {"g1_in": len(g1_rows), "g1_kept": len(kept), "g1_discarded": len(gone), "g2_in": len(g2_rows), "set": len(kept) + len(g2_rows)}}


def pair_groups(rows: list[dict], spec: dict, drop: set) -> dict:
    """Pair kinds: units with BOTH arms present, non-empty and not in `drop`."""
    out = {}
    for k in spec["kinds"]:
        if not k.get("pair"):
            continue
        u = defaultdict(set)
        for r in rows:
            if r["provenance"]["kind_spec"] == k["id"] and r["content"] and r["id"] not in drop:
                u[r["pair_unit"]].add(r["arm"])
        out[k["id"]] = sum(1 for v in u.values() if len(v) == 2)
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    r = sp.add_parser("run")
    for a in ("--base-url", "--checker", "--rows", "--out", "--expect-spec-sha"):
        r.add_argument(a, required=True)
    r.add_argument("--ctk", default="{}"); r.add_argument("--concurrency", type=int, default=64); r.add_argument("--max-wall-seconds", type=float, default=900)
    d = sp.add_parser("decide")
    d.add_argument("--rows", required=True); d.add_argument("--expect-spec-sha", required=True); d.add_argument("--log", required=True)
    d.add_argument("--verdicts", action="append", required=True); d.add_argument("--labels", action="append", required=True)
    d.add_argument("--apply", action="store_true"); d.add_argument("--text-file", action="append", default=[])
    m = sp.add_parser("merge")
    for x in ("--g1", "--g2", "--out", "--log", "--expect-spec-sha"):
        m.add_argument(x, required=True)
    a = ap.parse_args(argv)
    spec, _ = hs.load_pinned(hs.SPEC, a.expect_spec_sha)
    if a.cmd == "merge":
        res = merge(hf.load_jsonl(a.g1), hf.load_jsonl(a.g2) if Path(a.g2).is_file() else [], spec)
        hf.seal(res["rows"], a.out)
        rep = {"counts": res["counts"], "discarded_g1_counts": {k: len(v) for k, v in res["discarded_g1"].items()},
               "discarded_g1_ids": res["discarded_g1"], "g1_sha256": hs.sha256_file(a.g1),
               "g2_sha256": hs.sha256_file(a.g2) if Path(a.g2).is_file() else None, "set_sha256": hs.sha256_file(a.out)}
        Path(a.log).write_text(json.dumps(rep, indent=1) + "\n")
        print(json.dumps({"counts": res["counts"], "discarded_g1_counts": rep["discarded_g1_counts"], "set_sha256": rep["set_sha256"]}))
        return 0
    rows = hf.load_jsonl(a.rows)
    if a.cmd == "run":
        if a.checker not in CHECKERS:
            raise hs.Blocked(f"checker {a.checker} is not a declared checker")
        st = run(a.base_url, a.checker, rows, spec, a.out, json.loads(a.ctk), a.concurrency, a.max_wall_seconds)
        print(json.dumps(st)); return 0 if st["stop_reason"] == "complete" else 3
    ver = {}
    for p in a.verdicts:
        vs = hf.load_jsonl(p) if Path(p).is_file() else []; c = vs[0]["checker"] if vs else Path(p).stem
        ver[c] = {v["id"]: v for v in vs}
    for c in CHECKERS:
        ver.setdefault(c, {})  # a checker that produced nothing counts as missing on every row
    labs = {}
    for p in a.labels:
        ls = hf.load_jsonl(p) if Path(p).is_file() else []; c = ls[0]["labeler"] if ls else Path(p).stem
        labs.setdefault(c, {}).update({x["id"]: x for x in ls})
    dec = decide(rows, spec, ver, labs)
    res = {"decision": dec, "pair_groups_before": pair_groups(rows, spec, set()),
           "pair_groups_after": pair_groups(rows, spec, set(dec["a15"]) | (set() if dec["stop"] else set(dec["a13"])))}
    if a.apply:
        res["applied"] = apply(dec, rows, a.text_file)
    res["rows_sha256"] = hs.sha256_file(a.rows) if Path(a.rows).is_file() else None
    Path(a.log).write_text(json.dumps(res, indent=1) + "\n")
    print(json.dumps({"stop": dec["stop"], "stop_kinds_a13": dec["stop_kinds_a13"], "n_a13": len(dec["a13"]), "n_a15": len(dec["a15"]),
                      "union_over_30pct_kinds": dec["union_over_30pct_kinds"],
                      "pair_groups_after": res["pair_groups_after"], "n_deleted": res.get("applied", {}).get("n_deleted")}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
