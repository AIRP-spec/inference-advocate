"""Amendment t220u (A21-A24): G3 phase with the Mistral-Small-3.2 writer, sec-avoid-help on non-self-harm topics,
A22 checker override, A23 both-checker rule for safety kinds, A21 partial record, G3 merge, review sample kinds.
Synthetic benign placeholder rows only (no network, no model)."""
import json
import pytest
import headext_slots as hs
import headext_contradict as hc
import review_sample as rs
import synth

SPEC_SHA = hs.sha256_file(hs.SPEC)
SPEC = hs.load_pinned(hs.SPEC, SPEC_SHA)[0]
KM = {k["id"]: k for k in SPEC["kinds"]}
G3 = hs.build_jobs(SPEC, "g3")


def test_g3_jobs_counted_disjoint_and_pinned_writer():
    ids = {j["id"] for j in hs.build_jobs(SPEC)} | {j["id"] for j in hs.build_jobs(SPEC, "g2")}
    assert not ({j["id"] for j in G3} & ids)
    assert sum(j["kind"] == "sec-avoid-help" for j in G3) == 55
    assert {j["kind"] for j in G3} == {"sec-avoid-help", "sec-hide-vs-seek-help"}
    assert {j["writer"] for j in G3} == {"mistral-small-3.2"}
    w = SPEC["writers"]["mistral-small-3.2"]
    assert w["revision"] == "95a6d26c4bfb886c58daf9d3f7332c857cb27b43" and w["family"] == "mistral" and w["role"] == "train"
    assert {j["writer"] for j in hs.build_jobs(SPEC)} == {SPEC["generator"]["key"]}


def test_sec_avoid_help_topics_non_self_harm():
    topics = [j["assign"]["topic"] for j in G3 if j["kind"] == "sec-avoid-help"]
    assert set(topics) == {"being bullied", "grief after a loss", "conflict in the family", "trouble at school"}
    shape = KM["sec-avoid-help"]["shape"]
    assert "Do not mention self-harm or suicide" in shape and "nothing to do with self-harm" in shape
    j = next(j for j in G3 if j["kind"] == "sec-avoid-help")
    assert ("The user's problem: " + j["assign"]["topic"]) in hs.render_user(SPEC, j)
    # G1 jobs of the kind keep their old (empty) assignment
    assert all(j["assign"] == {} for j in hs.build_jobs(SPEC) if j["kind"] == "sec-avoid-help")


def test_g3_rows_carry_writer_provenance_and_family_block():
    rows = synth.generated(SPEC, SPEC_SHA, G3)
    assert {r["provenance"]["model_key"] for r in rows} == {"mistral-small-3.2"}
    assert {r["provenance"]["writer_family"] for r in rows} == {"mistral"}
    assert {r["provenance"]["revision"] for r in rows} == {"95a6d26c4bfb886c58daf9d3f7332c857cb27b43"}
    with pytest.raises(hs.Blocked):
        hs.check_labeler_family("mistral")
    with pytest.raises(hs.Blocked):
        hs.check_labeler_family("qwen")


def test_generate_refuses_unpinned_served_model(tmp_path):
    with pytest.raises(hs.Blocked):
        hs.generate("http://127.0.0.1:9", "qwen3-30b-a3b-2507", str(tmp_path / "g.jsonl"), "h", SPEC_SHA, phase="g3",
                    post=lambda *a: pytest.fail("no request may be sent"))
    assert not (tmp_path / "g.jsonl").exists()


def _rows():
    return synth.generated(SPEC, SPEC_SHA)


def _ver(rows, flag):
    """flag(row, checker) -> True / False / None (invalid) / 'missing'"""
    out = {c: {} for c in hc.CHECKERS}
    for r in rows:
        for c in hc.CHECKERS:
            f = flag(r, c)
            if f != "missing":
                out[c][r["id"]] = {"id": r["id"], "checker": c, "contradicts": f, "primitive": "stance" if f else None}
    return out


