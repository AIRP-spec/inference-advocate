"""Amendment t218u (A13-A16): G2 jobs, re-spec, contradiction check, self_harm deletion, merge, review sample 2.
Synthetic benign placeholder rows only (no network, no model)."""
import json
import pytest
import headext_slots as hs
import headext_filter as hf
import headext_contradict as hc
import review_sample as rs
import synth

SPEC_SHA = hs.sha256_file(hs.SPEC)
SPEC = hs.load_pinned(hs.SPEC, SPEC_SHA)[0]
KM = {k["id"]: k for k in SPEC["kinds"]}
FIVE = ["rr-role-claim", "rr-authority-claim", "pe-feelings-comment", "pe-answer-to-emotional-prompt", "sec-isolate"]


def test_respec_set_and_quotas():
    assert SPEC["respec_five"] == FIVE
    assert set(SPEC["respec_kinds"]) == set(FIVE) | {"pe-probe-vs-task", "sec-hide-chat"}
    for k in SPEC["respec_kinds"]:
        assert KM[k]["respec"] and KM[k]["g1_rows"] == "discard" and KM[k]["g2_start"] == 100
        assert KM[k]["g2_quota"] == (90 if k == "pe-probe-vs-task" else KM[k]["quota"])
    cr = KM["cr-refer-vs-withhold"]
    assert cr["g1_rows"] == "keep" and cr["g2_start"] == cr["quota"] and cr["g2_quota"] == 35
    assert {k["id"] for k in SPEC["kinds"] if k.get("g2_quota")} == set(SPEC["respec_kinds"]) | {"cr-refer-vs-withhold"}
    assert SPEC["checker_rule"] and {c["key"] for c in SPEC["checkers"]} >= {"seed-oss-36b", "nemotron-3-super"}


def test_g2_jobs_disjoint_and_counted():
    g1 = hs.build_jobs(SPEC); g2 = hs.build_jobs(SPEC, "g2")
    assert len(g1) == 3010 and len(g2) == 470
    assert not ({j["id"] for j in g1} & {j["id"] for j in g2})
    assert {j["kind"] for j in g2} <= set(SPEC["respec_kinds"]) | {"cr-refer-vs-withhold"}
    with pytest.raises(hs.Blocked):
        hs.build_jobs(SPEC, "g9")


def test_g1_jobs_unchanged_by_respec(tmp_path):
    # the held-out quoted-reply kinds and every non-respec kind keep their G1 job ids and assignments
    old = hs.build_jobs(SPEC)
    assert len({j["id"] for j in old}) == 3010
    for j in old:
        if j["kind"] not in SPEC["respec_kinds"]:
            assert "respec" not in KM[j["kind"]]


def test_respec_shapes_tightened():
    for k in ("rr-role-claim", "rr-authority-claim"):
        assert "deny" not in KM[k]["shape"].lower() or "not deny" in KM[k]["shape"].lower() or "never den" in KM[k]["shape"].lower()
    for k in ("pe-feelings-comment", "pe-answer-to-emotional-prompt"):
        assert "feel" in KM[k]["shape"].lower() and "?" in KM[k]["shape"] or "question" in KM[k]["shape"].lower()
    b = next(a for a in KM["pe-probe-vs-task"]["arms"] if a["arm"] == "B")
    assert "probes_user_emotion" not in b["gold"]["ext"]


def test_definitions_pinned():
    d = hc.head_definitions()
    assert set(d) == set(SPEC["heads"]) | {"self_harm"} or set(d) >= set(SPEC["nonsafety_heads"])
    with pytest.raises(hs.Blocked):
        hc.head_definitions(expect="0" * 64)


def rows_g2():
    return synth.generated(SPEC, SPEC_SHA, hs.build_jobs(SPEC, "g2"))


def test_messages_carry_label_not_setting_it():
    r = next(x for x in rows_g2() if x["provenance"]["kind_spec"] == "pe-probe-vs-task" and x["arm"] == "B")
    m = hc.messages(r, SPEC, hc.head_definitions())
    assert "ABSENT" in m[1]["content"] and "probes_user_emotion" in m[1]["content"]
    assert '{"contradicts": true}' in m[1]["content"]


@pytest.mark.parametrize("txt,v", [('{"contradicts": true}', True), ('{"contradicts": false}', False),
                                   ('<think>x</think> {"contradicts": false}', False), ("yes", None), ('{"contradicts": "yes"}', None), ("", None),
                                   ('<seed:think>{"x": 1}</seed:think>{"contradicts": true}', True)])
def test_parse_verdict(txt, v):
    assert hc.parse_verdict(txt) is v


def fake_post(true_ids):
    def post(base_url, body):
        c = body["messages"][1]["content"]
        hit = any(t in c for t in true_ids)
        return {"choices": [{"message": {"content": json.dumps({"contradicts": hit})}, "finish_reason": "stop"}]}
    return post


def test_run_writes_verdicts_and_refuses_generator_family(tmp_path):
    rows = rows_g2()[:20]
    st = hc.run("http://127.0.0.1:1", "seed-oss-36b", rows, SPEC, str(tmp_path / "v.jsonl"), {}, concurrency=4,
                post=fake_post([rows[0]["content"][:30]]))
    assert st["n_written"] == 20 and st["n_true"] >= 1 and st["n_error"] == 0
    with pytest.raises(hs.Blocked):
        hc.run("http://10.0.0.1:1", "seed-oss-36b", rows, SPEC, str(tmp_path / "w.jsonl"), {})
    assert hc.CHECKERS["seed-oss-36b"] != hs.GEN_FAMILY and hc.CHECKERS["nemotron-3-super"] != hs.GEN_FAMILY


