#!/usr/bin/env python3
"""t237u incremental v10f pack: keep existing v10e (F5 already applied) rows byte-identical;
select 36 train + 12 val from G6 survivors only (do not re-split old units). Deterministic
cell round-robin; F6 shape is whatever the val short cells already are (in proportion, not
hand-selected). Box only. Stdout = counts, ids, and shas; never prints row text.
"""
from __future__ import annotations

import argparse, hashlib, json, shutil, sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path("/workspace/wt-p3/decide/shared-adopt/phase3/headext")
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE / "pack"))
import headext_slots as hs  # noqa: E402
import headext_filter as hf  # noqa: E402
import build_data_v10 as B  # noqa: E402

SPEC_SHA = "179476f421a9f36c164b7e37e04771d690858400a12cb56ca8b7ebe36a2096a9"
V10E_TRAIN_SHA = "f9838a7b4f792384c722ee98b8086382d0acfdc1c42796c065145c62577577e8"
V10E_VAL_SHA = "f61dbbaacf7ab89fd126348fda6d5456d04d2b5903c2580af2b988794e6649a1"
G6_TRAIN_START, G6_TRAIN_END = 55, 101
G6_VAL_START, G6_VAL_END = 102, 117
N_ADD_TRAIN, N_ADD_VAL = 36, 12
KIND = "op-own-vs-reported"


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


def pool_of(r):
    s = r["provenance"]["sample"]
    if G6_TRAIN_START <= s <= G6_TRAIN_END:
        return "train"
    if G6_VAL_START <= s <= G6_VAL_END:
        return "val"
    raise SystemExit(f"sample {s} on {r['id']} is outside G6 ranges")


def complete_units(rows):
    units = defaultdict(list)
    for r in rows:
        units[r["pair_unit"]].append(r)
    return {u: sorted(v, key=lambda x: x["arm"]) for u, v in units.items() if len(v) == 2}


def rr_choose(cand, n, cells):
    per_cell = {
        c: sorted(
            [u for u, v in cand.items() if (v[0]["provenance"]["register"], v[0]["provenance"]["length"]) == c],
            key=lambda u: cand[u][0]["provenance"]["sample"],
        )
        for c in cells
    }
    chosen, depth = [], 0
    while len(chosen) < n and any(depth < len(v) for v in per_cell.values()):
        for c in cells:
            if depth < len(per_cell[c]) and len(chosen) < n:
                chosen.append(per_cell[c][depth])
        depth += 1
    return chosen, {f"{c[0]}/{c[1]}": [cand[u][0]["provenance"]["sample"] for u in us] for c, us in per_cell.items()}


def cell_mix(cand, units):
    mix = Counter()
    f6_short = 0
    for u in units:
        r = cand[u][0]
        p = r["provenance"]
        mix[f"{p['register']}/{p['length']}"] += 1
        if p["length"] == "short":
            f6_short += 1
    return dict(mix), f6_short


