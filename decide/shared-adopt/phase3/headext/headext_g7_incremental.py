#!/usr/bin/env python3
"""t241u/t242u incremental v10g pack: keep existing v10f rows byte-identical (val stays
cffe5521…); append 24 train cr-direct-vs-fiction units and 24 train
cr-resource-in-fiction rows from G7 + G7x survivors. Fill to 24 complete pair
units in generation order (sample id); surplus units dropped and ids logged.
No selection by content. No new val rows. Box only.
Stdout = counts, ids, and shas; never prints row text.
"""
from __future__ import annotations

import argparse, hashlib, json, shutil, sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path("/workspace/wt-p3/decide/shared-adopt/phase3/headext")
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE / "pack"))
import headext_slots as hs  # noqa: E402
import build_data_v10 as B  # noqa: E402

SPEC_SHA = hs.sha256_file(hs.SPEC)
V10F_TRAIN_SHA = "fbeecc0f6326a2f5afed06aee85c10ed48ebe2334f354c2c26cc79b0aca0d4e8"
V10F_VAL_SHA = "cffe55215c18cfdd17c38f8ad2173869fe7ea06f2149b73b94b378add3a561a7"
G7_START, G7_END = 200, 235
G7X_START, G7X_END = 232, 235
N_ADD_PAIR_UNITS, N_ADD_SINGLE = 24, 24
PAIR_KIND = "cr-direct-vs-fiction"
SINGLE_KIND = "cr-resource-in-fiction"
# 2:4:4 firing-cell proportion (000:2, 003:4, 013+040:4), same cycle as build_g7_jobs
PAIR_CELLS = [
    ("clinical", "short"),
    ("colloquial", "short"), ("colloquial", "short"),
    ("colloquial", "medium"), ("colloquial", "medium"),
]
# even mix of short/medium × clinical/colloquial
SINGLE_CELLS = [
    ("clinical", "short"), ("clinical", "medium"),
    ("colloquial", "short"), ("colloquial", "medium"),
]


def sha_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_jsonl(p):
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


def dump_jsonl(rows, p):
    Path(p).write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
    return sha_file(p)


def kind_spec_of(r):
    return r.get("provenance", {}).get("kind_spec") or r.get("kind_spec") or r.get("contrastGroup") or r.get("kind")


def cell_of(r):
    p = r["provenance"]
    return (p["register"], p["length"])


def sample_of(r):
    return int(r["provenance"]["sample"])


def assert_g7_sample(r):
    s = sample_of(r)
    if not (G7_START <= s <= G7_END):
        raise SystemExit(f"sample {s} on {r['id']} is outside G7 range {G7_START}-{G7_END}")


def complete_pair_units(rows):
    units = defaultdict(list)
    for r in rows:
        units[r["pair_unit"]].append(r)
    return {u: sorted(v, key=lambda x: x["arm"]) for u, v in units.items() if len(v) == 2}


def rr_choose(cand, n, cells):
    """cand: unit -> rows (pairs: 2 rows, singles: 1 row). cells may repeat for proportion."""
    def unit_cell(u):
        return cell_of(cand[u][0])

    per_cell = {
        c: sorted([u for u in cand if unit_cell(u) == c], key=lambda u: sample_of(cand[u][0]))
        for c in dict.fromkeys(cells)
    }
    # walk the (possibly repeating) cell cycle, one pick per slot, depth increases after a full cycle
    cursor = {c: 0 for c in per_cell}
    chosen = []
    progressed = True
    while len(chosen) < n and progressed:
        progressed = False
        for c in cells:
            i = cursor[c]
            if i < len(per_cell[c]) and len(chosen) < n:
                chosen.append(per_cell[c][i])
                cursor[c] = i + 1
                progressed = True
    available = {f"{c[0]}/{c[1]}": [sample_of(cand[u][0]) for u in us] for c, us in per_cell.items()}
    return chosen, available


def cell_mix(cand, units):
    mix = Counter()
    for u in units:
        r, ln = cell_of(cand[u][0])
        mix[f"{r}/{ln}"] += 1
    return dict(mix)


