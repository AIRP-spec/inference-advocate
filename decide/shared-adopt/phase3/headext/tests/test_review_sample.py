import json
import headext_slots as hs
import review_sample as R
import synth


def test_review_sample(tmp_path, capsys):
    sha = hs.sha256_file(hs.SPEC); spec = hs.load_pinned(hs.SPEC, sha)[0]
    rows = synth.generated(spec, sha)
    rep = R.build(rows, spec, tmp_path / "s.jsonl")
    assert rep["n"] == 60 and rep["short"] == {} and rep["gate"] is False
    assert set(rep["ids"]) == set(spec["nonsafety_heads"])
    assert "content" not in json.dumps(rep)  # report carries ids / sha only
    assert R.build(rows, spec, tmp_path / "t.jsonl")["sha256"] == rep["sha256"]
