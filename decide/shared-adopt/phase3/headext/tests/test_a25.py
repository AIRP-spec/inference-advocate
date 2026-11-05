"""A25 (t221u): offer-row inputs and the box-side decision (checker-delete + A23 both-checker rule). Synthetic benign rows."""
import json
from pathlib import Path
import headext_slots as hs
import headext_filter as hf
import headext_a25 as A
import synth

SPEC_SHA = hs.sha256_file(hs.SPEC)
SPEC = hs.load_pinned(hs.SPEC, SPEC_SHA)[0]


def wl(p, rows):
    Path(p).write_text("".join(json.dumps(r) + "\n" for r in rows)); return p


def test_inputs_and_decide(tmp_path):
    rows = synth.generated(SPEC, SPEC_SHA)
    s = wl(tmp_path / "set.jsonl", rows)
    it = wl(tmp_path / "items.jsonl", [{"id": r["id"], "content": r["content"], "writer_family": "qwen"} for r in rows])
    m = A.inputs(s, it, tmp_path / "in", SPEC_SHA)
    offer = [r for r in rows if r["provenance"]["kind_spec"] in A.OFFER_KINDS]
    assert m["n_rows"] == len(offer) >= 4 and set(m["ids"]) == {r["id"] for r in offer}
    ids = sorted(m["ids"])
    cd, both, one = ids[0], ids[1], ids[2]
    pod = tmp_path / "pod"; pod.mkdir()
    wl(pod / "rows-offer.jsonl", [r for r in offer if r["id"] != cd])       # checker-delete removed one row in-pod
    good = {"stance": "encourages", "objects": ["self_harm"], "qualifiers": []}
    for c in A.CHECKERS:
        wl(pod / f"labels-{c}-a25.jsonl", [{"id": i, "labeler": c, "primitives": good} for i in ids])
        wl(pod / f"contradict-v3-{c}-a25.jsonl",
           [{"id": i, "checker": c, "prompt": "v3", "contradicts": (i == both) or (i == one and c == "seed-oss-36b"),
             "primitive": "stance" if (i == both or (i == one and c == "seed-oss-36b")) else None, "error": None} for i in ids if i != cd])
    out = A.decide(s, tmp_path / "in" / "a25-inputs.json", pod, SPEC_SHA, tmp_path / "log.json", tmp_path / "set-out.jsonl")
    assert out["checker_delete"]["ids"] == [cd] and out["a23_both_flag"]["ids"] == [both]
    assert [i for v in out["definition_check"]["ids_by_kind"].values() for i in v] == [one]
    kept = {json.loads(l)["id"] for l in (tmp_path / "set-out.jsonl").read_text().splitlines()}
    assert kept == {r["id"] for r in rows} - {cd, both} and one in kept
    assert sum(out["offer_left_by_kind"].values()) == len(offer) - 2