def choose_in_generation_order(cand, n):
    """Take the first n units by sample id (generation order). No selection by content."""
    ordered = sorted(cand, key=lambda u: (sample_of(cand[u][0]), u))
    chosen = ordered[:n]
    surplus = ordered[n:]
    available = {
        f"{c[0]}/{c[1]}": [sample_of(cand[u][0]) for u in ordered if cell_of(cand[u][0]) == c]
        for c in sorted({cell_of(cand[u][0]) for u in cand})
    }
    return chosen, surplus, available


def select_g7(valid):
    pairs, singles = [], []
    unexpected = []
    for r in valid:
        assert_g7_sample(r)
        ks = kind_spec_of(r)
        if ks == PAIR_KIND or ks.startswith(PAIR_KIND + "-"):
            pairs.append(r)
        elif ks == SINGLE_KIND:
            singles.append(r)
        else:
            unexpected.append(r["id"])
    if unexpected:
        raise SystemExit(f"unexpected kind_spec on G7 rows: {unexpected[:20]}")
    pair_cand = complete_pair_units(pairs)
    single_cand = {r["id"]: [r] for r in singles}
    pair_chosen, pair_surplus, pair_avail = choose_in_generation_order(pair_cand, N_ADD_PAIR_UNITS)
    single_chosen, single_surplus, single_avail = choose_in_generation_order(single_cand, N_ADD_SINGLE)
    shortfall = {}
    if len(pair_chosen) < N_ADD_PAIR_UNITS:
        shortfall[PAIR_KIND] = {
            "train_target": N_ADD_PAIR_UNITS, "train_got": len(pair_chosen),
            "complete_units": len(pair_cand),
        }
    if len(single_chosen) < N_ADD_SINGLE:
        shortfall[SINGLE_KIND] = {
            "train_target": N_ADD_SINGLE, "train_got": len(single_chosen),
            "complete_units": len(single_cand),
        }
    pair_rows = [r for u in pair_chosen for r in pair_cand[u]]
    single_rows = [r for u in single_chosen for r in single_cand[u]]
    used_p, used_s = set(pair_chosen), set(single_chosen)
    reserve = [r for u, v in pair_cand.items() if u not in used_p for r in v]
    reserve += [r for u, v in single_cand.items() if u not in used_s for r in v]
    unpaired = []
    seen = defaultdict(list)
    for r in pairs:
        seen[r["pair_unit"]].append(r)
    for u, v in seen.items():
        if u not in pair_cand:
            unpaired.extend(v)
    reserve += unpaired
    return {
        "train": pair_rows + single_rows,
        "val": [],
        "reserve": reserve,
        "shortfall": shortfall,
        "pair_units": pair_chosen,
        "single_ids": single_chosen,
        "pair_surplus_units": pair_surplus,
        "single_surplus_ids": single_surplus,
        "n_pair_complete": len(pair_cand),
        "n_single": len(single_cand),
        "n_unpaired_pair": len(unpaired),
        "pair_cell_mix": cell_mix(pair_cand, pair_chosen),
        "single_cell_mix": cell_mix(single_cand, single_chosen),
        "pair_per_cell_available": pair_avail,
        "single_per_cell_available": single_avail,
    }


def collide_existing(rows, existing_ids, existing_text):
    hits = {}
    for r in rows:
        reasons = []
        if r["id"] in existing_ids:
            reasons.append("id-in-v10f")
        t = r.get("content") or r.get("state")
        if t in existing_text:
            side = existing_text[t]
            reasons.append(f"content-in-v10f-{side}")
        if reasons:
            hits[r["id"]] = reasons
    return hits


