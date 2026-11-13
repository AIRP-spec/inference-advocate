#!/usr/bin/env python3
"""Head-extension generated-row filters (sizing addendum signed t217u, section 5, as amended).

Order: V-a validity -> V-b CSE + V-c eck (checker outputs; delete unviewed from every text-bearing file; id, trigger and
row sha logged) -> V-d stance validity (needs BOTH checkers) -> V-e brand -> V-f numbers (ALL generated rows,
amendment 11) -> V-g leak. Checker outputs only remove rows; gold always comes from the slot spec (amendment 12).
Never prints row text; reports carry ids, counts, reasons and shas only.

  python3 headext_filter.py checker-delete --labels labels-seed-oss-36b.jsonl --labeler seed-oss-36b --family bytedance-seed \
      --items items.jsonl --text-file gen.jsonl --text-file items.jsonl --log cse-eck-deletions-G1.json
  python3 headext_filter.py interim --gen gen.jsonl --expect-spec-sha <sha> --out filter-interim-G1.json
"""
from __future__ import annotations

import argparse, hashlib, json, os, re, sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import headext_slots as hs  # noqa: E402

EVAL_SUITE_V3 = Path(os.environ.get("AIRP_V3_PATH", "/workspace/evaluator-suite/v3"))
DIGIT_RE = re.compile(r"\d(?:[\s\-.]?\d)*")
DIGIT_WORDS = {"zero": "0", "oh": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6",
               "seven": "7", "eight": "8", "nine": "9"}
WORD_RE = re.compile(r"[A-Za-z]+")
HARM_STANCES = {"endorses", "encourages"}


def sha_line(l: str) -> str:
    return hashlib.sha256(l.rstrip("\n").encode("utf-8")).hexdigest()


def load_jsonl(p) -> list[dict]:
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


# ---------------- V-a ----------------
def va_reasons(row: dict) -> list[str]:
    p = row["provenance"]; r = []
    if p.get("pair_parse_ok") is False:
        r.append("pair_parse_failed")
    if not row["content"]:
        r.append("empty")
    if p.get("finish_reason") != "stop":
        r.append(f"finish_reason:{p.get('finish_reason')}")
    if row["content"] and not p.get("length_in_band"):
        r.append("length_out_of_band")
    return r


# ---------------- V-f (amendment 11: every generated row) ----------------
def number_strings(text: str) -> list[str]:
    """Digit runs (spaces, hyphens, dots allowed between digits) and runs of >= 3 spelled single digits."""
    out = [re.sub(r"\D", "", m.group(0)) for m in DIGIT_RE.finditer(text)]
    run = []
    toks = [(m.group(0).lower(), m.start(), m.end()) for m in WORD_RE.finditer(text)]
    prev_end = None
    for w, s, e in toks:
        gap = text[prev_end:s] if prev_end is not None else ""
        if w in DIGIT_WORDS and (not run or re.fullmatch(r"[\s\-.,]*", gap)):
            run.append(DIGIT_WORDS[w])
        else:
            if len(run) >= 3:
                out.append("".join(run))
            run = [DIGIT_WORDS[w]] if w in DIGIT_WORDS else []
        prev_end = e
    if len(run) >= 3:
        out.append("".join(run))
    return out


def vf_reasons(row: dict, allowed: set) -> list[str]:
    bad = [n for n in number_strings(row["content"]) if n not in allowed]
    return [f"number_not_on_list:{len(bad)}"] if bad else []


# ---------------- V-e ----------------
def ve_reasons(row: dict, spec: dict) -> list[str]:
    if not row["provenance"]["kind_spec"].startswith("ad-"):
        return []
    r = []
    b = row["provenance"].get("assign", {}).get("brand")
    if b and not re.search(r"\b" + re.escape(b) + r"\b", row["content"], re.I):
        r.append("brand_missing")
    if any(re.search(r"(?<![A-Za-z])" + re.escape(d) + r"(?![A-Za-z])", row["content"]) for d in spec["real_brand_denylist"]):
        r.append("denylisted_brand")
    return r


# ---------------- V-b / V-c: checker flags (delete-only) ----------------
def load_composer():
    sys.path.insert(0, str(EVAL_SUITE_V3))
    from airp_v3.compose import COMPOSITION_2A_SHA256, compose, load_composition  # noqa: E402
    comp = load_composition(None, COMPOSITION_2A_SHA256)
    return lambda prim: compose(prim, comp)


