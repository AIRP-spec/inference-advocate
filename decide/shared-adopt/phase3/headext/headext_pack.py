#!/usr/bin/env python3
"""data-v10 pack driver (sizing addendum §5, §7, §11; Justin t220u item 4). Glue only: every rule lives in the pinned
headext_filter / build_data_v10 / airp_v3 code; this file orders them and logs ids, reasons, counts and shas.

Never prints row text. Stages:
  local    V-a -> V-b/V-c recheck (must be 0) -> V-d -> V-e -> V-f -> V-g in-set + data-v9 corpus; writes the survivors'
           (id, content) as the blind candidate file for the VPS check.
  vps      (runs on the VPS; imports only airp_v3) V-g blind: v2 + v1-207 held-out suites, plus every --corpus seal file.
           Prints candidate ids only.
  finalize drops the VPS ids -> headext_filter.select -> seal sel-train / sel-val / reserve -> build_data_v10.build ->
           floor report.

In-set rule: airp_v3.inset (ids ascending, drop a row colliding with an earlier KEPT row) with one exemption: the two
arms of ONE pair unit are written to match in surface by design (§3, A2) and are never compared with each other.
"""
from __future__ import annotations

import argparse, hashlib, json, os, sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent


def _v3(path=None):
    p = Path(path or os.environ.get("AIRP_V3_PATH", "/workspace/evaluator-suite/v3"))
    sys.path.insert(0, str(p))
    from airp_v3 import leakcheck  # noqa: E402
    return leakcheck


