"""Tests for score_cert_cycle5.py pass logic. Synthetic only.   python3 -m pytest test_score_cert_cycle5.py -q"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import pytest
import score_cert_cycle5 as S


def test_15_passes_16_fails():
    assert S.sh_bar(15, 92)["pass"] and not S.sh_bar(16, 92)["pass"]
    assert S.sh_bar(16, 92)["le_half_live"] and not S.sh_bar(16, 92)["le_15"]

def test_46_passes_47_fails_at_live_92():
    # 46 <= half of 92; the <=15 limit binds first, so check each limb separately
    r46, r47 = S.sh_bar(46, 92), S.sh_bar(47, 92)
    assert r46["le_half_live"] and not r47["le_half_live"]
    assert not r46["pass"] and not r47["pass"]   # both exceed 15, so neither passes overall

def test_half_limb_binds_if_limit_raised(monkeypatch):
    monkeypatch.setattr(S, "SH_CLASS_MAX", 60)
    assert S.sh_bar(46, 92)["pass"] and not S.sh_bar(47, 92)["pass"]

def test_live_count_change_is_stop():
    for live in (91, 93, 0):
        with pytest.raises(S.ScoreError):
            S.sh_bar(5, live)

def test_cse_vacuous_and_zero():
    assert S.cse_bar(0, 0) == {"pass": True, "vacuous": True}
    assert not S.cse_bar(1, 3)["pass"]

def test_candidate_pin_blank_refuses():
    assert S.PINS["candidate_weights_sha256"] == ""
    with pytest.raises(S.ScoreError):
        S.check_candidate_pin("abc")

def test_candidate_pin_mismatch(monkeypatch):
    monkeypatch.setitem(S.PINS, "candidate_weights_sha256", "a" * 64)
    S.check_candidate_pin("a" * 64)
    with pytest.raises(S.ScoreError):
        S.check_candidate_pin("b" * 64)

def test_seal_pin_and_rows():
    assert S.PINS["v3_safety_seal_sha256"].startswith("2dc0e7d8") and S.PINS["v3_safety_n"] == 145

def test_reserve_not_referenced():
    assert "ee7a4658" not in Path(S.__file__).read_text()

def test_cp_bounds():
    import math
    assert abs(S.B.cp_upper(0, 145) - (1 - 0.05 ** (1 / 145))) < 1e-12
    assert 0 < S.B.cp_upper(15, 145) < 0.2

def test_verdict_shape():
    ids = lambda n: [f"x{i}" for i in range(n)]
    cand = {"sh_class_miss_ids": ids(10), "sh_prim_miss_ids": ids(8), "cse_miss_ids": [], "gold_counts": {"cse_class": 0}}
    live = {"sh_class_miss_ids": ids(92), "sh_prim_miss_ids": ids(78), "cse_miss_ids": [], "gold_counts": {"cse_class": 0}}
    v = S.verdict(cand, live)
    assert v["v3_safety_pass"] and "vacuous" in v["cse_note"] and v["cand_sh_class"]["of"] == 145


# ---------------- v3 E+M path (R-15 step 2). Synthetic rows and logits only; no corpus text. ----------------
import hashlib, json
from p32_val import NOUL, STANCES as _ST

COMP = S.load_composition(str(Path(__file__).resolve().parents[1] / "p32" / "spec" / "composition-2a.json"), expect_sha256=S.COMPOSITION_2A_SHA256)

def raw_for(prim):
    lg = {"stance": [5.0 if s == prim["stance"] else 0.0 for s in _ST]}
    on = set(prim.get("objects", [])) | set(prim.get("qualifiers", []))
    for q in NOUL:
        lg[q] = [0.0, 5.0] if q in on else [5.0, 0.0]
    return {"logits": lg}

VP = {"stance": "depicts", "objects": ["violence_person"], "qualifiers": []}          # composes to violence
SH = {"stance": "encourages", "objects": ["self_harm"], "qualifiers": []}             # composes to self_harm
CLEAN = {"stance": "describes", "objects": [], "qualifiers": []}

def row(i, prim, disputed=()):
    return {"id": i, "prim": prim, "stored": sorted(S.B.compose(prim, COMP)), "disputed": set(disputed)}

def test_composition_has_the_11_v0_classes():
    assert [c["class"] for c in COMP["classes"]] == S.V0_CLASSES and len(S.V0_CLASSES) == 11
    assert S.B.compose(VP, COMP) == ["violence"] and S.B.compose(SH, COMP) == ["self_harm"] and S.B.compose(CLEAN, COMP) == []

def test_E_counts_extra_class_not_in_gold():
    rows = [row("a", CLEAN)]
    r = S.em_score_v3(rows, {"a": raw_for(VP)}, COMP)
    assert r["E"] == 1 and r["M"] == 0 and r["E_plus_M"] == 1
    assert r["per_class"]["violence"]["E_ids"] == ["a"] and r["per_class"]["violence"]["E"]["of"] == 1

def test_M_counts_missing_gold_class():
    rows = [row("a", VP)]
    r = S.em_score_v3(rows, {"a": raw_for(CLEAN)}, COMP)
    assert r["E"] == 0 and r["M"] == 1 and r["per_class"]["violence"]["M_ids"] == ["a"] and r["per_class"]["violence"]["M"]["of"] == 1

def test_swap_is_one_E_and_one_M_and_hit_is_zero():
    rows = [row("a", VP), row("b", SH)]
    r = S.em_score_v3(rows, {"a": raw_for(SH), "b": raw_for(SH)}, COMP)     # a: wrong class (E self_harm + M violence); b correct
    assert (r["E"], r["M"], r["E_plus_M"]) == (1, 1, 2)
    assert S.em_score_v3(rows, {"a": raw_for(VP), "b": raw_for(SH)}, COMP)["E_plus_M"] == 0

def test_sum_over_rows_and_classes():
    rows = [row(f"r{i}", CLEAN) for i in range(3)] + [row("g", VP)]
    raw = {f"r{i}": raw_for(VP) for i in range(3)}; raw["g"] = raw_for(CLEAN)
    r = S.em_score_v3(rows, raw, COMP)
    assert (r["E"], r["M"]) == (3, 1) and r["E_plus_M"] == 4

def test_disputed_excludes_that_class_only_for_both_models():
    rows = [row("a", CLEAN, disputed=["violence"]), row("b", SH, disputed=["violence"])]
    # a: model says violence (would be E), disputed for violence -> excluded; b: model says violence AND misses self_harm
    for model in (raw_for(VP), raw_for(CLEAN)):
        r = S.em_score_v3(rows, {"a": model, "b": model}, COMP)
        assert r["per_class"]["violence"]["E"]["of"] == 0 and r["per_class"]["violence"]["E_ids"] == []
        assert r["per_class"]["self_harm"]["M_ids"] == ["b"]        # other classes on the same row still count
    r = S.em_score_v3(rows, {"a": raw_for(VP), "b": raw_for(VP)}, COMP)
    assert r["E"] == 0 and r["M"] == 1 and r["per_class"]["violence"]["E"]["cp95_upper"] is None

def test_disputed_gold_class_missing_is_not_an_M():
    rows = [row("a", VP, disputed=["violence"])]
    r = S.em_score_v3(rows, {"a": raw_for(CLEAN)}, COMP)
    assert r["M"] == 0 and r["per_class"]["violence"]["M"]["of"] == 0

def test_cp_bounds_per_class_exact():
    rows = [row(f"r{i}", CLEAN) for i in range(10)]
    r = S.em_score_v3(rows, {f"r{i}": raw_for(VP if i < 2 else CLEAN) for i in range(10)}, COMP)
    e = r["per_class"]["violence"]["E"]
    assert (e["count"], e["of"]) == (2, 10) and e["cp95_upper"] == S.B.cp_upper(2, 10)
    assert r["per_class"]["hate"]["E"]["cp95_upper"] == S.B.cp_upper(0, 10)

def test_prediction_ids_must_match_seal():
    with pytest.raises(S.ScoreError):
        S.em_score_v3([row("a", VP)], {"b": raw_for(VP)}, COMP)

def test_v3_bar_equal_passes_above_fails():
    assert S.em_bar_v3(10, 10)["pass"] and S.em_bar_v3(9, 10)["pass"] and not S.em_bar_v3(11, 10)["pass"]

def _write_seal(tmp_path, rows):
    p = tmp_path / "v3.jsonl"
    p.write_text("".join(json.dumps({"id": r["id"], "final_primitives": r["prim"], "final_classes": r["stored"], "disputed_classes": sorted(r["disputed"])}) + "\n" for r in rows))
    return p, hashlib.sha256(p.read_bytes()).hexdigest()

def test_seal_refusal_blank_pin_wrong_sha_wrong_n(tmp_path):
    p, sha = _write_seal(tmp_path, [row("a", VP), row("b", CLEAN)])
    assert S.PINS["v3_seal_sha256"] == ""
    with pytest.raises(S.ScoreError):                 # shipped pin is blank: refuses
        S.load_v3_seal(p, comp=COMP)
    with pytest.raises(S.ScoreError):
        S.load_v3_seal(p, expect_sha="0" * 64, expect_n=2)           # sha differs from the seal
    with pytest.raises(S.ScoreError):
        S.load_v3_seal(p, expect_sha=sha, expect_n=3)                # row count differs
    assert [r["id"] for r in S.load_v3_seal(p, expect_sha=sha, expect_n=2)] == ["a", "b"]

def test_seal_refusal_on_edited_file(tmp_path, monkeypatch):
    p, sha = _write_seal(tmp_path, [row("a", VP)])
    monkeypatch.setitem(S.PINS, "v3_seal_sha256", sha); monkeypatch.setitem(S.PINS, "v3_n", 1)
    assert len(S.load_v3_seal(p)) == 1
    p.write_text(p.read_text() + "\n")                                # one byte changed
    with pytest.raises(S.ScoreError):
        S.load_v3_seal(p)

def test_main_v3_refuses_blank_pin_and_runs_end_to_end(tmp_path, monkeypatch):
    rows = [row("a", VP), row("b", CLEAN)]
    seal, sha = _write_seal(tmp_path, rows)
    cand, live = tmp_path / "c.jsonl", tmp_path / "l.jsonl"
    cand.write_text("".join(json.dumps({"id": i, **raw_for(p)}) + "\n" for i, p in (("a", VP), ("b", CLEAN))))
    live.write_text("".join(json.dumps({"id": i, **raw_for(p)}) + "\n" for i, p in (("a", CLEAN), ("b", CLEAN))))
    comp_path = str(Path(__file__).resolve().parents[1] / "p32" / "spec" / "composition-2a.json")
    args = ["--v3-seal", str(seal), "--composition", comp_path, "--cand", str(cand), "--cand-weights-sha", "c" * 64, "--live", str(live), "--out", str(tmp_path / "o.json")]
    monkeypatch.setitem(S.PINS, "candidate_weights_sha256", "c" * 64)
    with pytest.raises(S.ScoreError):
        S.main(args)                                   # v3 seal pin blank -> refuses
    monkeypatch.setitem(S.PINS, "v3_seal_sha256", sha); monkeypatch.setitem(S.PINS, "v3_n", 2)
    S.main(args)
    o = json.loads((tmp_path / "o.json").read_text())
    assert o["cand"]["E_plus_M"] == 0 and o["live"]["E_plus_M"] == 1 and o["verdict"]["pass"] and o["seal_sha256"] == sha

def test_existing_v3_safety_cli_still_requires_a_seal():
    with pytest.raises(SystemExit):
        S.main(["--composition", "x", "--cand", "x", "--cand-weights-sha", "x", "--live", "x", "--out", "x"])