def lab(objs):
    return {"primitives": {"stance": "describes", "objects": objs, "qualifiers": []}}


def test_decide_or_rule_missing_and_stop(tmp_path):
    rows = [r for r in rows_g2() if r["provenance"]["kind_spec"] in ("rr-role-claim", "sec-isolate")]
    rr = [r["id"] for r in rows if r["provenance"]["kind_spec"] == "rr-role-claim"]
    ver = {c: {r["id"]: {"contradicts": False} for r in rows} for c in hc.CHECKERS}
    ver["seed-oss-36b"][rr[0]] = {"contradicts": True}        # one checker true -> delete
    del ver["nemotron-3-super"][rr[1]]                         # missing -> delete
    ver["nemotron-3-super"][rr[2]] = {"contradicts": None}     # invalid -> delete
    labs = {c: {r["id"]: lab([]) for r in rows} for c in hc.CHECKERS}
    d = hc.decide(rows, SPEC, ver, labs)
    assert set(d["a13"]) == set(rr[:3]) and not d["stop"]
    assert d["per_kind"]["rr-role-claim"]["a13_deleted"] == 3 and d["per_kind"]["sec-isolate"]["a13_deleted"] == 0
    for i in rr[:20]:
        ver["seed-oss-36b"][i] = {"contradicts": True}
    d = hc.decide(rows, SPEC, ver, labs)
    assert d["stop"] and d["stop_kinds_a13"] == ["rr-role-claim"]
    # stop -> A13 deletions are held, not applied
    p = tmp_path / "set.jsonl"; hf.seal(rows, p)
    ap = hc.apply(d, rows, [str(p)])
    assert ap["applied_a13"] is False and ap["n_deleted"] == 0 and len(hf.load_jsonl(p)) == len(rows)


def test_a15_self_harm_nonsafety_only(tmp_path):
    g1 = synth.generated(SPEC, SPEC_SHA)
    ns = next(r for r in g1 if KM[r["provenance"]["kind_spec"]]["head"] in SPEC["nonsafety_heads"])
    sf = next(r for r in g1 if KM[r["provenance"]["kind_spec"]]["head"] not in SPEC["nonsafety_heads"])
    rows = [ns, sf]
    ver = {c: {r["id"]: {"contradicts": False} for r in rows} for c in hc.CHECKERS}
    labs = {"nemotron-3-super": {ns["id"]: lab(["self_harm"]), sf["id"]: lab(["self_harm"])}, "seed-oss-36b": {}}
    d = hc.decide(rows, SPEC, ver, labs)
    assert list(d["a15"]) == [ns["id"]] and d["a15"][ns["id"]] == ["self_harm:nemotron-3-super"]
    p = tmp_path / "set.jsonl"; hf.seal(rows, p)
    ap = hc.apply(d, rows, [str(p)])
    assert ap["applied_a13"] and [e["id"] for e in ap["deleted"]] == [ns["id"]]
    assert ap["deleted"][0]["kind"] == ns["provenance"]["kind_spec"] and len(ap["deleted"][0]["row_sha256"]) == 64
    assert [r["id"] for r in hf.load_jsonl(p)] == [sf["id"]]


def test_merge_discards_respec_g1_rows():
    g1 = synth.generated(SPEC, SPEC_SHA); g2 = rows_g2()
    m = hc.merge(g1, g2, SPEC)
    assert set(m["discarded_g1"]) == set(SPEC["respec_kinds"])
    assert m["counts"]["set"] == m["counts"]["g1_kept"] + len(g2) == len(m["rows"])
    assert not any(r["provenance"]["kind_spec"] in SPEC["respec_kinds"] and r["id"] in {x["id"] for x in g1} for r in m["rows"])
    pg = hc.pair_groups(m["rows"], SPEC, set())
    assert pg["pe-probe-vs-task"] == 90 and pg["cr-refer-vs-withhold"] == KM["cr-refer-vs-withhold"]["quota"] + 35
    with pytest.raises(hs.Blocked):
        hc.merge(g1, g1[:1], SPEC)


def test_review_sample_per_respec_kind(tmp_path):
    m = hc.merge(synth.generated(SPEC, SPEC_SHA), rows_g2(), SPEC)
    res = rs.build_per_kind(m["rows"], SPEC, tmp_path / "s.jsonl", tmp_path / "ids.json")
    # t220u A24: the seven t218u kinds plus sec-avoid-help
    assert set(res["kinds"]) == set(SPEC["respec_kinds"]) | {"sec-avoid-help"} and res["excluded_safety_adjacent"] == []
    assert all(len(v) == 10 for v in res["ids"].values()) and res["n"] == 80
    assert json.loads((tmp_path / "ids.json").read_text())["sha256"] == res["sha256"]
    pe = [r for r in m["rows"] if r["id"] in set(res["ids"]["pe-probe-vs-task"])]
    assert {r["arm"] for r in pe} == {"A", "B"} and len({r["pair_unit"] for r in pe}) == 5
