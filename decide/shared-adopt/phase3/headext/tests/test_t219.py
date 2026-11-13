"""Amendment t219u (A17-A19): per-primitive checker prompt v2 naming the contradicted primitive, rerun-kind filter,
A18 composed self_harm deletion and restore accounting, A19 flagged non-safety sample.
Synthetic benign placeholder rows only (no network, no model)."""
import json
import pytest
import headext_slots as hs
import headext_filter as hf
import headext_contradict as hc
import synth

SPEC_SHA = hs.sha256_file(hs.SPEC)
SPEC = hs.load_pinned(hs.SPEC, SPEC_SHA)[0]
KM = {k["id"]: k for k in SPEC["kinds"]}
VOC, TYPES, DEFS = hc.vocab_definitions(), hc.head_types(), hc.head_definitions()


def rows_all():
    return synth.generated(SPEC, SPEC_SHA) + synth.generated(SPEC, SPEC_SHA, hs.build_jobs(SPEC, "g2"))


def first(kind, arm=None):
    return next(r for r in rows_all() if r["provenance"]["kind_spec"] == kind and (arm is None or r["arm"] == arm))


def test_vocab_and_head_types_pinned():
    assert set(VOC) == {"stance", "object", "qualifiers"} and "is_mention_not_use" in VOC["qualifiers"]
    assert TYPES["disordered_eating"] == "object" and TYPES["encourages_secrecy"] == "qualifier"
    with pytest.raises(hs.Blocked):
        hc.vocab_definitions(expect="0" * 64)


def test_assigned_primitives_each_with_own_definition():
    for r in rows_all()[::50]:
        g = hf.gold_for(r, SPEC)
        pl = hc.assigned_primitives(r, SPEC, VOC, DEFS, TYPES)
        names = [p["name"] for p in pl]
        assert names[0] == "stance" and pl[0]["label"] == g["stance"] and pl[0]["definition"] == VOC["stance"][g["stance"]]
        assert set(g["objects"]) <= set(names) and set(g["qualifiers"]) <= set(names)
        head = KM[r["provenance"]["kind_spec"]]["head"]
        assert head in names and all(p["definition"] for p in pl)


def test_prompt_v2_rules_and_named_primitive_reply():
    r = first("sec-avoid-help")
    m = hc.messages_v2(r, SPEC, VOC, DEFS, TYPES)
    u = m[1]["content"]
    assert "REGARDLESS of stance" in u and "is_mention_not_use" in u and '"primitive"' in u
    assert "`encourages_secrecy` (QUALIFIER)" in u and "`stance` (STANCE)" in u
    assert "own definition" in m[0]["content"] and "never change or set labels" in m[0]["content"]


@pytest.mark.parametrize("txt,v", [
    ('{"contradicts": false, "primitive": null}', (False, None)),
    ('{"contradicts": true, "primitive": "stance"}', (True, "stance")),
    ('<seed:think>x</seed:think>{"contradicts": true, "primitive": "encourages_secrecy"}', (True, "encourages_secrecy")),
    ('{"contradicts": true, "primitive": "weapons"}', (None, "weapons")),   # not in the row's list -> invalid
    ('{"contradicts": true}', (None, None)),                                 # true must name the primitive
    ('nope', (None, None)),
])
def test_parse_verdict_v2(txt, v):
    assert hc.parse_verdict_v2(txt, {"stance", "encourages_secrecy"}) == v


def test_run_v2_logs_primitive(tmp_path):
    rows = [r for r in rows_all() if r["provenance"]["kind_spec"] == "sec-avoid-help"][:6]

    def post(url, body):
        hit = rows[0]["content"][:30] in body["messages"][1]["content"]
        out = {"contradicts": True, "primitive": "stance"} if hit else {"contradicts": False, "primitive": None}
        return {"choices": [{"message": {"content": json.dumps(out)}, "finish_reason": "stop"}]}
    st = hc.run("http://127.0.0.1:1", "nemotron-3-super", rows, SPEC, str(tmp_path / "v.jsonl"), {}, concurrency=2, post=post, prompt="v2")
    vs = {v["id"]: v for v in hf.load_jsonl(tmp_path / "v.jsonl")}
    assert st["prompt"] == "v2" and st["n_true"] == 1 and vs[rows[0]["id"]]["primitive"] == "stance"
    assert all(v["prompt"] == "v2" for v in vs.values())


def test_kinds_filter_cli(tmp_path):
    rows = rows_all()
    p = tmp_path / "set.jsonl"; hf.seal(rows, p)
    kf = tmp_path / "k.json"; kf.write_text(json.dumps({"kinds": ["sec-avoid-help", "ed-encourage"]}))
    with pytest.raises(hs.Blocked):   # private / non-loopback base URL refused before any request
        hc.main(["run", "--base-url", "http://10.0.0.1:1", "--checker", "seed-oss-36b", "--rows", str(p), "--out",
                 str(tmp_path / "o.jsonl"), "--expect-spec-sha", SPEC_SHA, "--prompt", "v2", "--kinds-from", str(kf)])


def lab(stance, objs, quals=()):
    return {"primitives": {"stance": stance, "objects": list(objs), "qualifiers": list(quals)}}


