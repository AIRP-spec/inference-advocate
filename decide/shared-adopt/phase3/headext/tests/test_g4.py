"""t227u (A31): G4 offer top-up jobs, derived offer-refusal negatives (retag, gold, crisis exclusion), box-side G4 decision.
Synthetic benign rows only."""
import json, sys
from pathlib import Path
import pytest
import headext_slots as hs
import headext_filter as hf
import headext_g4 as G
import build_data_v10 as B
import synth

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pack"))
from common_shared import head_weights, is_excluded  # noqa: E402

SPEC_SHA = hs.sha256_file(hs.SPEC)
SPEC = hs.load_pinned(hs.SPEC, SPEC_SHA)[0]
K = {k["id"]: k for k in SPEC["kinds"]}
NEG = json.loads((Path(__file__).resolve().parents[1] / "evidence" / "t226u" / "offer-refusals.json").read_text())["kept_negative_by_kind"]


def wl(p, rows):
    Path(p).write_text("".join(json.dumps(r) + "\n" for r in rows)); return p


def test_g4_jobs_tightened_offer_only():
    g4 = hs.build_jobs(SPEC, "g4")
    assert len(g4) == 230 and {j["kind"] for j in g4} == {"offer-clinical", "offer-colloquial"}
    assert {j["writer"] for j in g4} == {"mistral-small-3.2"} and all(j["phase"] == "g4" for j in g4)
    assert min(j["sample"] for j in g4) == 50                          # never collides with the kept G1 offer rows
    earlier = {j["id"] for ph in ("g1", "g2", "g3") for j in hs.build_jobs(SPEC, ph)}
    assert not earlier & {j["id"] for j in g4}
    for j in g4:
        u = hs.render_user(SPEC, j)
        assert K[j["kind"]]["g4_shape"] in u and K[j["kind"]]["shape"] not in u
    for ph in ("g1", "g2", "g3"):                                    # earlier phases keep the original shape and no phase tag
        for j in hs.build_jobs(SPEC, ph):
            assert "phase" not in j and "shape" not in j
    assert len(hs.build_jobs(SPEC, "g3")) == 135 and not any(j["kind"] == "sec-hide-vs-seek-help" for j in g4)


def test_derived_kinds_spec():
    a, b = K["offer-refusal-neg"], K["offer-terse-refusal-neg"]
    assert sorted(a["derived_ids"]) == sorted(NEG["offer-clinical"] + NEG["offer-colloquial"]) and len(a["derived_ids"]) == 62
    assert sorted(b["derived_ids"]) == sorted(NEG["offer-terse"]) and len(b["derived_ids"]) == 3
    assert (a["train"], a["val"], b["train"], b["val"]) == (62, 0, 0, 3) and b["held_out"] and not a.get("held_out")
    for k in (a, b):
        assert k["quota"] == 0 and k["gold"] == {"stance": "describes", "objects": ["self_harm"], "qualifiers": ["is_mention_not_use"], "ext": []}
        assert k["ext_excluded"] == ["refers_to_crisis_services"]
    assert not any(j["kind"] in (a["id"], b["id"]) for ph in ("g1", "g2", "g3", "g4") for j in hs.build_jobs(SPEC, ph))
    labs = B.relabel_kinds([a["id"], b["id"]])                         # kind-label-table entries agree with the slot spec
    assert all(labs[x] == {"stance": "describes", "objects": ["self_harm"], "qualifiers": ["is_mention_not_use"], "ext": []} for x in labs)


def test_row_level_crisis_exclusion():
    r = {"id": "x", "ext": {h: 0 for h in SPEC["heads"]}, "ext_excluded": ["refers_to_crisis_services"]}
    assert is_excluded("refers_to_crisis_services", r, {}) and not is_excluded("self_harm", r, {})
    w = head_weights(["self_harm", "refers_to_crisis_services", "encourages_secrecy"], r, {})
    assert w == [1.0, 0.0, 1.0]
    assert head_weights(["refers_to_crisis_services"], {"id": "y", "ext": {}}, {}) == [1.0]


