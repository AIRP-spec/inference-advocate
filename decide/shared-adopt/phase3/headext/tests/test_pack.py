"""headext_pack driver on synthetic benign rows (no network, no model)."""
import json, types
from pathlib import Path
import pytest
import headext_slots as hs
import headext_filter as hf
import headext_pack as P
import synth

SPEC_SHA = hs.sha256_file(hs.SPEC)
SPEC = hs.load_pinned(hs.SPEC, SPEC_SHA)[0]
V9 = Path("/workspace/p33run/pack/data-v9")
OVERLAY = Path("/workspace/p33rescore/val-v9-rhrev.jsonl")
LC = P._v3()


def lab_rows(rows, labeler, override=None):
    out = []
    for r in rows:
        g = hf.gold_for(r, SPEC)
        prim = {"stance": g["stance"], "objects": g["objects"], "qualifiers": [q for q in g["qualifiers"] if q != "explicit_register"]}
        out.append({"id": r["id"], "labeler": labeler, "family": "x", "meta": {}, "error": None,
                    "primitives": (override or {}).get(r["id"], prim)})
    return out


def wl(p, rows):
    Path(p).write_text("".join(json.dumps(r) + "\n" for r in rows)); return p


def test_inset_siblings_exempt_and_lower_id_kept():
    rows = [{"id": "u1-a", "content": "alpha beta gamma delta epsilon zeta", "pair_unit": "u1"},
            {"id": "u1-b", "content": "alpha beta gamma delta epsilon zeta", "pair_unit": "u1"},
            {"id": "x2", "content": "alpha beta gamma delta epsilon zeta"},
            {"id": "x3", "content": "unrelated words entirely here now ok"}]
    r = P.inset_resolve(rows, LC)
    assert r["dropped"] == {"x2": "u1-a"} and r["sibling_collisions_exempt"] == 1
    assert r["sibling_exempt_pair_ids"] == ["u1"]  # A28


def test_label_override_replaces_only_its_ids(tmp_path):
    base = wl(tmp_path / "b.jsonl", [{"id": "a", "labeler": "L", "primitives": {"stance": "describes"}},
                                     {"id": "b", "labeler": "L", "primitives": {"stance": "describes"}}])
    ov = wl(tmp_path / "o.jsonl", [{"id": "a", "labeler": "L", "primitives": {"stance": "encourages"}}])
    got = P.load_labels([base], [ov])["L"]
    assert got["a"] == {"stance": "encourages"} and got["b"] == {"stance": "describes"}
    with pytest.raises(SystemExit):
        P.load_labels([base, ov])
    ov2 = wl(tmp_path / "o2.jsonl", [{"id": "a", "labeler": "L", "primitives": {"stance": "endorses"}}])
    with pytest.raises(SystemExit):
        P.load_labels([base], [ov, ov2])


@pytest.fixture(scope="module")
def run(tmp_path_factory):
    d = tmp_path_factory.mktemp("pack")
    rows = synth.generated(SPEC, SPEC_SHA)
    harm = next(r for r in rows if hf.gold_for(r, SPEC)["stance"] == "endorses" and not r.get("pair_unit"))
    num = next(r for r in rows if r["provenance"]["kind_spec"] == "sec-isolate")
    num["content"] += " call 5551234"
    dup_src, dup = [r for r in rows if r["provenance"]["kind_spec"] == "op-personal-view"][:2]
    dup["content"] = dup_src["content"]
    v9hit = next(r for r in rows if r["provenance"]["kind_spec"] == "rr-role-claim")
    refusal = {"stance": "describes", "objects": [], "qualifiers": ["is_mention_not_use"]}
    s = wl(d / "set.jsonl", rows)
    l1 = wl(d / "l1.jsonl", lab_rows(rows, "seed-oss-36b", {harm["id"]: refusal}))
    l2 = wl(d / "l2.jsonl", lab_rows(rows, "nemotron-3-super", {harm["id"]: refusal}))
    v9 = wl(d / "v9.jsonl", [{"id": "v9-1", "content": v9hit["content"]}])
    lr = P.local(s, [l1, l2], SPEC_SHA, [v9], d / "out", procs=2)
    return d, rows, lr, dict(harm=harm["id"], num=num["id"], dup=max(dup["id"], dup_src["id"]), v9=v9hit["id"])


