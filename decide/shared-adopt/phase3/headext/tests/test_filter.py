import json
import pytest
import headext_slots as hs
import headext_filter as hf
import synth

SPEC_SHA = hs.sha256_file(hs.SPEC)
SPEC = hs.load_pinned(hs.SPEC, SPEC_SHA)[0]
ALLOWED = set(SPEC["allowed_digit_strings"])


def row(text, kind="cr-hotline-referral", **prov):
    p = {"kind_spec": kind, "register": "clinical", "length": "short", "finish_reason": "stop", "length_in_band": True, "assign": {}}
    p.update(prov)
    return {"id": "x", "content": text, "kind": kind, "provenance": p}


@pytest.mark.parametrize("text,ok", [
    ("You can call or text 988 any time.", True), ("Text HOME to 741741.", True), ("Call 116 123.", True),
    ("Call 13 11 14.", True), ("Call 14416.", True), ("Call 1166.", True), ("Call or text 9-8-8.", True),
    ("Call 911 now.", False), ("Dial 112.", False), ("Ring 999.", False), ("Call 555-0100.", False),
    ("Dial nine one one.", False), ("Call nine eight eight.", True), ("Take one or two breaths.", True),
    ("It has been 3 days.", False)])
def test_number_validator(text, ok):
    assert (hf.vf_reasons(row(text), ALLOWED) == []) is ok


def test_brand_validator():
    r = row("Fendrowick tea is lovely.", kind="ad-direct-promo", assign={"brand": "Fendrowick"})
    assert hf.ve_reasons(r, SPEC) == []
    assert hf.ve_reasons(row("This tea is lovely.", kind="ad-direct-promo", assign={"brand": "Fendrowick"}), SPEC) == ["brand_missing"]
    deny = SPEC["real_brand_denylist"][0]
    assert "denylisted_brand" in hf.ve_reasons(row(f"Fendrowick beats {deny}.", kind="ad-direct-promo", assign={"brand": "Fendrowick"}), SPEC)
    assert hf.ve_reasons(row("no brand here", kind="cr-hotline-referral"), SPEC) == []


def test_va_reasons():
    assert hf.va_reasons(row("a b c")) == []
    assert "empty" in hf.va_reasons(row(""))
    assert hf.va_reasons(row("a", finish_reason="length")) == ["finish_reason:length"]
    assert hf.va_reasons(row("a", length_in_band=False)) == ["length_out_of_band"]


def test_flags():
    ok = {"stance": "describes", "objects": [], "qualifiers": []}
    assert hf.flags_from_label(ok, "seed-oss") == []
    assert hf.flags_from_label(None, "seed-oss") == ["invalid:seed-oss"]
    assert hf.flags_from_label({**ok, "qualifiers": ["exceeds_common_knowledge"]}, "seed-oss") == ["eck:seed-oss"]
    assert "cse:seed-oss:label" in hf.flags_from_label({**ok, "objects": ["sexual_activity"], "qualifiers": ["subject_is_minor"]}, "seed-oss")
    comp = hf.load_composer()
    assert "cse:seed-oss:compose" in hf.flags_from_label({**ok, "objects": ["sexual_activity"], "qualifiers": ["subject_is_minor"]}, "seed-oss", comp)


def test_checker_delete_logs_and_never_changes_gold(tmp_path):
    rows = synth.generated(SPEC, SPEC_SHA, hs.build_jobs(SPEC)[:12])
    gen = tmp_path / "gen.jsonl"; gen.write_text("".join(json.dumps(r) + "\n" for r in rows))
    items = tmp_path / "items.jsonl"; hs.items(str(gen), str(items))
    golds_before = {r["id"]: hf.gold_for(r, SPEC) for r in rows}
    ok = {"stance": "describes", "objects": [], "qualifiers": []}
    labs = []
    for i, r in enumerate(rows):
        if i == 0:
            continue  # missing label -> delete
        prim = ok
        if i == 1: prim = {**ok, "qualifiers": ["exceeds_common_knowledge"]}
        if i == 2: prim = None
        if i == 3: prim = {**ok, "objects": ["sexual_activity"], "qualifiers": ["subject_is_minor"]}
        labs.append({"id": r["id"], "labeler": "seed-oss", "family": "seed-oss", "primitives": prim})
    lp = tmp_path / "labels.jsonl"; lp.write_text("".join(json.dumps(l) + "\n" for l in labs))
    rep = hf.checker_delete(lp, "seed-oss", "seed-oss", items, [gen, items], tmp_path / "log.json", hf.load_composer())
    assert rep["n_deleted"] == 4
    trig = {e["id"]: e["trigger"] for e in rep["deleted"]}
    assert trig[rows[0]["id"]] == ["missing:seed-oss"] and trig[rows[1]["id"]] == ["eck:seed-oss"]
    assert trig[rows[2]["id"]] == ["invalid:seed-oss"] and any(t.startswith("cse") for t in trig[rows[3]["id"]])
    assert all(len(e["row_sha256"]) == 64 for e in rep["deleted"])
    left = hf.load_jsonl(gen)
    assert {r["id"] for r in left} == {r["id"] for r in rows[4:]}
    assert all(hf.gold_for(r, SPEC) == golds_before[r["id"]] for r in left)  # delete-only: gold untouched
    assert not {r["id"] for r in hf.load_jsonl(items)} & set(trig)
    with pytest.raises(Exception):
        hf.checker_delete(lp, "qwen-judge", "qwen", items, [gen], tmp_path / "log2.json")


def test_select_split_and_held_out():
    rows = synth.generated(SPEC, SPEC_SHA)
    valid = [r for r in rows if not (hf.va_reasons(r) + hf.ve_reasons(r, SPEC) + hf.vf_reasons(r, ALLOWED))]
    assert len(valid) == len(rows)
    sel = hf.select(valid, SPEC)
    derived = {k["id"] for k in SPEC["kinds"] if k.get("derived")}  # t227u A31: filled only by retag, never generated
    assert {k: v for k, v in sel["shortfall"].items() if k not in derived} == {}
    kinds = {k["id"]: k for k in SPEC["kinds"]}
    tr_ids = {r["id"] for r in sel["train"]}; va_ids = {r["id"] for r in sel["val"]}
    assert not tr_ids & va_ids
    for k in SPEC["kinds"]:
        t = [r for r in sel["train"] if r["provenance"]["kind_spec"] == k["id"]]
        v = [r for r in sel["val"] if r["provenance"]["kind_spec"] == k["id"]]
        m = 2 if k.get("pair") else 1
        if k["id"] in derived:
            assert not t and not v
            continue
        assert len(t) == m * (k.get("train_units", k.get("train"))) and len(v) == m * (k.get("val_units", k.get("val")))
        if k.get("pair"):
            assert len({r["pair_unit"] for r in t} & {r["pair_unit"] for r in v}) == 0
    assert len(sel["train"]) == 1684 and len(sel["val"]) == 960
    assert hf.select(valid, SPEC)["val"] == sel["val"]  # deterministic
