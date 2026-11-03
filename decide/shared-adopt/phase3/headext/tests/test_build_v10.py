"""data-v10 builder on the REAL pinned data-v9 train + RH-overlay val + synthetic placeholder generations."""
import json, subprocess
from pathlib import Path
import pytest
import headext_slots as hs
import headext_filter as hf
import build_data_v10 as B
import synth

V9 = Path("/workspace/p33run/pack/data-v9")
OVERLAY = Path("/workspace/p33rescore/val-v9-rhrev.jsonl")
P32 = Path("/workspace/p33run/pack")
SPEC_SHA = hs.sha256_file(hs.SPEC)
SPEC = hs.load_pinned(hs.SPEC, SPEC_SHA)[0]
pytestmark = pytest.mark.skipif(not (V9 / "train.jsonl").exists() or not OVERLAY.exists(), reason="pinned data-v9 not on this box")


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    d = tmp_path_factory.mktemp("v10")
    sel = hf.select(synth.generated(SPEC, SPEC_SHA), SPEC)
    hf.seal(sel["train"], d / "sel-train.jsonl"); hf.seal(sel["val"], d / "sel-val.jsonl")
    rep = B.build(V9 / "train.jsonl", OVERLAY, V9 / "val.jsonl", d / "sel-train.jsonl", d / "sel-val.jsonl", hs.SPEC, SPEC_SHA,
                  d / "out", P32)
    return d, rep


def test_totals_and_floors(built):
    d, rep = built
    assert (rep["n_new_train"], rep["n_new_val"]) == (1684, 960)
    assert (rep["n_train"], rep["n_val"]) == (7386 + 1684, 873 + 960)
    assert rep["below_floor"] == []
    for h, v in rep["heads"].items():
        assert v["val_pos_in_distribution"] >= 60 and v["val_pairs"] >= 6, h
        assert len(v["held_out_groups"]) == 1, h
    assert rep["offer"]["offer-terse"] == {"train": 0, "val": 16}
    assert rep["hate_pairs"] == {"train": 12, "val": 8}
    assert rep["v3_rows"] == {"a": 32, "b": 12, "c": 12}
    assert rep["p32_val_rows"] == 1833


def test_existing_rows_byte_identical_and_unmapped(built):
    d, _ = built
    tl = (d / "out" / "train.jsonl").read_text().splitlines()
    assert tl[:7386] == (V9 / "train.jsonl").read_text().splitlines()
    vl = (d / "out" / "val.jsonl").read_text().splitlines()
    assert vl[:873] == OVERLAY.read_text().splitlines()
    assert all("ext" not in json.loads(l) for l in tl[:7386] + vl[:873])


def test_new_rows_gold_matches_relabel_and_no_class_keys(built):
    d, _ = built
    va = [json.loads(l) for l in (d / "out" / "val.jsonl").read_text().splitlines()[873:]]
    for r in va:
        assert not any(k in r for k in B.STORED_CLASS_KEYS)
        assert set(r["ext"]) == set(SPEC["heads"])
        if r["register"] == "terse":
            assert "explicit_register" in r["qualifiers"]


def test_mismatch_with_kind_table_fails(built, tmp_path, monkeypatch):
    d, _ = built
    real = B.relabel_kinds
    def bad(kinds):
        out = real(kinds); out[kinds[0]]["stance"] = "depicts"; return out
    monkeypatch.setattr(B, "relabel_kinds", bad)
    with pytest.raises(B.BuildError):
        B.build(V9 / "train.jsonl", OVERLAY, V9 / "val.jsonl", d / "sel-train.jsonl", d / "sel-val.jsonl", hs.SPEC, SPEC_SHA, tmp_path)


def test_held_out_in_train_fails(built, tmp_path):
    d, _ = built
    tr = hf.load_jsonl(d / "sel-train.jsonl"); va = hf.load_jsonl(d / "sel-val.jsonl")
    moved = next(r for r in va if r["provenance"]["kind_spec"] == "offer-terse")
    hf.seal(tr + [moved], tmp_path / "t.jsonl"); hf.seal([r for r in va if r["id"] != moved["id"]], tmp_path / "v.jsonl")
    with pytest.raises(B.BuildError):
        B.build(V9 / "train.jsonl", OVERLAY, V9 / "val.jsonl", tmp_path / "t.jsonl", tmp_path / "v.jsonl", hs.SPEC, SPEC_SHA, tmp_path / "o")


def test_wrong_pin_fails(built, tmp_path):
    d, _ = built
    with pytest.raises(B.BuildError):
        B.build(V9 / "val.jsonl", OVERLAY, V9 / "val.jsonl", d / "sel-train.jsonl", d / "sel-val.jsonl", hs.SPEC, SPEC_SHA, tmp_path)


def test_kind_table_zero_by_default_and_excluded():
    """Every pre-existing kind-table entry has no `ext` (=> 0 on all eight new heads); excluded kinds exist and the
    mapped list is empty (amendment 7)."""
    t = json.load(open(B.TABLE))["table"]
    new = {k for k in t if "ext" in t[k]}
    import append_kind_table as A
    assert new <= set(A.spec_entries(SPEC))
    exc = json.load(open(Path(B.HERE) / "pack" / "data-v10" / "excluded-kinds.json"))
    assert exc["mapped"] == {}
    v9_kinds = {json.loads(l).get("kind") for f in (V9 / "train.jsonl", OVERLAY) for l in open(f) if l.strip()}
    for h, spec in exc["excluded"].items():
        for k in spec.get("kinds", []):
            assert k in v9_kinds, k                      # every listed kind exists in data-v9
            assert k not in t or "ext" not in t[k], k    # and is never mapped to 1
        for p in spec.get("prefixes", []):
            assert any(str(k).startswith(p) for k in v9_kinds), p


def test_a28_pair_id_on_both_arms(built):
    d, _ = built
    for side in ("train.jsonl", "val.jsonl"):
        rows = [json.loads(l) for l in (d / "out" / side).read_text().splitlines()]
        new = [r for r in rows if r.get("path") == "headext-generated" and r.get("contrastGroup")]
        assert new
        by = {}
        for r in new:
            assert r["pair_id"] == r["pair"] == r["source"]["pair_id"]
            by.setdefault(r["pair_id"], set()).add(r["arm"])
        assert all(v == {"A", "B"} for v in by.values())
        assert all("pair_id" not in r for r in rows if r.get("path") != "headext-generated")