def select_g6(valid):
    spec, _ = hs.load_pinned(hs.SPEC, SPEC_SHA)
    k = next(x for x in spec["kinds"] if x["id"] == KIND)
    train_cells = [(r, "short") for r in k["registers"]]
    val_cells = hs.cells_for(spec, k)
    by_pool = {"train": [], "val": []}
    for r in valid:
        if r["provenance"]["kind_spec"] != KIND:
            raise SystemExit(f"unexpected kind_spec on {r['id']}")
        by_pool[pool_of(r)].append(r)
    tr_cand = complete_units(by_pool["train"])
    va_cand = complete_units(by_pool["val"])
    unpaired = (
        sum(1 for rows in defaultdict(list, {**{r["pair_unit"]: [] for r in by_pool["train"]}}).values())
    )
    # unpaired arms: valid rows whose unit is incomplete
    def n_unpaired(rows, cand):
        units = defaultdict(list)
        for r in rows:
            units[r["pair_unit"]].append(r)
        return sum(len(v) for u, v in units.items() if u not in cand)

    tr_chosen, tr_cells = rr_choose(tr_cand, N_ADD_TRAIN, train_cells)
    va_chosen, va_cells = rr_choose(va_cand, N_ADD_VAL, val_cells)
    shortfall = {}
    if len(tr_chosen) < N_ADD_TRAIN or len(va_chosen) < N_ADD_VAL:
        shortfall[KIND] = {
            "train_target": N_ADD_TRAIN, "train_got": len(tr_chosen),
            "val_target": N_ADD_VAL, "val_got": len(va_chosen),
            "train_complete_units": len(tr_cand), "val_complete_units": len(va_cand),
        }
    tr_rows = [r for u in tr_chosen for r in tr_cand[u]]
    va_rows = [r for u in va_chosen for r in va_cand[u]]
    tr_cs, va_cs = set(tr_chosen), set(va_chosen)
    reserve = [r for u, v in tr_cand.items() if u not in tr_cs for r in v]
    reserve += [r for u, v in va_cand.items() if u not in va_cs for r in v]
    reserve += [r for r in by_pool["train"] + by_pool["val"] if (r.get("pair_unit") or r["id"]) not in {**tr_cand, **va_cand}]
    tr_mix, tr_f6 = cell_mix(tr_cand, tr_chosen)
    va_mix, va_f6 = cell_mix(va_cand, va_chosen)
    return {
        "train": tr_rows, "val": va_rows, "reserve": reserve, "shortfall": shortfall,
        "train_units": tr_chosen, "val_units": va_chosen,
        "n_train_complete": len(tr_cand), "n_val_complete": len(va_cand),
        "n_unpaired_train": n_unpaired(by_pool["train"], tr_cand),
        "n_unpaired_val": n_unpaired(by_pool["val"], va_cand),
        "train_cell_mix": tr_mix, "val_cell_mix": va_mix,
        "train_f6_short_units": tr_f6, "val_f6_short_units": va_f6,
        "train_per_cell_available": tr_cells, "val_per_cell_available": va_cells,
    }


def collide_existing(rows, existing_ids, existing_text):
    hits = {}
    for r in rows:
        reasons = []
        if r["id"] in existing_ids:
            reasons.append("id-in-v10e")
        t = r.get("content") or r.get("state")
        if t in existing_text:
            side = existing_text[t]
            reasons.append(f"content-in-v10e-{side}")
        if reasons:
            hits[r["id"]] = reasons
    return hits


