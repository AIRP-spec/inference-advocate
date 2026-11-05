import json
from pathlib import Path
import pytest
import headext_slots as hs
import synth

SPEC_SHA = hs.sha256_file(hs.SPEC)


def spec():
    return hs.load_pinned(hs.SPEC, SPEC_SHA)[0]


def test_pins_and_refusals(tmp_path):
    with pytest.raises(Exception):
        hs.load_pinned(hs.SPEC, "0" * 64)
    with pytest.raises(Exception):
        hs.check_labeler_family("qwen")
    hs.check_labeler_family("seed-oss")
    for bad in ("http://203.0.113.5:8000", "https://api.openai.com/v1", "http://example.com"):
        with pytest.raises(Exception):
            hs.check_base_url(bad)
    hs.check_base_url("http://127.0.0.1:8000")
    s = spec()
    assert s["generator"]["family"] == "qwen" and s["generator"]["revision"].startswith("0d7cf239")
    assert all("openai" not in json.dumps(c).lower() for c in s["checkers"])
    assert s["sampling"]["max_tokens"] == 400 and s["checker_rule"].startswith("delete")


def test_jobs_deterministic_and_counts():
    s = spec()
    a, b = hs.build_jobs(s), hs.build_jobs(s)
    assert a == b and len(a) == 3010
    assert sum(2 if j["pair"] else 1 for j in a) == 3476
    for k in s["kinds"]:
        js = [j for j in a if j["kind"] == k["id"]]
        assert len(js) == k["quota"]
        cells = {j["cell"] for j in js}
        assert len(cells) == min(len(hs.cells_for(s, k)), k["quota"])


def test_amendments_in_spec():
    s = spec()
    kinds = {k["id"]: k for k in s["kinds"]}
    # 1 / 10: ED and substance harmful rows are endorses or encourages only; no conveys_method anywhere
    for k in s["kinds"]:
        golds = [a["gold"] for a in k["arms"]] if k.get("pair") else [k["gold"]]
        assert all(g["stance"] != "conveys_method" for g in golds)
    # 2: object-head pairs hold stance constant
    for gid in ("ed-goal-vs-health", "sub-misuse-vs-prescribed"):
        a, b = kinds[gid]["arms"]
        assert a["gold"]["stance"] == b["gold"]["stance"]
    # 3: held-out = the group listed last per head
    for h, groups in s["head_groups"].items():
        assert kinds[groups[-1]].get("held_out") and kinds[groups[-1]]["train"] == 0
    # 4: offer
    assert (kinds["offer-clinical"]["train"], kinds["offer-colloquial"]["train"], kinds["offer-terse"]["train"]) == (30, 30, 0)
    assert kinds["offer-terse"]["val"] == 16 and kinds["offer-terse"]["held_out"]
    # 5: hate pairs 12 / 8
    assert (kinds["hate-elim-vs-self-harm"]["train_units"], kinds["hate-elim-vs-self-harm"]["val_units"]) == (12, 8)
    # 11: allowed digit strings are exactly the pinned services
    assert set(s["allowed_digit_strings"]) == {d for c in s["crisis_services"] for d in c["digits"]}
    import headext_filter as hf
    for c in s["crisis_services"]:
        assert hf.number_strings(c["contact"]) and set(hf.number_strings(c["contact"])) <= set(c["digits"])


def test_make_rows_pair_and_single():
    s = spec()
    jobs = hs.build_jobs(s)
    pj = next(j for j in jobs if j["pair"]); sj = next(j for j in jobs if not j["pair"])
    pr = hs.make_rows(s, pj, synth.raw_for(s, pj), "h", "t", SPEC_SHA)
    assert [r["id"] for r in pr] == [pj["id"] + "-a", pj["id"] + "-b"] and all(r["pair_unit"] == pj["id"] for r in pr)
    bad = hs.make_rows(s, pj, {"choices": [{"message": {"content": "not json"}, "finish_reason": "stop"}]}, "h", "t", SPEC_SHA)
    assert all(r["content"] == "" and r["provenance"]["pair_parse_ok"] is False for r in bad)
    sr = hs.make_rows(s, sj, synth.raw_for(s, sj), "h", "t", SPEC_SHA)
    assert len(sr) == 1 and sr[0]["provenance"]["length_in_band"]


def test_g5_new_kinds_and_rearm():
    s = spec()
    jobs = hs.build_jobs(s, "g5")
    assert len(jobs) == 39 + 26 + 55 + 26 and all(j["phase"] == "g5" for j in jobs)
    assert {j["length"] for j in jobs if j["kind"] == "cr-resource-in-fiction-dialogue"} == {"short"}
    for h in ("claims_relationship_role", "refers_to_crisis_services"):
        assert s["head_groups"][h][-1].endswith("quoted-reply")
    a = [{"pair_unit": "hx-rr-claim-vs-deny-002", "kind_spec": "rr-claim-vs-deny", "content": "A text", "sample": 2,
          "register": "colloquial", "length": "short", "assign": {}}]
    rj = hs.build_jobs(s, "g5", a)
    re_ = [j for j in rj if j.get("rearm")]
    assert [j["id"] for j in re_] == ["hx-rr-claim-vs-deny-002-r0", "hx-rr-claim-vs-deny-002-r1"]
    assert re_[0]["seed"] != re_[1]["seed"]
    u = hs.render_user(s, re_[0])
    assert "A text" in u and "not a person" in u
    rows = hs.make_rows(s, re_[1], {"choices": [{"message": {"content": "B text"}, "finish_reason": "stop"}]}, "h", "t", "x")
    assert len(rows) == 1 and rows[0]["id"] == "hx-rr-claim-vs-deny-002-b-r1" and rows[0]["pair_unit"] == "hx-rr-claim-vs-deny-002"
    assert rows[0]["kind"] == "rr-claim-vs-deny-b" and rows[0]["provenance"]["phase"] == "g5"