def append_check(v10f_train, v10f_val, new_tr, out_dir):
    tr_raw = Path(v10f_train).read_bytes()
    va_raw = Path(v10f_val).read_bytes()
    need = B.need
    need(B.sha_bytes(tr_raw) == V10F_TRAIN_SHA, "v10f train pin mismatch")
    need(B.sha_bytes(va_raw) == V10F_VAL_SHA, "v10f val pin mismatch")
    if not tr_raw.endswith(b"\n") or not va_raw.endswith(b"\n"):
        raise SystemExit("v10f files missing trailing newline")
    et = [json.loads(l) for l in tr_raw.decode("utf-8").splitlines() if l.strip()]
    ev = [json.loads(l) for l in va_raw.decode("utf-8").splitlines() if l.strip()]
    existing_ids = {r["id"] for r in et + ev}
    existing_text = {}
    for side, rows in (("train", et), ("val", ev)):
        for r in rows:
            existing_text[r.get("state") or r.get("content")] = side
    hits = collide_existing(new_tr, existing_ids, existing_text)
    if hits:
        raise SystemExit(f"G7 rows collide with v10f pack: {json.dumps(hits)}")
    out_dir = Path(out_dir)
    (out_dir / "data-v10").mkdir(parents=True, exist_ok=True)
    train_text = tr_raw + "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in new_tr).encode("utf-8")
    (out_dir / "data-v10" / "train.jsonl").write_bytes(train_text)
    (out_dir / "data-v10" / "val.jsonl").write_bytes(va_raw)
    need((out_dir / "data-v10" / "train.jsonl").read_bytes()[: len(tr_raw)] == tr_raw, "train prefix != v10f")
    need((out_dir / "data-v10" / "val.jsonl").read_bytes() == va_raw, "val must be byte-identical to v10f")
    need(sha_file(out_dir / "data-v10" / "val.jsonl") == V10F_VAL_SHA, "val sha drifted from v10f")
    tr = et + new_tr
    va = ev
    ids_t, ids_v = [r["id"] for r in tr], [r["id"] for r in va]
    need(len(set(ids_t)) == len(ids_t) and len(set(ids_v)) == len(ids_v), "duplicate ids")
    need(not set(ids_t) & set(ids_v), "id on both sides")
    ct = {r.get("state") or r.get("content") for r in tr}
    cross = [r["id"] for r in va if (r.get("state") or r.get("content")) in ct]
    need(not cross, f"exact-content duplicate across sides: {cross[:20]}")
    for r in va:
        for k in B.STORED_CLASS_KEYS:
            need(k not in r, f"val row {r['id']} carries stored class key {k}")
    arms = defaultdict(set)
    for r in tr:
        if r.get("pair") and r.get("path") == "headext-generated" and kind_spec_of(r) in (PAIR_KIND, r.get("contrastGroup")):
            if r.get("pair_id"):
                arms[r["pair_id"]].add(r["arm"])
    # only check newly added pair_ids if present
    new_pair_ids = {r.get("pair_id") for r in new_tr if r.get("pair_id")}
    for pid in new_pair_ids:
        need(arms.get(pid) == {"A", "B"}, f"new pair_id {pid} missing an arm")
    need(len(new_tr) == N_ADD_PAIR_UNITS * 2 + N_ADD_SINGLE, f"added train count unexpected: {len(new_tr)}")
    return {
        "n_train": len(tr), "n_val": len(va),
        "n_added_train": len(new_tr), "n_added_val": 0,
        "train_sha256": B.sha_bytes(train_text), "val_sha256": B.sha_bytes(va_raw),
        "v10f_train_sha256": V10F_TRAIN_SHA, "v10f_val_sha256": V10F_VAL_SHA,
        "spec_sha256": SPEC_SHA,
        "added_pair_units": N_ADD_PAIR_UNITS, "added_single_rows": N_ADD_SINGLE,
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--set", required=True)
    ap.add_argument("--local-report", required=True)
    ap.add_argument("--vps-report", required=True)
    ap.add_argument("--v10f-train", required=True)
    ap.add_argument("--v10f-val", required=True)
    ap.add_argument("--v10f-data-dir", required=True, help="copy empty-suite / excluded-kinds / laya-questions from here")
    ap.add_argument("--out-dir", required=True)
    a = ap.parse_args(argv)

    lr = json.loads(Path(a.local_report).read_text())
    vr = json.loads(Path(a.vps_report).read_text())
    need = B.need
    need(lr["set_sha256"] == sha_file(a.set), "set changed since local stage")
    need(vr["candidate_sha256"] == lr["candidates_sha256"], "VPS result is for a different candidate file")
    drop = set(lr["dropped"]) | set(vr["colliding"])
    rows = load_jsonl(a.set)
    valid = [r for r in rows if r["id"] not in drop]
    sel = select_g7(valid)
    if sel["shortfall"]:
        Path(a.out_dir).mkdir(parents=True, exist_ok=True)
        (Path(a.out_dir) / "pack-report.json").write_text(
            json.dumps({"shortfall": sel["shortfall"], "stopped": True}, indent=1) + "\n"
        )
        print(json.dumps({"stopped": True, "shortfall": sel["shortfall"]}))
        return 2

    spec, _ = hs.load_pinned(hs.SPEC, SPEC_SHA)
    labs = B.relabel_kinds(sorted({r["kind"] for r in sel["train"]}))
    new_tr = sorted((B.new_row(r, spec, labs[r["kind"]]) for r in sel["train"]), key=lambda r: r["id"])

    out = Path(a.out_dir); out.mkdir(parents=True, exist_ok=True)
    shas = {
        "sel-train.jsonl": dump_jsonl(sel["train"], out / "sel-train.jsonl"),
        "sel-val.jsonl": dump_jsonl([], out / "sel-val.jsonl"),
        "reserve.jsonl": dump_jsonl(sel["reserve"], out / "reserve.jsonl"),
    }
    build = append_check(a.v10f_train, a.v10f_val, new_tr, out)
    src = Path(a.v10f_data_dir)
    for name in ("empty-suite.json", "excluded-kinds.json", "laya-questions-v10.json"):
        shutil.copyfile(src / name, out / "data-v10" / name)
        need(sha_file(src / name) == sha_file(out / "data-v10" / name), f"{name} copy mismatch")

    # t241u G7 local filter on the original 96 rows (t242u: record these rates in the pack report)
    g7_filter_rates = {
        "n_set": 96,
        "validation_collisions": {"n": 7, "rate": "7/96", "reason": "V-g:inset"},
        "data_v9_collisions": {"n": 3, "rate": "3/96", "reason": "V-g:data-v9"},
        "n_dropped": 10,
        "n_candidates": 86,
        "source": "evidence/g7/filter-local.json (t241u G7 set)",
    }
    report = {
        "stopped": False,
        "n_source": len(rows),
        "n_valid": len(valid),
        "n_dropped": len(drop),
        "pair_units": sel["pair_units"],
        "single_ids": sel["single_ids"],
        "pair_surplus_units": sel["pair_surplus_units"],
        "single_surplus_ids": sel["single_surplus_ids"],
        "pair_cell_mix": sel["pair_cell_mix"],
        "single_cell_mix": sel["single_cell_mix"],
        "n_pair_complete": sel["n_pair_complete"],
        "n_single": sel["n_single"],
        "n_unpaired_pair": sel["n_unpaired_pair"],
        "selection": "generation-order (sample id); surplus dropped; no selection by content",
        "g7_filter_rates": g7_filter_rates,
        "sel_shas": shas,
        "build": build,
    }
    (out / "pack-report.json").write_text(json.dumps(report, indent=1) + "\n")
    print(json.dumps({
        "stopped": False,
        "n_train": build["n_train"], "n_val": build["n_val"],
        "n_added_train": build["n_added_train"], "n_added_val": 0,
        "train_sha256": build["train_sha256"], "val_sha256": build["val_sha256"],
        "pair_units": len(sel["pair_units"]), "single_rows": len(sel["single_ids"]),
        "pair_surplus_units": sel["pair_surplus_units"],
        "single_surplus_ids": sel["single_surplus_ids"],
        "pair_cell_mix": sel["pair_cell_mix"], "single_cell_mix": sel["single_cell_mix"],
        "g7_filter_rates": g7_filter_rates,
        "sel_train_sha256": shas["sel-train.jsonl"],
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