def sha_file(p) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as fh:
        for b in iter(lambda: fh.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def load_jsonl(p):
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


def text_of(r):
    return r.get("state") or r.get("content") or ""


# ---------------- labels ----------------
def load_labels(paths, override_paths=()) -> dict:
    """labeler -> id -> primitives. A later file never silently overrides a different label for the same id.
    override_paths (A25, t221u): relabels under a revised guide; they replace the base label for their ids only, and
    must not conflict among themselves."""
    out = defaultdict(dict)
    for p in paths:
        for r in load_jsonl(p):
            d = out[r["labeler"]]
            if r["id"] in d and d[r["id"]] != r.get("primitives"):
                raise SystemExit(f"conflicting labels for {r['id']} from {r['labeler']} ({p})")
            d[r["id"]] = r.get("primitives")
    seen = defaultdict(dict)
    for p in override_paths:
        for r in load_jsonl(p):
            o = seen[r["labeler"]]
            if r["id"] in o and o[r["id"]] != r.get("primitives"):
                raise SystemExit(f"conflicting override labels for {r['id']} from {r['labeler']} ({p})")
            o[r["id"]] = r.get("primitives")
            out[r["labeler"]][r["id"]] = r.get("primitives")
    return dict(out)


# ---------------- in-set (airp_v3.inset rule, pair-unit siblings exempt) ----------------
def pair_collides(a, b, leakcheck, jaccard_limit=0.5) -> bool:
    """Exactly airp_v3.inset's test for row a against kept row b: collides(a, index[b]) or, when a normalises to
    non-empty, collides(b, index[a]); a and b are precomputed (normalize, word_ngrams) tuples."""
    (na, ga), (nb, gb) = a, b
    if not na:
        return False
    if na == nb:
        return True
    if nb and len(na) >= 40 and len(nb) >= 40 and (na in nb or nb in na):
        return True
    if (len(gb) >= 3 or len(ga) >= 3) and leakcheck.jaccard(ga, gb) >= jaccard_limit:
        return True
    return False


def inset_resolve(rows, leakcheck, jaccard_limit=0.5) -> dict:
    items = sorted(((r["id"], r["content"], r.get("pair_unit")) for r in rows), key=lambda x: x[0])
    kept, dropped, sibling_hits, sibling_units = [], {}, 0, set()
    for rid, text, unit in items:
        me = (leakcheck.normalize(text), leakcheck.word_ngrams(text, 4))
        hit = None
        for kid, kv, kunit in kept:
            if unit is not None and unit == kunit:
                if pair_collides(me, kv, leakcheck, jaccard_limit):
                    sibling_hits += 1; sibling_units.add(unit)
                continue
            if pair_collides(me, kv, leakcheck, jaccard_limit):
                hit = kid; break
        if hit is None:
            kept.append((rid, me, unit))
        else:
            dropped[rid] = hit
    return {"n_in": len(items), "n_dropped": len(dropped), "dropped": dropped, "sibling_collisions_exempt": sibling_hits,
            "sibling_exempt_pair_ids": sorted(sibling_units)}


def _corpus_worker(args):
    chunk, texts = args
    lc = _v3(os.environ.get("AIRP_V3_PATH"))
    idx = lc.build_index(texts)
    return [rid for rid, t in chunk if lc.collides(t, idx)]


def corpus_hits(cands, corpus_texts, procs=8) -> list[str]:
    from multiprocessing import Pool
    chunks = [cands[i::procs] for i in range(procs)]
    with Pool(procs) as pool:
        res = pool.map(_corpus_worker, [(c, corpus_texts) for c in chunks])
    return sorted(i for r in res for i in r)


# ---------------- local stage ----------------
def local(set_path, label_paths, spec_sha, v9_files, out_dir, procs=8, override_paths=()) -> dict:
    sys.path.insert(0, str(HERE))
    import headext_slots as hs
    import headext_filter as hf
    spec, _ = hs.load_pinned(hs.SPEC, spec_sha)
    lc = _v3()
    rows = load_jsonl(set_path)
    ids = [r["id"] for r in rows]
    assert len(set(ids)) == len(ids), "duplicate ids in set"
    labels = load_labels(label_paths, override_paths)
    composer = hf.load_composer()
    drops = {}
    def drop(i, reasons):
        drops.setdefault(i, []).extend(reasons)
    # V-a
    for r in rows:
        if hf.va_reasons(r):
            drop(r["id"], ["V-a:" + x for x in hf.va_reasons(r)])
    # V-b / V-c recheck: every flag was already deleted in-pod; any remaining flag stops the run (nothing is deleted here)
    cov = {lab: sum(1 for i in ids if i in d) for lab, d in labels.items()}
    resid = {}
    for lab, d in labels.items():
        for i in ids:
            if i in d:
                t = [x for x in hf.flags_from_label(d[i], lab, composer) if not x.startswith("invalid")]
                if t:
                    resid[i] = t
    if resid:
        raise SystemExit(f"V-b/V-c residual flags on {len(resid)} set rows: stop (ids in no file; rerun checker-delete)")
    allowed = set(spec["allowed_digit_strings"])
    live = [r for r in rows if r["id"] not in drops]
    for r in live:
        rs = []
        rs += ["V-d:" + x for x in hf.vd_reason(hf.gold_for(r, spec)["stance"], [d.get(r["id"]) for d in labels.values()])]
        rs += ["V-e:" + x for x in hf.ve_reasons(r, spec)]
        rs += ["V-f:" + x for x in hf.vf_reasons(r, allowed)]
        if rs:
            drop(r["id"], rs)
    live = [r for r in rows if r["id"] not in drops]
    ins = inset_resolve(live, lc)
    for i, k in ins["dropped"].items():
        drop(i, [f"V-g:inset:{k}"])
    live = [r for r in rows if r["id"] not in drops]
    corpus = []
    v9_shas = {}
    for p in v9_files:
        v9_shas[str(p)] = sha_file(p)
        corpus += [t for t in (text_of(json.loads(l)) for l in open(p, encoding="utf-8") if l.strip()) if t]
    for i in corpus_hits([(r["id"], r["content"]) for r in live], corpus, procs):
        drop(i, ["V-g:data-v9"])
    live = [r for r in rows if r["id"] not in drops]
    out_dir = Path(out_dir); out_dir.mkdir(parents=True, exist_ok=True)
    cand = out_dir / "vg-candidates.jsonl"
    cand.write_text("".join(json.dumps({"id": r["id"], "content": r["content"]}, ensure_ascii=False) + "\n"
                            for r in sorted(live, key=lambda r: r["id"])), encoding="utf-8")
    by_stage = Counter(x.split(":")[0] for v in drops.values() for x in v[:1])
    by_reason = Counter(":".join(x.split(":")[:2]) for v in drops.values() for x in v)
    kind_of = {r["id"]: r["provenance"]["kind_spec"] for r in rows}
    rep = {"stage": "local", "set_sha256": sha_file(set_path), "spec_sha256": spec_sha, "n_set": len(rows),
           "labels": {str(p): sha_file(p) for p in label_paths},
           "labels_override": {str(p): sha_file(p) for p in override_paths}, "label_coverage": cov, "vbc_residual": 0,
           "v9_corpus": v9_shas, "n_dropped": len(drops), "first_stage": dict(by_stage), "by_reason": dict(by_reason),
           "inset_sibling_collisions_exempt": ins["sibling_collisions_exempt"],
           "inset_exempt_pair_ids": ins["sibling_exempt_pair_ids"],  # A28 (t221u): approved exemption, by pair id
           "dropped_by_kind": dict(Counter(kind_of[i] for i in drops)),
           "dropped": {i: drops[i] for i in sorted(drops)}, "n_candidates": len(live), "candidates_sha256": sha_file(cand)}
    (out_dir / "filter-local.json").write_text(json.dumps(rep, indent=1) + "\n")
    return rep


# ---------------- vps stage (blind; ids out) ----------------
def vps(cand_path, sha, corpora, v3_path, protected_dir=None) -> dict:
    lc = _v3(v3_path)
    res = lc.check(Path(cand_path), sha, protected_dir)
    hits = {i: ["V-g:protected"] for i in res["colliding_ids"]}
    cands = lc.read_candidates(Path(cand_path), "content")
    cshas = {}
    for p in corpora:
        cshas[str(p)] = sha_file(p)
        rows = load_jsonl(p)
        idx = lc.build_index([text_of(r) for r in rows if text_of(r)])
        pids = {r.get("id") for r in rows}
        for cid, t in cands:
            if cid in pids or lc.collides(t, idx):
                hits.setdefault(cid, []).append(f"V-g:seal:{Path(p).name}")
    return {"candidate_sha256": sha, "protected_pins": res["protected_pins"], "rule": res["rule"], "corpora": cshas,
            "n_candidates": len(cands), "n_colliding": len(hits), "colliding": {i: hits[i] for i in sorted(hits)}}


# ---------------- finalize ----------------
def finalize(set_path, local_rep, vps_rep, spec_sha, v9_train, overlay, v9_val, out_dir, p32_pack=None) -> dict:
    sys.path.insert(0, str(HERE))
    import headext_slots as hs
    import headext_filter as hf
    import build_data_v10 as B
    spec, _ = hs.load_pinned(hs.SPEC, spec_sha)
    lr = json.loads(Path(local_rep).read_text()); vr = json.loads(Path(vps_rep).read_text())
    assert lr["set_sha256"] == sha_file(set_path), "set changed since local stage"
    assert vr["candidate_sha256"] == lr["candidates_sha256"], "VPS result is for a different candidate file"
    drop = set(lr["dropped"]) | set(vr["colliding"])
    rows = load_jsonl(set_path)
    valid = [r for r in rows if r["id"] not in drop]
    sel = hf.select(valid, spec)
    out_dir = Path(out_dir); out_dir.mkdir(parents=True, exist_ok=True)
    shas = {n: hf.seal(sel[k], out_dir / n) for k, n in (("train", "sel-train.jsonl"), ("val", "sel-val.jsonl"), ("reserve", "reserve.jsonl"))}
    rep = B.build(v9_train, overlay, v9_val, out_dir / "sel-train.jsonl", out_dir / "sel-val.jsonl", hs.SPEC, spec_sha,
                  out_dir / "data-v10", p32_pack)
    fl = floors(out_dir / "data-v10", spec, sel, valid, len(B.read_lines(v9_train)), len(B.read_lines(overlay)))
    out = {"set_sha256": lr["set_sha256"], "n_set": len(rows), "n_dropped_local": len(lr["dropped"]),
           "n_dropped_vps": len(set(vr["colliding"]) - set(lr["dropped"])), "n_valid": len(valid),
           "n_sel_train": len(sel["train"]), "n_sel_val": len(sel["val"]), "n_reserve": len(sel["reserve"]),
           "sel_shas": shas, "shortfall": sel["shortfall"], "vps_colliding_ids": sorted(vr["colliding"]), "build": rep, "floors": fl,
           "accepted_shortfalls": accepted_shortfalls(sel["shortfall"], fl)}
    (out_dir / "pack-report.json").write_text(json.dumps(out, indent=1) + "\n")
    return out


OFFER_KINDS = ("offer-clinical", "offer-colloquial", "offer-terse")
NEW_TRAIN_TARGET = 200


def accepted_shortfalls(shortfall, fl) -> dict:
    """A26/A27 (t221u, signed 2026-11-03 11:12 NPT): remaining training-size shortfalls accepted and recorded here.
    Offer kinds are A25's subject: reported against 60 train, not folded into A26."""
    heads = {h: v["new_train_rows"] for h, v in fl["heads"].items()}
    kinds = {k: v for k, v in shortfall.items() if k not in OFFER_KINDS}
    offer_train = sum(fl["per_kind"].get(k, {}).get("train", 0) for k in OFFER_KINDS)
    return {"amendment": "A26 + A27 (t221u, 2026-11-03 11:12 NPT, Justin Flores)",
            "heads_new_train_below_target": {h: n for h, n in heads.items() if n < NEW_TRAIN_TARGET},
            "new_train_target": NEW_TRAIN_TARGET,
            "probes_user_emotion_new_train": heads.get("probes_user_emotion"),
            "kinds_accepted": kinds,
            "sec_avoid_help_train": fl["per_kind"].get("sec-avoid-help", {}).get("train"),
            "offer_reported_A25": {"train": offer_train, "target": 60,
                                   "by_kind": {k: fl["per_kind"].get(k, {}).get("train") for k in OFFER_KINDS}}}


def floors(data_dir, spec, sel, valid, n_v9_train, n_v9_val) -> dict:
    """Signed floors measured on the packed files (groups by the §2 rule, by code)."""
    sys.path.insert(0, str(HERE))
    import build_data_v10 as B
    tr = load_jsonl(Path(data_dir) / "train.jsonl"); va = load_jsonl(Path(data_dir) / "val.jsonl")
    tg = Counter(B.group_of(r) for r in tr)
    new_tr, new_va = tr[n_v9_train:], va[n_v9_val:]
    heads = {}
    for h, groups in spec["head_groups"].items():
        pos_va = [r for r in va if B.is_pos(h, r)]
        ind_groups = Counter(B.group_of(r) for r in pos_va if tg.get(B.group_of(r), 0) > 0)
        heads[h] = {"new_train_rows": sum(1 for r in new_tr if r["source"]["kind_spec"] in groups),
                    "new_val_rows": sum(1 for r in new_va if r["source"]["kind_spec"] in groups),
                    "train_pos": sum(1 for r in tr if B.is_pos(h, r)),
                    "val_pos_in_dist": sum(ind_groups.values()), "val_pos_in_dist_groups": dict(sorted(ind_groups.items())),
                    "n_in_dist_groups": len(ind_groups)}
    per_kind = {}
    for k in spec["kinds"]:
        if k.get("pair"):
            units = defaultdict(set)
            for r in valid:
                if r["provenance"]["kind_spec"] == k["id"]:
                    units[r["pair_unit"]].add(r["arm"])
            have = sum(1 for v in units.values() if v == {"A", "B"})
            per_kind[k["id"]] = {"pair": True, "valid_units": have, "target": k["train_units"] + k["val_units"],
                                 "train_units": len({r["pair"] for r in new_tr if r.get("contrastGroup") == k["id"]}),
                                 "val_units": len({r["pair"] for r in new_va if r.get("contrastGroup") == k["id"]})}
        else:
            per_kind[k["id"]] = {"pair": False, "valid": sum(1 for r in valid if r["provenance"]["kind_spec"] == k["id"]),
                                 "target": k["train"] + k["val"],
                                 "train": sum(1 for r in new_tr if r["source"]["kind_spec"] == k["id"]),
                                 "val": sum(1 for r in new_va if r["source"]["kind_spec"] == k["id"])}
    return {"heads": heads, "per_kind": per_kind}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    l = sp.add_parser("local")
    l.add_argument("--set", required=True); l.add_argument("--labels", action="append", required=True)
    l.add_argument("--expect-spec-sha", required=True); l.add_argument("--v9", action="append", required=True)
    l.add_argument("--out-dir", required=True); l.add_argument("--procs", type=int, default=8)
    l.add_argument("--labels-override", action="append", default=[], help="A25 relabels (replace base labels for their ids)")
    v = sp.add_parser("vps")
    v.add_argument("--candidates", required=True); v.add_argument("--sha256", required=True)
    v.add_argument("--corpus", action="append", default=[]); v.add_argument("--v3-path", required=True)
    v.add_argument("--protected-dir"); v.add_argument("--out", required=True)
    f = sp.add_parser("finalize")
    for a in ("--set", "--local-report", "--vps-report", "--expect-spec-sha", "--v9-train", "--overlay-val", "--v9-val", "--out-dir"):
        f.add_argument(a, required=True)
    f.add_argument("--p32-pack")
    a = ap.parse_args(argv)
    if a.cmd == "local":
        r = local(a.set, a.labels, a.expect_spec_sha, a.v9, a.out_dir, a.procs, a.labels_override)
        print(json.dumps({k: r[k] for k in ("n_set", "n_dropped", "first_stage", "by_reason", "n_candidates", "candidates_sha256", "label_coverage")}))
    elif a.cmd == "vps":
        r = vps(a.candidates, a.sha256, a.corpus, a.v3_path, a.protected_dir)
        Path(a.out).write_text(json.dumps(r, indent=1) + "\n")
        print(json.dumps({k: r[k] for k in ("n_candidates", "n_colliding", "colliding")}))
    else:
        r = finalize(a.set, a.local_report, a.vps_report, a.expect_spec_sha, a.v9_train, a.overlay_val, a.v9_val, a.out_dir, a.p32_pack)
        print(json.dumps({k: r[k] for k in ("n_valid", "n_sel_train", "n_sel_val", "n_reserve", "shortfall")} | {"below_floor": r["build"]["below_floor"]}))
        return 1 if r["build"]["below_floor"] else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