def append_check(v10e_train, v10e_val, new_tr, new_va, out_dir, p32_pack):
    """Prefix of output must be the sealed v10e files byte-for-byte; then G6 new_row() rows, id-sorted."""
    tr_raw = Path(v10e_train).read_bytes()
    va_raw = Path(v10e_val).read_bytes()
    need = B.need
    need(B.sha_bytes(tr_raw) == V10E_TRAIN_SHA, "v10e train pin mismatch")
    need(B.sha_bytes(va_raw) == V10E_VAL_SHA, "v10e val pin mismatch")
    if not tr_raw.endswith(b"\n") or not va_raw.endswith(b"\n"):
        raise SystemExit("v10e files missing trailing newline")
    # existing ids / texts
    et = [json.loads(l) for l in tr_raw.decode("utf-8").splitlines() if l.strip()]
    ev = [json.loads(l) for l in va_raw.decode("utf-8").splitlines() if l.strip()]
    existing_ids = {r["id"] for r in et + ev}
    existing_text = {}
    for side, rows in (("train", et), ("val", ev)):
        for r in rows:
            existing_text[r.get("state") or r.get("content")] = side
    hits = collide_existing(new_tr + new_va, existing_ids, existing_text)
    if hits:
        raise SystemExit(f"G6 rows collide with v10e pack: {json.dumps(hits)}")
    out_dir = Path(out_dir); (out_dir / "data-v10").mkdir(parents=True, exist_ok=True)
    train_text = tr_raw + "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in new_tr).encode("utf-8")
    val_text = va_raw + "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in new_va).encode("utf-8")
    (out_dir / "data-v10" / "train.jsonl").write_bytes(train_text)
    (out_dir / "data-v10" / "val.jsonl").write_bytes(val_text)
    # prefix identity
    need((out_dir / "data-v10" / "train.jsonl").read_bytes()[: len(tr_raw)] == tr_raw, "train prefix != v10e")
    need((out_dir / "data-v10" / "val.jsonl").read_bytes()[: len(va_raw)] == va_raw, "val prefix != v10e")
    # reuse official check against v10e prefix (existing rows already have `ext` on headext portion,
    # so official check() which assumes the prefix is v9 without ext cannot be used as-is).
    tr = et + new_tr
    va = ev + new_va
    ids_t, ids_v = [r["id"] for r in tr], [r["id"] for r in va]
    need(len(set(ids_t)) == len(ids_t) and len(set(ids_v)) == len(ids_v), "duplicate ids")
    need(not set(ids_t) & set(ids_v), "id on both sides")
    ct = {r.get("state") or r.get("content") for r in tr}
    need(not [r["id"] for r in va if (r.get("state") or r.get("content")) in ct], "exact-content duplicate across sides")
    for r in va:
        for k in B.STORED_CLASS_KEYS:
            need(k not in r, f"val row {r['id']} carries stored class key {k}")
    for side in (tr, va):
        arms = defaultdict(set)
        for r in side:
            if r.get("pair") and r.get("path") == "headext-generated":
                need(r.get("pair_id") == r["pair"] == r.get("source", {}).get("pair_id"), f"{r['id']}: pair_id (A28)")
                arms[r["pair_id"]].add(r["arm"])
        need(all(v == {"A", "B"} for v in arms.values()), "a pair_id without both arms on one side (A28)")
    spec, _ = hs.load_pinned(hs.SPEC, SPEC_SHA)
    # held-out groups still have 0 train (G6 does not add held-out kinds)
    train_groups = Counter(B.group_of(r) for r in tr)
    held_kinds = {g[-1] for g in spec["head_groups"].values()} | {k["id"] for k in spec["kinds"] if k.get("held_out")}
    for k in held_kinds:
        need(train_groups.get(k, 0) == 0, f"held-out group {k} has train rows")
    n_op_tr = sum(1 for r in tr if r.get("contrastGroup") == KIND)
    n_op_va = sum(1 for r in va if r.get("contrastGroup") == KIND)
    need(n_op_tr == 24 * 2 + N_ADD_TRAIN * 2, f"train op-own units unexpected: {n_op_tr}")
    need(n_op_va == 12 * 2 + N_ADD_VAL * 2, f"val op-own units unexpected: {n_op_va}")
    rep = {
        "n_train": len(tr), "n_val": len(va),
        "n_added_train": len(new_tr), "n_added_val": len(new_va),
        "train_sha256": B.sha_bytes(train_text), "val_sha256": B.sha_bytes(val_text),
        "v10e_train_sha256": V10E_TRAIN_SHA, "v10e_val_sha256": V10E_VAL_SHA,
        "spec_sha256": SPEC_SHA,
        "op_own_vs_reported": {"train_rows": n_op_tr, "val_rows": n_op_va,
                               "train_units": n_op_tr // 2, "val_units": n_op_va // 2},
    }
    if p32_pack:
        sys.path.insert(0, str(p32_pack))
        import p32_val
        from airp_v3.compose import load_composition
        comp = load_composition(Path(p32_pack) / "spec" / "composition-2a.json")
        rows = p32_val.load_val_derived(out_dir / "data-v10" / "val.jsonl", comp, val_sha=None)
        rep["p32_val_rows"] = len(rows)
    # copy unchanged companion files from v10e data-v10
    return rep


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--set", required=True)
    ap.add_argument("--local-report", required=True)
    ap.add_argument("--vps-report", required=True)
    ap.add_argument("--v10e-train", required=True)
    ap.add_argument("--v10e-val", required=True)
    ap.add_argument("--v10e-data-dir", required=True, help="copy empty-suite / excluded-kinds / laya-questions from here")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--p32-pack")
    ap.add_argument("--review-out", help="write review_sample for new selected rows only")
    a = ap.parse_args(argv)

    lr = json.loads(Path(a.local_report).read_text())
    vr = json.loads(Path(a.vps_report).read_text())
    need = B.need
    need(lr["set_sha256"] == sha_file(a.set), "set changed since local stage")
    need(vr["candidate_sha256"] == lr["candidates_sha256"], "VPS result is for a different candidate file")
    drop = set(lr["dropped"]) | set(vr["colliding"])
    rows = load_jsonl(a.set)
    valid = [r for r in rows if r["id"] not in drop]
    sel = select_g6(valid)
    if sel["shortfall"]:
        Path(a.out_dir).mkdir(parents=True, exist_ok=True)
        (Path(a.out_dir) / "pack-report.json").write_text(json.dumps({"shortfall": sel["shortfall"], "stopped": True}, indent=1) + "\n")
        print(json.dumps({"stopped": True, "shortfall": sel["shortfall"]}))
        return 2

    spec, _ = hs.load_pinned(hs.SPEC, SPEC_SHA)
    labs = B.relabel_kinds(sorted({r["kind"] for r in sel["train"] + sel["val"]}))
    new_tr = sorted((B.new_row(r, spec, labs[r["kind"]]) for r in sel["train"]), key=lambda r: r["id"])
    new_va = sorted((B.new_row(r, spec, labs[r["kind"]]) for r in sel["val"]), key=lambda r: r["id"])

    out = Path(a.out_dir); out.mkdir(parents=True, exist_ok=True)
    shas = {
        "sel-train.jsonl": dump_jsonl(sel["train"], out / "sel-train.jsonl"),
        "sel-val.jsonl": dump_jsonl(sel["val"], out / "sel-val.jsonl"),
        "reserve.jsonl": dump_jsonl(sel["reserve"], out / "reserve.jsonl"),
    }
    build = append_check(a.v10e_train, a.v10e_val, new_tr, new_va, out, a.p32_pack)
    # companion files byte-copied from v10e
    src = Path(a.v10e_data_dir)
    for name in ("empty-suite.json", "excluded-kinds.json", "laya-questions-v10.json"):
        shutil.copyfile(src / name, out / "data-v10" / name)
        need(sha_file(src / name) == sha_file(out / "data-v10" / name), f"{name} copy mismatch")

    review = None
    if a.review_out:
        sys.path.insert(0, str(HERE))
        import review_sample as rs
        review = rs.build(sel["train"] + sel["val"], spec, a.review_out)

    report = {
        "mode": "incremental-v10f-g6",
        "ruling": "t237u",
        "set_sha256": lr["set_sha256"],
        "n_set": len(rows),
        "n_dropped_local": len(lr["dropped"]),
        "n_dropped_vps": len(set(vr["colliding"]) - set(lr["dropped"])),
        "n_valid": len(valid),
        "n_sel_train": len(sel["train"]),
        "n_sel_val": len(sel["val"]),
        "n_reserve": len(sel["reserve"]),
        "sel_train_units": sel["train_units"],
        "sel_val_units": sel["val_units"],
        "train_cell_mix": sel["train_cell_mix"],
        "val_cell_mix": sel["val_cell_mix"],
        "train_f6_short_units": sel["train_f6_short_units"],
        "val_f6_short_units": sel["val_f6_short_units"],
        "n_train_complete": sel["n_train_complete"],
        "n_val_complete": sel["n_val_complete"],
        "n_unpaired_train": sel["n_unpaired_train"],
        "n_unpaired_val": sel["n_unpaired_val"],
        "sel_shas": shas,
        "shortfall": sel["shortfall"],
        "vps_colliding_ids": sorted(vr["colliding"]),
        "build": build,
        "review_sample": review,
        "spec_sha256": SPEC_SHA,
        "note": "existing 24 train + 12 val op-own-vs-reported units kept; G6 36+12 appended; F5 already in v10e prefix",
    }
    (out / "pack-report.json").write_text(json.dumps(report, indent=1) + "\n")
    public = {k: report[k] for k in (
        "mode", "n_set", "n_dropped_local", "n_dropped_vps", "n_valid",
        "n_sel_train", "n_sel_val", "n_reserve", "sel_train_units", "sel_val_units",
        "train_cell_mix", "val_cell_mix", "train_f6_short_units", "val_f6_short_units",
        "sel_shas", "shortfall", "spec_sha256",
    )}
    public["build"] = {k: build[k] for k in build}
    print(json.dumps(public, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
