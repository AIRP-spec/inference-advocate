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