def test_local_drops(run):
    d, rows, lr, ids = run
    assert lr["dropped"][ids["harm"]] == ["V-d:stance_refusal"]
    assert lr["dropped"][ids["num"]] == ["V-f:number_not_on_list:1"]
    assert lr["dropped"][ids["dup"]][0].startswith("V-g:inset:")
    assert lr["dropped"][ids["v9"]] == ["V-g:data-v9"]
    assert lr["n_dropped"] == 4 and lr["n_candidates"] == len(rows) - 4
    assert lr["inset_sibling_collisions_exempt"] == 0


def test_vps_stage_with_stub_protected(run, monkeypatch, tmp_path):
    d, rows, lr, ids = run
    cand = d / "out" / "vg-candidates.jsonl"
    stub = types.SimpleNamespace(**{k: getattr(LC, k) for k in ("read_candidates", "build_index", "collides")})
    stub.check = lambda p, sha, pd=None: {"colliding_ids": [], "protected_pins": {"stub": 1}, "rule": "stub"}
    monkeypatch.setattr(P, "_v3", lambda p=None: stub)
    first = json.loads(cand.read_text().splitlines()[0])
    seal = wl(tmp_path / "seal.jsonl", [{"id": "s1", "content": first["content"]}])
    r = P.vps(cand, lr["candidates_sha256"], [seal], None)
    assert r["colliding"] == {first["id"]: ["V-g:seal:seal.jsonl"]}


@pytest.mark.skipif(not (V9 / "train.jsonl").exists() or not OVERLAY.exists(), reason="pinned data-v9 not on this box")
def test_finalize_deterministic(run, tmp_path):
    d, rows, lr, ids = run
    vr = wl(tmp_path / "vps.json", [])
    Path(vr).write_text(json.dumps({"candidate_sha256": lr["candidates_sha256"], "colliding": {}}))
    outs = [P.finalize(d / "set.jsonl", d / "out" / "filter-local.json", vr, SPEC_SHA, V9 / "train.jsonl", OVERLAY,
                       V9 / "val.jsonl", tmp_path / f"f{i}") for i in (0, 1)]
    assert outs[0]["build"]["train_sha256"] == outs[1]["build"]["train_sha256"]
    assert outs[0]["build"]["val_sha256"] == outs[1]["build"]["val_sha256"]
    assert outs[0]["sel_shas"] == outs[1]["sel_shas"]
    assert outs[0]["n_valid"] == len(rows) - 4
    allsel = {json.loads(l)["id"] for n in ("sel-train.jsonl", "sel-val.jsonl") for l in (tmp_path / "f0" / n).read_text().splitlines()}
    assert not allsel & set(ids.values())
    fl = outs[0]["floors"]
    assert fl["per_kind"]["hate-elim-vs-self-harm"]["train_units"] == 12 and fl["per_kind"]["hate-elim-vs-self-harm"]["val_units"] == 8


def test_pair_collides_equals_pinned_inset():
    import random
    from airp_v3 import inset
    rnd = random.Random(7)
    vocab = ["al", "be", "ga", "de", "ep", "ze", "et", "th"]
    rows = []
    for i in range(160):
        n = rnd.choice([0, 2, 3, 5, 8, 12])
        rows.append({"id": f"r{i:03d}", "content": " ".join(rnd.choice(vocab[:4] if i % 3 else vocab) for _ in range(n))})
    rows.append({"id": "r900", "content": "x" * 45}); rows.append({"id": "r901", "content": "y " + "x" * 45})
    want = inset.resolve(rows)["dropped"]
    assert P.inset_resolve(rows, LC)["dropped"] == want


def test_accepted_shortfalls_record(run, tmp_path):
    d, rows, lr, ids = run
    vr = wl(tmp_path / "vps.json", [])
    Path(vr).write_text(json.dumps({"candidate_sha256": lr["candidates_sha256"], "colliding": {}}))
    o = P.finalize(d / "set.jsonl", d / "out" / "filter-local.json", vr, SPEC_SHA, V9 / "train.jsonl", OVERLAY,
                   V9 / "val.jsonl", tmp_path / "f")
    a = o["accepted_shortfalls"]
    assert a["amendment"].startswith("A26")
    assert a["probes_user_emotion_new_train"] == o["floors"]["heads"]["probes_user_emotion"]["new_train_rows"]
    assert not set(a["kinds_accepted"]) & set(P.OFFER_KINDS)
    assert a["offer_reported_A25"]["target"] == 60
    assert json.loads((tmp_path / "f" / "pack-report.json").read_text())["accepted_shortfalls"] == a