def flags_from_label(prim, labeler: str, composer=None) -> list[str]:
    if not isinstance(prim, dict) or not isinstance(prim.get("qualifiers"), list) or not isinstance(prim.get("objects"), list):
        return [f"invalid:{labeler}"]
    t = []
    if "sexual_activity" in prim["objects"] and "subject_is_minor" in prim["qualifiers"]:
        t.append(f"cse:{labeler}:label")
    if composer is not None and "child_sexual_exploitation" in composer(prim):
        t.append(f"cse:{labeler}:compose")
    if "exceeds_common_knowledge" in prim["qualifiers"]:
        t.append(f"eck:{labeler}")
    return t


def checker_flags(item_ids: list[str], labels_path, labeler: str, labeler_family: str, composer=None) -> dict[str, list[str]]:
    hs.check_labeler_family(labeler_family)
    labs = {}
    if Path(labels_path).is_file():
        for r in load_jsonl(labels_path):
            labs[r["id"]] = r.get("primitives")
    out = {}
    for i in item_ids:
        t = [f"missing:{labeler}"] if i not in labs else flags_from_label(labs[i], labeler, composer)
        if t:
            out[i] = t
    return out


def rewrite_without(path, drop: set) -> dict:
    keep, gone = [], {}
    for l in open(path, encoding="utf-8"):
        if not l.strip():
            continue
        rid = json.loads(l)["id"]
        if rid in drop:
            gone[rid] = sha_line(l)
        else:
            keep.append(l if l.endswith("\n") else l + "\n")
    tmp = str(path) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.writelines(keep)
    os.replace(tmp, path)
    return gone


def delete_unviewed(flags: dict[str, list[str]], text_files: list) -> list[dict]:
    shas = {}
    for p in text_files:
        for k, v in rewrite_without(p, set(flags)).items():
            shas.setdefault(k, v)
    return [{"id": i, "trigger": sorted(flags[i]), "row_sha256": shas.get(i)} for i in sorted(flags)]


def checker_delete(labels_path, labeler, family, items_path, text_files, log_path, composer=None) -> dict:
    ids = [r["id"] for r in load_jsonl(items_path)]
    flags = checker_flags(ids, labels_path, labeler, family, composer)
    log = delete_unviewed(flags, text_files)
    by = Counter(t.split(":")[0] for e in log for t in e["trigger"])
    rep = {"labeler": labeler, "n_items_checked": len(ids), "n_deleted": len(log), "by_trigger_type": dict(by),
           "labels_sha256": hs.sha256_file(labels_path) if Path(labels_path).is_file() else None, "deleted": log}
    Path(log_path).write_text(json.dumps(rep, indent=1) + "\n")
    return rep


# ---------------- V-d (both checkers; invalid = no vote) ----------------
def vd_reason(gold_stance: str, labs: list) -> list[str]:
    votes = [p for p in labs if isinstance(p, dict) and isinstance(p.get("qualifiers"), list)]
    if len(votes) < 2:
        return []
    if gold_stance in HARM_STANCES and all(p.get("stance") == "describes" and "is_mention_not_use" in p["qualifiers"] for p in votes):
        return ["stance_refusal"]
    if gold_stance == "describes" and all(p.get("stance") in ("endorses", "encourages", "conveys_method") for p in votes):
        return ["stance_escalated"]
    return []


# ---------------- gold (slot spec only) ----------------
def kind_by_id(spec):
    return {k["id"]: k for k in spec["kinds"]}


def gold_for(row: dict, spec: dict) -> dict:
    k = kind_by_id(spec)[row["provenance"]["kind_spec"]]
    g = next(a for a in k["arms"] if a["arm"] == row["arm"])["gold"] if k.get("pair") else k["gold"]
    quals = list(g["qualifiers"]) + [q for q in spec["register_qualifiers"].get(row["provenance"]["register"], []) if q not in g["qualifiers"]]
    return {"stance": g["stance"], "objects": list(g["objects"]), "qualifiers": quals, "ext": {h: int(h in g["ext"]) for h in spec["heads"]}}


# ---------------- selection + split + reserve ----------------
def split_key(salt, group, unit):
    return hashlib.sha256(f"{salt}|{group}|{unit}".encode()).hexdigest()