def test_a18_deletes_only_composed_self_harm():
    comp = hf.load_composer()
    ns = [r for r in rows_all() if KM[r["provenance"]["kind_spec"]]["head"] in SPEC["nonsafety_heads"]][:4]
    sf = next(r for r in rows_all() if KM[r["provenance"]["kind_spec"]]["head"] not in SPEC["nonsafety_heads"])
    rows = ns + [sf]
    ver = {c: {r["id"]: {"contradicts": False} for r in rows} for c in hc.CHECKERS}
    labs = {"nemotron-3-super": {ns[0]["id"]: lab("describes", ["self_harm"]),                     # topic only -> restored
                                 ns[1]["id"]: lab("encourages", ["self_harm"]),                    # composes -> deleted
                                 ns[2]["id"]: lab("endorses", ["self_harm"], ["is_mention_not_use"]),  # production stance overrides mention
                                 sf["id"]: lab("encourages", ["self_harm"])},                      # safety kind: never A18
            "seed-oss-36b": {ns[3]["id"]: lab("describes", ["self_harm"], ["is_mention_not_use"])}}
    d = hc.decide_v2(rows, SPEC, ver, ver, set(), labs, comp)
    assert set(d["a18"]) == {ns[1]["id"], ns[2]["id"]}
    assert d["a18"][ns[1]["id"]] == ["nemotron-3-super:stance=encourages+object=self_harm->class self_harm"]
    assert d["a15"] == d["a18"]


def test_decide_v2_rerun_kinds_use_v2_and_count_primitives(tmp_path):
    rows = [r for r in rows_all() if r["provenance"]["kind_spec"] in ("sec-avoid-help", "sec-isolate")]
    sa = [r["id"] for r in rows if r["provenance"]["kind_spec"] == "sec-avoid-help"]
    si = [r["id"] for r in rows if r["provenance"]["kind_spec"] == "sec-isolate"]
    v1 = {c: {r["id"]: {"contradicts": True} for r in rows} for c in hc.CHECKERS}      # v1 says all contradict
    v2 = {c: {i: {"contradicts": False, "primitive": None} for i in sa} for c in hc.CHECKERS}
    v2["seed-oss-36b"][sa[0]] = {"contradicts": True, "primitive": "stance"}
    v2["nemotron-3-super"][sa[1]] = {"contradicts": None, "primitive": "weapons"}
    labs = {c: {} for c in hc.CHECKERS}
    d = hc.decide_v2(rows, SPEC, v1, v2, {"sec-avoid-help"}, labs, hf.load_composer())
    assert set(i for i in d["a13"] if i in sa) == {sa[0], sa[1]}
    assert d["a13"][sa[0]] == ["contradicts:seed-oss-36b:stance"]
    assert d["per_kind"]["sec-avoid-help"]["a13_by_primitive"] == {"stance": 1}
    assert d["per_kind"]["sec-avoid-help"]["prompt"] == "v2" and d["per_kind"]["sec-isolate"]["prompt"] == "v1"
    assert d["stop_kinds_a13"] == ["sec-isolate"] and d["stop"]   # 30 % rule kept; v1 kinds still judged by v1
    p = tmp_path / "set.jsonl"; hf.seal(rows, p)
    ap = hc.apply(d, rows, [str(p)])
    assert ap["applied_a13"] is False and ap["n_deleted"] == 0     # stop -> A13 deletions held


def test_a19_flagged_nonsafety_excludes_safety_kinds():
    rows = [r for r in rows_all() if r["provenance"]["kind_spec"] in ("sec-avoid-help", "ed-encourage", "cr-refusal-no-referral")]
    v = {c: {r["id"]: {"contradicts": True, "primitive": "stance"} for r in rows} for c in hc.CHECKERS}
    d = hc.decide_v2(rows, SPEC, v, v, {"sec-avoid-help", "ed-encourage", "cr-refusal-no-referral"}, {c: {} for c in hc.CHECKERS},
                     hf.load_composer())
    assert set(d["stop_kinds_a13"]) == {"sec-avoid-help", "ed-encourage", "cr-refusal-no-referral"}
    fl = hc.flagged_nonsafety(d, rows, SPEC)
    assert fl["kinds"] == ["sec-avoid-help"] and len(fl["rows"]) == 5
    assert all(r["provenance"]["kind_spec"] == "sec-avoid-help" and r["named_primitives"] == ["stance"] for r in fl["rows"])
    assert fl["counts_by_named_primitive"]["sec-avoid-help"]["stance"] == 2 * sum(
        r["provenance"]["kind_spec"] == "sec-avoid-help" for r in rows)
    assert fl == hc.flagged_nonsafety(d, rows, SPEC)                 # deterministic
    gone = fl["rows"][0]["id"]; d["a18"] = {gone: ["x"]}                 # an A18-deleted row is never picked
    assert gone not in [r["id"] for r in hc.flagged_nonsafety(d, rows, SPEC)["rows"]]


def test_prompt_v3_is_v2_plus_offer_rule_only():
    r = first("sec-avoid-help")
    u2 = hc.messages_v2(r, SPEC, VOC, DEFS, TYPES)[1]["content"]
    u3 = hc.messages_v2(r, SPEC, VOC, DEFS, TYPES, "v3")[1]["content"]
    assert u3 == u2.replace("- Flag only a clear contradiction", hc.OFFER_RULE + "- Flag only a clear contradiction")
    assert "NEVER `is_mention_not_use`" in u3 and "proposes to provide" in u3 and "proposes to provide" not in u2


def test_run_v3_logs_prompt(tmp_path):
    rows = [r for r in rows_all() if r["provenance"]["kind_spec"] == "sec-avoid-help"][:3]
    seen = []

    def post(url, body):
        seen.append(body["messages"][1]["content"])
        return {"choices": [{"message": {"content": '{"contradicts": false, "primitive": null}'}, "finish_reason": "stop"}]}
    st = hc.run("http://127.0.0.1:1", "seed-oss-36b", rows, SPEC, str(tmp_path / "v.jsonl"), {}, concurrency=1, post=post, prompt="v3")
    assert st["prompt"] == "v3" and all(hc.OFFER_RULE in u for u in seen)
    assert all(v["prompt"] == "v3" for v in hf.load_jsonl(tmp_path / "v.jsonl"))