def _g4_rows(spec, sha):
    rows = []
    for j in hs.build_jobs(spec, "g4"):
        rows.append({"id": j["id"], "content": "Okay.", "kind": j["kind"],
                     "provenance": {"kind_spec": j["kind"], "register": j["register"], "length": j["length"], "cell": j["cell"],
                                    "sample": j["sample"], "phase": "g4", "slot_spec_sha256": sha, "role": "OFFER",
                                    "head": "self_harm"}})
    return rows


def test_retag_and_decide(tmp_path):
    base = synth.generated(SPEC, SPEC_SHA)
    s = wl(tmp_path / "set.jsonl", base)
    g4 = _g4_rows(SPEC, SPEC_SHA)
    ids = [r["id"] for r in g4]
    cd, both, one = ids[0], ids[1], ids[2]
    pod = tmp_path / "pod"; pod.mkdir()
    wl(pod / "gen-g4-mistral-small-3.2.jsonl", [r for r in g4 if r["id"] != cd])
    good = {"stance": "encourages", "objects": ["self_harm"], "qualifiers": []}
    for c in G.CHECKERS:
        wl(pod / f"labels-{c}-g4.jsonl", [{"id": i, "labeler": c, "primitives": good} for i in ids if i != cd])
        wl(pod / f"contradict-v3-{c}-g4.jsonl",
           [{"id": i, "checker": c, "prompt": "v3", "contradicts": (i == both) or (i == one and c == "seed-oss-36b"),
             "primitive": "stance" if (i == both or (i == one and c == "seed-oss-36b")) else None, "error": None}
            for i in ids if i != cd])
    out = G.decide(s, pod, SPEC_SHA, tmp_path / "log.json", tmp_path / "out.jsonl")
    assert out["checker_delete_or_unwritten"]["ids"] == [cd] and out["a23_both_flag"]["ids"] == [both]
    assert [i for v in out["definition_check"]["ids_by_kind"].values() for i in v] == [one] and not out["stop"]
    assert out["retag"] == {"n": 65, "by_kind": {"offer-refusal-neg": 62, "offer-terse-refusal-neg": 3}}
    rows = [json.loads(l) for l in (tmp_path / "out.jsonl").read_text().splitlines()]
    assert len(rows) == len(base) + len(g4) - 2 and one in {r["id"] for r in rows}
    neg = {r["id"]: r for r in rows if r["kind"].endswith("refusal-neg")}
    assert len(neg) == 65 and all(r["provenance"]["kind_spec"] == r["kind"] and r["provenance"]["retag"]["from_kind"].startswith("offer-")
                                  for r in neg.values())
    g = hf.gold_for(next(iter(neg.values())), SPEC)
    assert g["stance"] == "describes" and hf.vd_reason(g["stance"], [good]) == [] if hasattr(hf, "vd_reason") else True
    # a second retag of an already-retagged set is refused (ids no longer in a source kind)
    with pytest.raises(hs.Blocked):
        G.retag(rows, SPEC)


def test_decide_refuses_foreign_rows(tmp_path):
    s = wl(tmp_path / "set.jsonl", synth.generated(SPEC, SPEC_SHA))
    pod = tmp_path / "pod"; pod.mkdir()
    bad = _g4_rows(SPEC, SPEC_SHA)[:1]; bad[0]["provenance"]["phase"] = "g3"
    wl(pod / "gen-g4-mistral-small-3.2.jsonl", bad)
    for c in G.CHECKERS:
        wl(pod / f"labels-{c}-g4.jsonl", []); wl(pod / f"contradict-v3-{c}-g4.jsonl", [])
    with pytest.raises(hs.Blocked):
        G.decide(s, pod, SPEC_SHA, tmp_path / "log.json", tmp_path / "out.jsonl")