def select(valid_rows: list[dict], spec: dict) -> dict:
    """Round-robin across cells (cell order), lowest generation index within a cell, up to train+val target per kind.
    Pair kinds count units with BOTH arms valid. Split: sha256(salt|group|unit) ascending, first `val` units -> val."""
    by_kind = defaultdict(list)
    for r in valid_rows:
        by_kind[r["provenance"]["kind_spec"]].append(r)
    train, val, reserve, short = [], [], [], {}
    for k in spec["kinds"]:
        rows = by_kind.get(k["id"], [])
        if k.get("pair"):
            units = defaultdict(list)
            for r in rows:
                units[r["pair_unit"]].append(r)
            cand = {u: sorted(v, key=lambda x: x["arm"]) for u, v in units.items() if len(v) == 2}
            n_tr, n_va = k["train_units"], k["val_units"]
        else:
            cand = {r["id"]: [r] for r in rows}
            n_tr, n_va = k["train"], k["val"]
        cells = hs.cells_for(spec, k)
        per_cell = {c: sorted([u for u, v in cand.items() if (v[0]["provenance"]["register"], v[0]["provenance"]["length"]) == c],
                              key=lambda u: cand[u][0]["provenance"]["sample"]) for c in cells}
        chosen, depth = [], 0
        while len(chosen) < n_tr + n_va and any(depth < len(v) for v in per_cell.values()):
            for c in cells:
                if depth < len(per_cell[c]) and len(chosen) < n_tr + n_va:
                    chosen.append(per_cell[c][depth])
            depth += 1
        group = k["id"]
        chosen.sort(key=lambda u: split_key(spec["split_salt"], group, u))
        n_val_take = min(n_va, len(chosen)) if not k.get("held_out") else len(chosen)
        for idx, u in enumerate(chosen):
            (val if idx < n_val_take else train).extend(cand[u])
        cs = set(chosen)
        reserve.extend(r for u, v in cand.items() if u not in cs for r in v)
        reserve.extend(r for r in rows if (r.get("pair_unit") or r["id"]) not in cand)  # unpaired valid arms
        got_tr, got_va = len(chosen) - n_val_take, n_val_take
        if got_tr < n_tr or got_va < n_va:
            short[k["id"]] = {"train_target": n_tr, "train_got": got_tr, "val_target": n_va, "val_got": got_va}
    return {"train": train, "val": val, "reserve": reserve, "shortfall": short}


def seal(rows: list[dict], path) -> str:
    Path(path).write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in sorted(rows, key=lambda r: r["id"])), encoding="utf-8")
    return hs.sha256_file(path)


# ---------------- interim report (G1: V-a, V-e, V-f only; counts and ids) ----------------
def interim(gen_path, spec: dict, out_path) -> dict:
    rows = load_jsonl(gen_path)
    allowed = set(spec["allowed_digit_strings"])
    drops = {}
    for r in rows:
        rs = va_reasons(r) + ve_reasons(r, spec) + (vf_reasons(r, allowed) if r["content"] else [])
        if rs:
            drops[r["id"]] = rs
    per_kind = defaultdict(lambda: {"generated": 0, "pass_interim": 0})
    for r in rows:
        k = r["provenance"]["kind_spec"]
        per_kind[k]["generated"] += 1
        per_kind[k]["pass_interim"] += r["id"] not in drops
    rep = {"stage": "interim (V-a, V-e, V-f); V-d, V-g and the G2 checker pending", "n_rows": len(rows),
           "n_dropped": len(drops), "by_reason": dict(Counter(x.split(":")[0] for v in drops.values() for x in v)),
           "per_kind": dict(per_kind), "dropped": {i: drops[i] for i in sorted(drops)}, "gen_sha256": hs.sha256_file(gen_path)}
    Path(out_path).write_text(json.dumps(rep, indent=1) + "\n")
    return rep


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    c = sp.add_parser("checker-delete")
    for a in ("--labels", "--labeler", "--family", "--items", "--log"):
        c.add_argument(a, required=True)
    c.add_argument("--text-file", action="append", required=True)
    c.add_argument("--no-compose", action="store_true")
    i = sp.add_parser("interim")
    for a in ("--gen", "--expect-spec-sha", "--out"):
        i.add_argument(a, required=True)
    a = ap.parse_args(argv)
    if a.cmd == "checker-delete":
        rep = checker_delete(a.labels, a.labeler, a.family, a.items, a.text_file, a.log, None if a.no_compose else load_composer())
        print(json.dumps({k: v for k, v in rep.items() if k != "deleted"} | {"deleted_ids": [e["id"] for e in rep["deleted"]]}))
        return 0
    spec, _ = hs.load_pinned(hs.SPEC, a.expect_spec_sha)
    rep = interim(a.gen, spec, a.out)
    print(json.dumps({k: rep[k] for k in ("n_rows", "n_dropped", "by_reason")}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