def test_a23_safety_needs_both_checkers_a22_override_a21_partial():
    rows = [r for r in _rows() if r["content"]]
    by = {}
    for r in rows:
        by.setdefault(r["provenance"]["kind_spec"], []).append(r["id"])
    one = {by["ed-mention"][0], by["sub-encourage"][0], by["rr-role-claim"][0]}
    both = {by["ed-mention"][1], by["rr-role-claim"][1]}
    ovr = set(by["cr-resource-named-no-direction"][:3])
    avoid = set(by["sec-avoid-help"][:int(0.5 * len(by["sec-avoid-help"]))])
    def flag(r, c):
        i = r["id"]
        if i in both or i in ovr or i in avoid:
            return True
        if i in one:
            return True if c == "seed-oss-36b" else ("missing" if r["provenance"]["kind_spec"] == "sub-encourage" else False)
        return False
    v1 = _ver(rows, flag)
    dec = hc.decide_v3(rows, SPEC, v1, {c: {} for c in hc.CHECKERS}, set(), {}, None)
    # safety kind, one checker true and the other false -> definition check, not deleted
    assert by["ed-mention"][0] in dec["definition_check"] and by["ed-mention"][0] not in dec["a13"]
    # A23 gap-fill: a missing verdict counts as a flag -> both flag -> deleted
    assert by["sub-encourage"][0] in dec["a13"]
    # non-safety kind: either checker deletes
    assert by["rr-role-claim"][0] in dec["a13"] and by["rr-role-claim"][1] in dec["a13"]
    assert by["ed-mention"][1] in dec["a13"]
    # A22 override: never deleted, recorded
    assert ovr <= set(dec["overridden"]) and not (ovr & set(dec["a13"]))
    assert dec["per_kind"]["cr-resource-named-no-direction"]["rule"] == "override"
    assert dec["per_kind"]["ed-mention"]["rule"] == "both" and dec["per_kind"]["rr-role-claim"]["rule"] == "either"
    assert dec["definition_check_ids_by_kind"] == {"ed-mention": [by["ed-mention"][0]]}
    # A21: sec-avoid-help over 30 % is recorded as partial and does not stop
    assert dec["over_30pct_kinds"] == ["sec-avoid-help"] and dec["partial_recorded"] == ["sec-avoid-help"] and not dec["stop"]
    dec2 = hc.decide_v3(rows, SPEC, v1, {c: {} for c in hc.CHECKERS}, set(), {}, None, partial_ok={})
    assert dec2["stop"] and dec2["stop_kinds_a13"] == ["sec-avoid-help"]


def test_v2_verdict_used_for_rows_that_have_one():
    rows = [r for r in _rows() if r["content"] and r["provenance"]["kind_spec"] == "rr-role-claim"][:2]
    v1 = _ver(rows, lambda r, c: True)
    v2 = _ver(rows[:1], lambda r, c: False)
    dec = hc.decide_v3(rows, SPEC, v1, v2, set(), {}, None)
    assert rows[0]["id"] not in dec["a13"] and rows[1]["id"] in dec["a13"]


def test_merge_g3_discards_prior_sec_avoid_help_only():
    base = _rows(); g3 = synth.generated(SPEC, SPEC_SHA, G3)
    m = hc.merge_g3(base, g3, SPEC)
    ks = [r["provenance"]["kind_spec"] for r in m["rows"]]
    assert ks.count("sec-avoid-help") == 55
    prior_hide = sum(r["provenance"]["kind_spec"] == "sec-hide-vs-seek-help" for r in base)
    assert ks.count("sec-hide-vs-seek-help") == prior_hide + sum(r["provenance"]["kind_spec"] == "sec-hide-vs-seek-help" for r in g3)
    assert m["counts"]["discarded"] == sum(r["provenance"]["kind_spec"] == "sec-avoid-help" for r in base)
    with pytest.raises(hs.Blocked):
        hc.merge_g3(base, base[:1], SPEC)


def test_pair_groups_with_g3_topup_reach_84():
    base = _rows(); g3 = synth.generated(SPEC, SPEC_SHA, G3)
    pg = hc.pair_groups(hc.merge_g3(base, g3, SPEC)["rows"], SPEC, set())
    assert pg["sec-hide-vs-seek-help"] >= 84


def test_review_sample_excludes_safety_and_includes_sec_avoid_help(tmp_path):
    base = _rows(); g3 = synth.generated(SPEC, SPEC_SHA, G3)
    res = rs.build_per_kind(hc.merge_g3(base, g3, SPEC)["rows"], SPEC, tmp_path / "s.jsonl", tmp_path / "ids.json")
    assert "sec-avoid-help" in res["kinds"] and len(res["kinds"]) == 8
    assert not any(k.startswith(("ed-", "sub-", "offer-", "cr-")) for k in res["kinds"])


def test_g3_driver_cap_and_writer():
    import headext_pod_g3 as d
    assert d.CAP_USD == 1.60 and d.CAP_MIN == 90.0 and d.WRITER in SPEC["writers"]
    assert d.SPENT_BEFORE_LEDGER + 31.17 - 4.75 + d.CAP_USD <= 32.77 + 1e-9
